/**
 * Homework uploads on local disk (a Docker volume in production). Swap the
 * two functions for S3/R2 calls when files outgrow one server.
 */
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

export async function saveFile(id: string, data: Buffer): Promise<string> {
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}`;
  const full = path.join(env.uploadDir, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

export function readFile(key: string) {
  return createReadStream(path.join(env.uploadDir, key));
}
