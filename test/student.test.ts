import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sqlite3 from "sqlite3";
import { open } from "sqlite";

import { getStudentById, importStudentsFromCsv } from "../src/student";
import { performMigrations } from "../src/db";

async function createTestDb() {
    const db = await open({
        filename: ":memory:",
        driver: sqlite3.cached.Database,
    });
    await performMigrations(db);
    return db;
}

test("getStudentById queries by idNumber", async () => {
    const db = await createTestDb();
    try {
        await db.run(
            "INSERT INTO student (idNumber, firstName, lastName, graduationYear) VALUES (?, ?, ?, ?)",
            "123456789",
            "Ada",
            "Lovelace",
            2027,
        );

        const result = await getStudentById(db, "123456789");

        assert.deepEqual(result, {
            idNumber: "123456789",
            firstName: "Ada",
            lastName: "Lovelace",
            graduationYear: 2027,
        });
    } finally {
        await db.close();
    }
});

test("importStudentsFromCsv imports valid rows and reports failures", async () => {
    const tmpPath = await mkdtemp(path.join(tmpdir(), "attendance-kiosk-"));
    const csvPath = path.join(tmpPath, "students.csv");
    await writeFile(
        csvPath,
        [
            "id_number,first_name,last_name,graduation_year",
            "123456789,Ada,Lovelace,2027",
            "987654321,Grace,Hopper,",
            "11111111,Too,Short,2028",
            "222222222,,MissingFirst,2029",
        ].join("\n"),
    );

    const db = await createTestDb();
    try {
        const result = await importStudentsFromCsv(db, csvPath);

        assert.deepEqual(result, { numSuccess: 2, numFailure: 2 });

        const rows = await db.all("SELECT idNumber, firstName, lastName, graduationYear FROM student ORDER BY idNumber");
        assert.deepEqual(rows, [
            { idNumber: "123456789", firstName: "Ada", lastName: "Lovelace", graduationYear: 2027 },
            { idNumber: "987654321", firstName: "Grace", lastName: "Hopper", graduationYear: null },
        ]);
    } finally {
        await db.close();
        await rm(tmpPath, { recursive: true, force: true });
    }
});

test("importStudentsFromCsv rolls back when a database write fails", async () => {
    const tmpPath = await mkdtemp(path.join(tmpdir(), "attendance-kiosk-"));
    const csvPath = path.join(tmpPath, "students.csv");
    await writeFile(
        csvPath,
        [
            "id_number,first_name,last_name,graduation_year",
            "123456789,Ada,Lovelace,2027",
        ].join("\n"),
    );

    const db = await createTestDb();
    try {
        await db.exec(`
            CREATE TRIGGER fail_student_insert
            BEFORE INSERT ON student
            BEGIN
                SELECT RAISE(ABORT, 'insert failed');
            END;
        `);

        await assert.rejects(
            importStudentsFromCsv(db, csvPath),
            /insert failed/,
        );

        const rows = await db.all("SELECT * FROM student");
        assert.deepEqual(rows, []);
    } finally {
        await db.close();
        await rm(tmpPath, { recursive: true, force: true });
    }
});

test("importStudentsFromCsv handles CSV without graduation_year column", async () => {
    const tmpPath = await mkdtemp(path.join(tmpdir(), "attendance-kiosk-"));
    const csvPath = path.join(tmpPath, "students.csv");
    await writeFile(
        csvPath,
        [
            "id_number,first_name,last_name",
            "123456789,Ada,Lovelace",
        ].join("\n"),
    );

    const db = await createTestDb();
    try {
        const result = await importStudentsFromCsv(db, csvPath);

        assert.deepEqual(result, { numSuccess: 1, numFailure: 0 });

        const row = await db.get("SELECT idNumber, firstName, lastName, graduationYear FROM student");
        assert.deepEqual(row, {
            idNumber: "123456789",
            firstName: "Ada",
            lastName: "Lovelace",
            graduationYear: null,
        });
    } finally {
        await db.close();
        await rm(tmpPath, { recursive: true, force: true });
    }
});
