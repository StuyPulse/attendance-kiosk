import { Database } from "sqlite";

export async function performMigrations(db: Database) {
    await db.exec("CREATE TABLE IF NOT EXISTS checkin (timestamp TEXT, idNumber TEXT)");
    await db.exec("CREATE INDEX IF NOT EXISTS timestampIndex ON checkin (timestamp COLLATE NOCASE)");
    await db.exec("CREATE INDEX IF NOT EXISTS idNumberIndex ON checkin (idNumber)");
    await db.exec("CREATE TABLE IF NOT EXISTS student (idNumber TEXT PRIMARY KEY, firstName TEXT, lastName TEXT)");

    const studentColumns = await db.all("PRAGMA table_info(student)");
    const graduationYearExists = studentColumns.some((col: { name: string }) => col.name === "graduationYear");
    if (!graduationYearExists) {
        await db.exec("ALTER TABLE student ADD COLUMN graduationYear NUMBER");
    }
}