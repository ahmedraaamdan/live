import { initDb } from "@workspace/db";
import app from "./app";
import { env, liveConfigured, mailConfigured, recordingConfigured } from "./lib/env";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";

const database = await initDb({ migrationsFolder: env.migrationsFolder, pgliteDir: env.pgliteDir });

app.listen(env.port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    {
      port: env.port,
      database,
      payments: env.payment.provider,
      live: liveConfigured,
      recording: recordingConfigured,
      mail: mailConfigured ? "smtp" : "outbox",
    },
    "Server listening",
  );
  startScheduler();
});
