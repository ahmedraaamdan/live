import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { and, eq, isNull } from "drizzle-orm";
import { db, initDb, teacherProfilesTable, usersTable } from "@workspace/db";
import { sendTeacherGrowthEmail } from "../src/lib/emails";
import { env } from "../src/lib/env";
import { logger } from "../src/lib/logger";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function main() {
  await initDb({
    migrationsFolder: env.migrationsFolder || path.resolve(root, "lib/db/drizzle"),
    pgliteDir: env.pgliteDir,
  });

  const teachers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(teacherProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, teacherProfilesTable.userId))
    .where(
      and(
        eq(usersTable.role, "teacher"),
        eq(usersTable.suspended, false),
        isNull(usersTable.deletedAt),
        isNull(teacherProfilesTable.marketingEmailSentAt),
      ),
    );

  console.log(`Found ${teachers.length} active teachers without marketing email.`);
  let sentCount = 0;
  let failCount = 0;

  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers[i]!;
    console.log(`[${i + 1}/${teachers.length}] Sending to ${teacher.name} <${teacher.email}>...`);
    try {
      const [claimed] = await db
        .update(teacherProfilesTable)
        .set({ marketingEmailSentAt: new Date() })
        .where(and(eq(teacherProfilesTable.userId, teacher.id), isNull(teacherProfilesTable.marketingEmailSentAt)))
        .returning();

      if (!claimed) {
        console.log(`Skipped ${teacher.email} (already sent).`);
        continue;
      }

      const ok = await sendTeacherGrowthEmail(teacher);
      if (ok) {
        sentCount++;
        console.log(`✓ Sent successfully to ${teacher.email}`);
      } else {
        failCount++;
        console.error(`✗ Failed to send to ${teacher.email}`);
      }
    } catch (err) {
      failCount++;
      console.error(`Error sending to ${teacher.email}:`, err);
    }
    await sleep(800);
  }

  console.log(`\n========================================`);
  console.log(`Finished: ${sentCount} sent, ${failCount} failed.`);
  console.log(`========================================\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
