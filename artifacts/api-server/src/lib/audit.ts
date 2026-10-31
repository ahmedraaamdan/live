import { adminActionsTable, db } from "@workspace/db";
import type { Tx } from "./ledger";

/** Who decided what on money and accounts. Written in the same transaction as the decision. */
export async function recordAdminAction(q: Tx | typeof db, actorId: string, action: string, targetId: string, note = "") {
  await q.insert(adminActionsTable).values({ actorId, action, targetId, note });
}
