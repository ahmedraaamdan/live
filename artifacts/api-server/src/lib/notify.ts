/** In-app notifications (the bell). Push notifications will hang off this later. */
import { db, notificationsTable } from "@workspace/db";
import { logger } from "./logger";

export interface NotificationInput {
  kind: string;
  title: string;
  body?: string;
  link?: string;
}

export async function notify(userIds: string[], n: NotificationInput) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  try {
    await db.insert(notificationsTable).values(ids.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body ?? "", link: n.link })));
  } catch (err) {
    logger.error({ err }, "notify failed");
  }
}
