import fs from "fs";
import { buffer } from "stream/consumers";
import { createGzip } from "zlib";
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
    const dbStream = fs.createReadStream(tmpBackupPath);
    const gzip = createGzip();
    const gzippedDB = await buffer(dbStream.pipe(gzip));

    const client = new S3Client({ region: process.env.AWS_REGION });
    const bucketName = process.env.BACKUP_S3_BUCKET;
    const prefix = process.env.BACKUP_S3_PREFIX || "";
    const filename = getTimestampedFilename("data", "db.gz");

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `${prefix}${filename}`,
        Body: gzippedDB,
    });

    await client.send(command);
}
