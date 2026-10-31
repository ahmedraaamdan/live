/** Support tickets: anyone signed in can write to the administrators and follow the reply here. */
import { Router } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, notificationsTable, supportTicketMessagesTable, supportTicketsTable, usersTable, type SupportTicket, type User } from "@workspace/db";
import { ticketInputSchema, ticketReplySchema, type TicketDetailDTO, type TicketDTO } from "@workspace/live-core";
import { requireRole, requireUser } from "../lib/auth";
import { toMini } from "../lib/dto";
import { sendTicketAnswered, sendTicketOpened } from "../lib/emails";
import { badRequest, notFound, parse, uuidParam } from "../lib/http";
import { notify, notifyAdmins } from "../lib/notify";
import { enforce, LIMITS } from "../lib/rate-limit";

const router = Router();

const toTicket = (t: SupportTicket, owner: User | null): TicketDTO => ({
  id: t.id,
  category: t.category,
  subject: t.subject,
  status: t.status,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  user: owner ? { ...toMini(owner), role: owner.role, email: owner.email } : null,
});

async function loadTicket(id: string, user: User) {
  const ticket = await db.query.supportTicketsTable.findFirst({ where: eq(supportTicketsTable.id, id) });
  // Other people's tickets look exactly like ones that don't exist.
  if (!ticket || (ticket.userId !== user.id && user.role !== "admin")) throw notFound("التذكرة غير متاحة");
  return ticket;
}

async function detail(ticket: SupportTicket, viewer: User): Promise<TicketDetailDTO> {
  const rows = await db
    .select({ m: supportTicketMessagesTable, author: usersTable })
    .from(supportTicketMessagesTable)
    .innerJoin(usersTable, eq(usersTable.id, supportTicketMessagesTable.authorId))
    .where(eq(supportTicketMessagesTable.ticketId, ticket.id))
    .orderBy(asc(supportTicketMessagesTable.createdAt));
  const owner = viewer.role === "admin" ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, ticket.userId) }) : null;
  return {
    ...toTicket(ticket, owner ?? null),
    // Users see "support", not which administrator answered.
    messages: rows.map(({ m, author }) => ({ id: m.id, body: m.body, fromAdmin: m.fromAdmin, createdAt: m.createdAt.toISOString(), author: m.fromAdmin && viewer.role !== "admin" ? { id: "support", name: "فريق الدعم", avatarUrl: null } : toMini(author) })),
  };
}

router.get("/tickets", async (req, res) => {
  const user = requireUser(req);
  const rows = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.userId, user.id)).orderBy(desc(supportTicketsTable.updatedAt)).limit(50);
  res.json(rows.map((t) => toTicket(t, null)));
});

router.post("/tickets", async (req, res) => {
  const user = requireUser(req);
  enforce(LIMITS.ticket, user.id, "أرسلت تذاكر كثيرة. انتظر ردنا أو حاول بعد قليل.");
  const input = parse(ticketInputSchema, req.body);
  const ticket = await db.transaction(async (tx) => {
    const [row] = await tx.insert(supportTicketsTable).values({ userId: user.id, category: input.category, subject: input.subject }).returning();
    await tx.insert(supportTicketMessagesTable).values({ ticketId: row!.id, authorId: user.id, body: input.body });
    return row!;
  });
  await notifyAdmins({ kind: "ticket", title: `تذكرة جديدة من ${user.name}`, body: input.subject, link: `/support/${ticket.id}` });
  void sendTicketOpened(user, input.subject, input.body, ticket.id);
  res.status(201).json(toTicket(ticket, null));
});

router.get("/tickets/:id", async (req, res) => {
  const user = requireUser(req);
  const ticket = await loadTicket(uuidParam(req.params.id), user);
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.link, `/support/${ticket.id}`), sql`${notificationsTable.readAt} is null`));
  res.json(await detail(ticket, user));
});

router.post("/tickets/:id/messages", async (req, res) => {
  const user = requireUser(req);
  enforce(LIMITS.ticketMessage, user.id, "ترسل رسائل كثيرة. انتظر قليلًا ثم حاول مجددًا.");
  const ticket = await loadTicket(uuidParam(req.params.id), user);
  if (ticket.status === "closed") throw badRequest("هذه التذكرة مغلقة. يمكنك فتح تذكرة جديدة.", "ticket_closed");
  const { body } = parse(ticketReplySchema, req.body);
  // An administrator replying to their own ticket is still the person asking.
  const fromAdmin = user.role === "admin" && ticket.userId !== user.id;
  const updated = await db.transaction(async (tx) => {
    await tx.insert(supportTicketMessagesTable).values({ ticketId: ticket.id, authorId: user.id, fromAdmin, body });
    const [row] = await tx.update(supportTicketsTable).set({ status: fromAdmin ? "answered" : "open", updatedAt: new Date() }).where(eq(supportTicketsTable.id, ticket.id)).returning();
    return row!;
  });
  if (fromAdmin) {
    const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.id, ticket.userId) });
    await notify([ticket.userId], { kind: "ticket", title: "وصلك رد من الدعم", body: ticket.subject, link: `/support/${ticket.id}` });
    if (owner) void sendTicketAnswered(owner, ticket.subject, ticket.id);
  } else {
    await notifyAdmins({ kind: "ticket", title: `رد جديد من ${user.name}`, body: ticket.subject, link: `/support/${ticket.id}` });
  }
  res.status(201).json(await detail(updated, user));
});

router.post("/tickets/:id/close", async (req, res) => {
  const user = requireUser(req);
  const ticket = await loadTicket(uuidParam(req.params.id), user);
  const [updated] = await db.update(supportTicketsTable).set({ status: "closed", updatedAt: new Date() }).where(eq(supportTicketsTable.id, ticket.id)).returning();
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.link, `/support/${ticket.id}`), sql`${notificationsTable.readAt} is null`));
  res.json(await detail(updated!, user));
});

router.get("/admin/tickets", async (req, res) => {
  requireRole(req, "admin");
  const rows = await db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.updatedAt)).limit(200);
  const ownerIds = [...new Set(rows.map((t) => t.userId))];
  const owners = ownerIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, ownerIds)) : [];
  const by = new Map(owners.map((u) => [u.id, u]));
  // Waiting for an answer comes first.
  res.json(rows.map((t) => toTicket(t, by.get(t.userId) ?? null)).sort((a, b) => Number(b.status === "open") - Number(a.status === "open")));
});

export default router;
