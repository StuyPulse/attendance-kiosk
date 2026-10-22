import test from "node:test";
import assert from "node:assert/strict";

import sqlite3 from "sqlite3";
import { open } from "sqlite";

import { insertCheckin } from "../src/checkin";
import { performMigrations } from "../src/db";

test("insertCheckin inserts timestamp and idNumber into checkin table", async () => {
    const db = await open({
        filename: ":memory:",
        driver: sqlite3.cached.Database,
    });

    try {
        await performMigrations(db);

        await insertCheckin(db, "2026-10-22T12:34:56.000", "123456789");

        const row = await db.get("SELECT timestamp, idNumber FROM checkin");
        assert.deepEqual(row, {
            timestamp: "2026-10-22T12:34:56.000",
            idNumber: "123456789",
        });
    } finally {
        await db.close();
    }
});
