import * as fs from "fs";

import { parse } from "csv-parse";
import { Database } from "sqlite";

type StudentCsvRecord = {
    id_number?: string;
    first_name?: string;
    last_name?: string;
    graduation_year?: string;
};

export async function getStudentById(db: Database, idNumber: string) {
    return db.get(
        "SELECT * FROM student WHERE idNumber = ?",
        idNumber,
    );
}

export async function importStudentsFromCsv(db: Database, filePath: string) {
    const parser = fs
        .createReadStream(filePath)
        .pipe(parse({ columns: true }));

    let numSuccess = 0;
    let numFailure = 0;

    await db.run("BEGIN TRANSACTION");
    try {
        for await (const record of parser as AsyncIterable<StudentCsvRecord>) {
            const idNumber = record.id_number?.trim() ?? "";
            const firstName = record.first_name?.trim() ?? "";
            const lastName = record.last_name?.trim() ?? "";
            const graduationYear = parseInt(record.graduation_year?.trim() ?? "", 10) || null;

            if (idNumber.length !== 9 || !firstName || !lastName) {
                numFailure++;
                continue;
            }

            await db.run(
                "INSERT OR REPLACE INTO student (idNumber, firstName, lastName, graduationYear) VALUES (?, ?, ?, ?)",
                idNumber,
                firstName,
                lastName,
                graduationYear,
            );
            numSuccess++;
        }

        await db.run("COMMIT");
    } catch (err) {
        await db.run("ROLLBACK");
        throw err;
    }

    return { numSuccess, numFailure };
}

