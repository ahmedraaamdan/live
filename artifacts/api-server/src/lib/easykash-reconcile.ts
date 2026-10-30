import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { bookingsTable, db, paymentsTable, usersTable, type Payment } from "@workspace/db";
import { confirmPayment, failPayment } from "./bookings";
import { reverseBooking } from "./ledger";
import { notify } from "./notify";
import { easykashAmountCents, easykashMethod, easykashReference, inquireEasykash } from "./payments/easykash";

const checks = new Map<string, number>();
export async function applyEasykashResult(payment: Payment, data: Record<string, unknown>) {
  if (payment.provider !== "easykash") return;
  if (data.customerReference != null && data.customerReference !== easykashReference(payment.id)) throw new Error("EasyKash reference mismatch");
  const status = String(data.status ?? "").toUpperCase();
  const safeData = Object.fromEntries(["status", "Amount", "PaymentMethod", "easykashRef", "customerReference", "voucher", "ProductCode", "ProductType"].filter(k => data[k] != null).map(k => [k, data[k]]));
  if (["PAID", "REFUNDED"].includes(status)) {
    if (easykashAmountCents(data.Amount) !== payment.amountCents || !data.easykashRef) {
      const old = (payment.raw ?? {}) as Record<string, unknown>;
      await db.update(paymentsTable).set({ raw: { ...old, gahezReviewReason: "amount_or_reference_mismatch" } }).where(eq(paymentsTable.id, payment.id));
      if (!old.gahezReviewReason) {
        const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
        await notify(admins.map(a => a.id), { kind: "payment", title: "معاملة دفع تحتاج إلى مراجعة", body: `عملية ${payment.id}`, link: "/admin" });
      }
      return;
    }
    if (status === "PAID") await confirmPayment(payment.id, { txnId: String(data.easykashRef), method: easykashMethod(data.PaymentMethod), raw: safeData });
    else {
      await db.transaction(async tx => {
        const [p] = await tx.select().from(paymentsTable).where(eq(paymentsTable.id, payment.id)).for("update");
        if (!p || p.status === "refunded") return;
        await reverseBooking(tx, p.bookingId, "استرداد مؤكد من إيزي كاش", p.id);
        await tx.update(bookingsTable).set({ status: "refunded" }).where(and(eq(bookingsTable.id, p.bookingId), eq(bookingsTable.confirmedPaymentId, p.id)));
        await tx.update(paymentsTable).set({ status: "refunded", raw: { ...safeData, gahezRefundPending: false }, updatedAt: new Date() }).where(eq(paymentsTable.id, p.id));
      });
    }
  } else if (["FAILED", "EXPIRED", "CANCELED", "CANCELLED"].includes(status)) await failPayment(payment.id, safeData);
  else if (payment.status === "pending" && ["NEW", "PENDING"].includes(status)) await db.update(paymentsTable).set({ raw: { ...(payment.raw as Record<string, unknown> ?? {}), ...safeData } }).where(eq(paymentsTable.id, payment.id));
}
export async function reconcileEasykashPayment(payment: Payment) {
  if (payment.provider !== "easykash" || payment.status === "refunded") return;
  const raw = (payment.raw ?? {}) as Record<string, unknown>;
  if (Date.now() - (checks.get(payment.id) ?? 0) < 15_000) return;
  if (checks.size > 10_000) { const cutoff = Date.now() - 300_000; for (const [id, at] of checks) if (at < cutoff) checks.delete(id); }
  checks.set(payment.id, Date.now());
  try { await applyEasykashResult(payment, await inquireEasykash(payment.id)); }
  finally { await db.update(paymentsTable).set({ updatedAt: new Date() }).where(eq(paymentsTable.id, payment.id)); }
}
export async function reconcileEasykashPending() {
  const rows = await db.select().from(paymentsTable).where(and(eq(paymentsTable.provider, "easykash"), or(and(gte(paymentsTable.createdAt, new Date(Date.now() - 86_400_000)), inArray(paymentsTable.status, ["pending", "failed"])), sql`${paymentsTable.raw}->>'gahezRefundPending' = 'true' or ${paymentsTable.raw}->>'gahezReviewReason' is not null`))).orderBy(asc(paymentsTable.updatedAt)).limit(20);
  for (let i = 0; i < rows.length; i += 5) await Promise.allSettled(rows.slice(i, i + 5).map(reconcileEasykashPayment));
}
