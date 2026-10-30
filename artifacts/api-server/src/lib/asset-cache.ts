import { constants, copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
/** Preserve content-hashed files so already-open tabs can load lazy screens after deployment. */
export function retainAppAssets(source: string, cache: string) {
  mkdirSync(cache, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    try { copyFileSync(path.join(source, entry.name), path.join(cache, entry.name), constants.COPYFILE_EXCL); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
}
