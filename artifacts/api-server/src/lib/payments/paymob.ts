/**
 * Paymob (Egypt) through the Intention API and Unified Checkout: one hosted
 * page that offers every method enabled on the account (cards, mobile
 * wallets such as Vodafone Cash, Apple Pay, Google Pay), chosen by the
 * integration ids in PAYMOB_INTEGRATION_IDS.
 *
 *   1. POST /v1/intention/ with the amount → client_secret
 *   2. send the student to /unifiedcheckout/?publicKey=…&clientSecret=…
 *   3. Paymob POSTs the transaction to notification_url (our webhook, HMAC
 *      signed) and sends the student back to redirection_url (the app's
 *      return page, which polls our API: the redirect itself proves nothing).
 *
 * Docs: https://developers.paymob.com/paymob-docs/developers/intention-apis/overview
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@workspace/live-core";
import { env } from "../env";
import { logger } from "../logger";
import type { PaymentProvider } from "./provider";

const cfg = env.payment.paymob;

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] || "Student", last: parts.slice(1).join(" ") || "Gahez" };
}

export const paymobProvider: PaymentProvider = {
  name: "paymob",

  async createCheckout({ payment, lecture, payer }) {
    if (!cfg.secretKey || !cfg.publicKey || cfg.integrationIds.length === 0) {
      throw new Error("Paymob is not configured (PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, PAYMOB_INTEGRATION_IDS).");
    }
    const { first, last } = splitName(payer.name);
    const body = {
      amount: payment.amountCents,
      currency: "EGP",
      payment_methods: cfg.integrationIds,
      items: [{ name: lecture.title.slice(0, 50), amount: payment.amountCents, description: "Gahez Live lecture", quantity: 1 }],
      billing_data: {
        first_name: first,
        last_name: last,
        email: payer.email,
        phone_number: payer.phone || "+201000000000",
        apartment: "NA",
        floor: "NA",
        street: "NA",
        building: "NA",
        city: "NA",
        state: "NA",
        country: "EG",
      },
      customer: { first_name: first, last_name: last, email: payer.email },
      special_reference: payment.id,
      notification_url: `${env.apiUrl}/api/webhooks/paymob`,
      redirection_url: `${env.appUrl}/checkout/${payment.id}`,
      extras: { payment_id: payment.id, lecture_id: lecture.id },
    };
    const res = await fetch(`${cfg.baseUrl}/v1/intention/`, {
      method: "POST",
        signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Token ${cfg.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; client_secret?: string };
    if (!res.ok || !json.client_secret) {
      logger.error({ status: res.status, json }, "Paymob intention failed");
      throw new Error("Paymob intention failed");
    }
    const url = `${cfg.baseUrl}/unifiedcheckout/?publicKey=${encodeURIComponent(cfg.publicKey)}&clientSecret=${encodeURIComponent(json.client_secret)}`;
    return { checkoutUrl: url, providerRef: json.id ?? null };
  },

  async refund(payment) {
    if (!payment.providerTxnId) throw new Error("No Paymob transaction id to refund");
    const res = await fetch(`${cfg.baseUrl}/api/acceptance/void_refund/refund`, {
      method: "POST",
        signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Token ${cfg.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: payment.providerTxnId, amount_cents: payment.amountCents }),
    });
    if (!res.ok) {
      logger.error({ status: res.status, body: await res.text() }, "Paymob refund failed");
      throw new Error("Paymob refund failed");
    }
  },
};

/** The fields Paymob signs in a "transaction processed" callback, in this order. */
const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];

function pick(obj: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export function verifyPaymobHmac(obj: Record<string, unknown>, hmac: string): boolean {
  if (!cfg.hmacSecret || !hmac) return false;
  const message = HMAC_FIELDS.map((f) => {
    const v = pick(obj, f);
    return v === undefined || v === null ? "" : String(v);
  }).join("");
  const expected = createHmac("sha512", cfg.hmacSecret).update(message).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(hmac.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface PaymobTransaction {
  paymentId: string | null;
  txnId: string;
  success: boolean;
  pending: boolean;
  isRefund: boolean;
  method: PaymentMethod;
}

export function readPaymobTransaction(obj: Record<string, unknown>): PaymobTransaction {
  const order = (obj.order ?? {}) as Record<string, unknown>;
  const extras = ((obj.payment_key_claims as Record<string, unknown> | undefined)?.extra ?? {}) as Record<string, unknown>;
  const src = (obj.source_data ?? {}) as Record<string, unknown>;
  const type = `${src.type ?? ""} ${src.sub_type ?? ""}`.toLowerCase();
  const method: PaymentMethod = type.includes("apple")
    ? "apple_pay"
    : type.includes("google")
      ? "google_pay"
      : type.includes("wallet")
        ? "wallet"
        : "card";
  const ref = (order.merchant_order_id as string | undefined) ?? (obj.special_reference as string | undefined) ?? (extras.payment_id as string | undefined);
  return {
    paymentId: ref ?? null,
    txnId: String(obj.id ?? ""),
    success: obj.success === true || obj.success === "true",
    pending: obj.pending === true || obj.pending === "true",
    isRefund: obj.is_refunded === true || obj.is_refund === true,
    method,
  };
}
