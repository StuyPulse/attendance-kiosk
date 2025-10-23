import fs from "fs";
import { Database } from "sqlite";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getTimestampedFilename } from "./util";

export async function backupDBToS3(db: Database) {
    if (!process.env.AWS_REGION || !process.env.BACKUP_S3_BUCKET) {
        throw new Error("Missing required environment variables for S3 backup");
    }

    const tmpBackupPath = "/tmp/attendance-kiosk-data-backup.db";

    try {
        await fs.promises.unlink(tmpBackupPath);
    } catch (e) {
        if (e.code !== "ENOENT") {
            throw e;
        }
    }

    await db.run(`VACUUM INTO "${tmpBackupPath}"`);
    const dbContents = await fs.promises.readFile(tmpBackupPath);

    const client = new S3Client({ region: process.env.AWS_REGION });
    const bucketName = process.env.BACKUP_S3_BUCKET;
    const prefix = process.env.BACKUP_S3_PREFIX || "";
    const filename = getTimestampedFilename("data", "db");

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `${prefix}${filename}`,
        Body: dbContents,
    });

    await client.send(command);
}
