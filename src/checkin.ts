import { Database } from "sqlite";

export async function insertCheckin(db: Database, timestamp: string, idNumber: string) {
    await db.run(
        "INSERT INTO checkin (timestamp, idNumber) VALUES (?, ?)",
        timestamp,
        idNumber,
    );
}

