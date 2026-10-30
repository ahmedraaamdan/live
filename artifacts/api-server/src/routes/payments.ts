import { applyEasykashResult, reconcileEasykashPayment } from "../lib/easykash-reconcile";
import { easykashPaymentId, verifyEasykashCallback } from "../lib/payments/easykash";
import express, { Router } from "express";
import { eq } from "drizzle-orm";
import { db, lecturesTable, paymentsTable, bookingsTable, recordingsTable } from "@workspace/db";
import { mockPaySchema, type PaymentDTO, type PaymentMethod } from "@workspace/live-core";
import { requireUser } from "../lib/auth";
import { confirmPayment, failPayment } from "../lib/bookings";
import { env } from "../lib/env";
import { forbidden, notFound, parse, uuidParam } from "../lib/http";
import { lectureIdFromRoom, recordingUrl, webhookReceiver } from "../lib/livekit";
import { logger } from "../lib/logger";
import { readPaymobTransaction, verifyPaymobHmac } from "../lib/payments/paymob";
import { announceRecording } from "./live";

const router = Router();

router.get("/payments/:id", async (req, res) => {
  const user = requireUser(req);
  const id = uuidParam(req.params.id);
  const [row] = await db
    .select({ p: paymentsTable, l: lecturesTable })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(bookingsTable.id, paymentsTable.bookingId))
    .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
    .where(eq(paymentsTable.id, id));
  if (!row) throw notFound();
  if (row.p.userId !== user.id && user.role !== "admin") throw forbidden();
  if (row.p.provider === "easykash") {
    await reconcileEasykashPayment(row.p).catch(() => undefined);
    const updated = await db.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, id) });
    if (updated) row.p = updated;
  }
  const flags = (row.p.raw ?? {}) as Record<string, unknown>;
  const body: PaymentDTO = {
    refundPending: Boolean(flags.gahezRefundPending),
    voucher: /^\d{3,40}$/.test(String(flags.voucher ?? "")) ? String(flags.voucher) : null,
    requiresReview: Boolean(flags.gahezReviewReason),
    id: row.p.id,
    status: row.p.status,
    amountCents: row.p.amountCents,
    method: row.p.method as PaymentMethod | null,
    provider: row.p.provider,
    bookingId: row.p.bookingId,
    lectureId: row.l.id,
    lectureTitle: row.l.title,
    createdAt: row.p.createdAt.toISOString(),
  };
  res.json(body);
});

/** The dev gateway's "pay" button. Only exists while PAYMENT_PROVIDER=mock. */
router.post("/payments/mock/:id/complete", async (req, res) => {
  if (env.payment.provider !== "mock") throw notFound();
  const user = requireUser(req);
  const id = uuidParam(req.params.id);
  const payment = await db.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, id) });
  if (!payment || payment.userId !== user.id) throw notFound();
  const { method, outcome } = parse(mockPaySchema, req.body);
  if (outcome === "success") await confirmPayment(id, { txnId: `mock_txn_${Date.now()}`, method, raw: { mock: true, method } });
  else await failPayment(id, { mock: true, method });
  res.json({ ok: true });
});

router.post("/webhooks/easykash", async (req, res) => {
  if (!verifyEasykashCallback(req.body ?? {})) return void res.status(403).json({ error: "invalid signature" });
  const id = easykashPaymentId(req.body.customerReference);
  if (!id) return void res.status(400).json({ error: "invalid product reference" });
  const payment = await db.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, id) });
  if (!payment || payment.provider !== "easykash") return void res.status(404).json({ error: "unknown payment" });
  await applyEasykashResult(payment, req.body);
  res.json({ received: true });
});

// ---------------------------------------------------------------- webhooks

/** Paymob "transaction processed" callback. Signed with PAYMOB_HMAC_SECRET. */
router.post("/webhooks/paymob", async (req, res) => {
  const obj = (req.body?.obj ?? {}) as Record<string, unknown>;
  const hmac = String(req.query.hmac ?? req.body?.hmac ?? "");
  if (req.body?.type !== "TRANSACTION" || !verifyPaymobHmac(obj, hmac)) {
    logger.warn({ type: req.body?.type }, "Paymob webhook rejected");
    return void res.status(401).json({ error: "bad signature" });
  }
  const txn = readPaymobTransaction(obj);
  if (!txn.paymentId) return void res.json({ ok: true });
  if (txn.isRefund) {
    // Refunds we started are already recorded; nothing to do here.
  } else if (txn.success && !txn.pending) {
    await confirmPayment(txn.paymentId, { txnId: txn.txnId, method: txn.method, raw: obj });
  } else if (!txn.pending) {
    await failPayment(txn.paymentId, obj);
  }
  res.json({ ok: true });
});

/** LiveKit server events. Body must stay raw for the signature check. */
router.post("/webhooks/livekit", express.raw({ type: "*/*" }), async (req, res) => {
  if (!webhookReceiver) return void res.status(404).end();
  let event;
  try {
    event = await webhookReceiver.receive(req.body.toString("utf8"), req.headers.authorization);
  } catch {
    return void res.status(401).end();
  }
  if (event.event === "egress_ended" && event.egressInfo) {
    const info = event.egressInfo;
    const file = info.fileResults?.[0];
    const rec = await db.query.recordingsTable.findFirst({ where: eq(recordingsTable.egressId, info.egressId) });
    if (rec) {
      const url = recordingUrl(file?.filename, file?.location);
      const ok = Boolean(url) && !info.error;
      await db
        .update(recordingsTable)
        .set({
          status: ok ? "ready" : "failed",
          url,
          // LiveKit reports nanoseconds.
          durationSec: file?.duration ? Math.round(Number(file.duration) / 1e9) : null,
          readyAt: ok ? new Date() : null,
        })
        .where(eq(recordingsTable.id, rec.id));
      if (ok) await announceRecording(rec.lectureId);
      else logger.error({ egressId: info.egressId, error: info.error }, "Recording failed");
    }
  }
  if (event.event === "room_finished" && event.room) {
    const lectureId = lectureIdFromRoom(event.room.name);
    if (lectureId) logger.info({ lectureId }, "LiveKit room finished");
  }
  res.json({ ok: true });
});

export default router;
