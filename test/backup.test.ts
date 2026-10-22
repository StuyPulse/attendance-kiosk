import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { backupDBToS3 } from "../src/backup";
import { performMigrations } from "../src/db";

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
    const prev: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) {
        prev[key] = process.env[key];
        const next = vars[key];
        if (next === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = next;
        }
    }

    return run().finally(() => {
        for (const key of Object.keys(vars)) {
            const value = prev[key];
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    });
}

async function createTestDb() {
    const db = await open({
        filename: ":memory:",
        driver: sqlite3.cached.Database,
    });
    await performMigrations(db);
    return db;
}

test("backupDBToS3 throws when required environment variables are missing", async () => {
    const db = await createTestDb();
    try {
        await withEnv({ AWS_REGION: undefined, BACKUP_S3_BUCKET: undefined }, async () => {
            await assert.rejects(
                backupDBToS3(db),
                /Missing required environment variables/,
            );
        });
    } finally {
        await db.close();
    }
});

test("backupDBToS3 uploads gzipped sqlite backup with expected key", async () => {
    const db = await createTestDb();
    const tmpPath = await mkdtemp(path.join(tmpdir(), "backup-test-"));
    const backupPath = path.join(tmpPath, "backup.db");

    try {
        await db.run(
            "INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)",
            "2026-10-22T15:00:00",
            "123456789",
        );

        let sentCommand: PutObjectCommand | null = null;

        await withEnv(
            {
                AWS_REGION: "us-east-1",
                BACKUP_S3_BUCKET: "test-bucket",
                BACKUP_S3_PREFIX: "daily/",
            },
            async () => {
                await backupDBToS3(db, {
                    tmpBackupPath: backupPath,
                    getFilename: () => "data-test.db.gz",
                    createS3Client: () => ({
                        send: async (command: PutObjectCommand) => {
                            sentCommand = command;
                            return {};
                        },
                    }),
                });
            },
        );

        assert.ok(sentCommand);
        const input = (sentCommand as PutObjectCommand).input;
        assert.equal(input.Bucket, "test-bucket");
        assert.equal(input.Key, "daily/data-test.db.gz");
        assert.ok(input.Body);

        const gzipped = Buffer.from(input.Body as Uint8Array);
        const rawDbBytes = gunzipSync(gzipped);
        assert.equal(rawDbBytes.slice(0, 16).toString("utf-8"), "SQLite format 3\u0000");
    } finally {
        await db.close();
        await rm(tmpPath, { recursive: true, force: true });
    }
});

