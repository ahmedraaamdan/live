import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@workspace/live-core";
import { env } from "../env";
import type { PaymentProvider } from "./provider";

export class EasykashValidationError extends Error {
  readonly code = "mobile_invalid";
  constructor() { super("رقم الهاتف غير صالح للدفع. حدّثه من صفحة حسابي ثم حاول مجددًا."); }
}
export const easykashReference = (id: string) => `glive_${id}`;
export function easykashPaymentId(reference: unknown): string | null {
  const m = /^glive_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(String(reference ?? ""));
  return m?.[1] ?? null;
}
export function easykashAmountCents(value: unknown): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const cents = BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0"));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
export function verifyEasykashCallback(body: Record<string, unknown>, secret = env.payment.easykash.hmacSecret): boolean {
  if (!secret || !/^[a-f0-9]{128}$/i.test(String(body.signatureHash ?? ""))) return false;
  const fields = ["ProductCode", "Amount", "ProductType", "PaymentMethod", "status", "easykashRef", "customerReference"];
  if (fields.some(k => typeof body[k] !== "string" && typeof body[k] !== "number")) return false;
  const expected = createHmac("sha512", secret).update(fields.map(k => String(body[k])).join("")).digest();
  return timingSafeEqual(expected, Buffer.from(String(body.signatureHash), "hex"));
}
export function easykashMethod(value: unknown): PaymentMethod | undefined {
  const method = String(value ?? "").toLowerCase();
  return method.includes("wallet") ? "wallet" : method.includes("apple") ? "apple_pay" : method.includes("cash") || method.includes("fawry") || method.includes("aman") ? "cash" : method.includes("card") || method.includes("meeza") ? "card" : undefined;
}
async function request(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(env.payment.easykash.baseUrl + path, { method: "POST", headers: { Authorization: env.payment.easykash.apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
  const data = await res.json().catch(() => null);
  if (Array.isArray(data) && data.some((e: { field?: string }) => e?.field === "mobile")) throw new EasykashValidationError();
  if (!res.ok || !data || typeof data !== "object" || Array.isArray(data)) throw new Error(`EasyKash request failed (${res.status})`);
  return data as Record<string, unknown>;
}
export const inquireEasykash = (id: string) => request("/api/cash-api/inquire", { customerReference: easykashReference(id) });
export const easykashProvider: PaymentProvider = {
  name: "easykash",
  async createCheckout({ payment, lecture, payer }) {
    if (!payer.phone?.trim()) throw new Error("A customer phone number is required");
    const data = await request("/api/directpayv1/pay", { amount: payment.amountCents / 100, currency: "EGP", cashExpiry: 1, name: payer.name, email: payer.email, mobile: payer.phone, customerReference: easykashReference(payment.id), redirectUrl: `${env.appUrl}/checkout/${payment.id}`, productName: `جاهز — ${lecture.title}` });
    const url = new URL(String(data.redirectUrl ?? ""));
    if (url.protocol !== "https:" || !(url.hostname === "easykash.net" || url.hostname.endsWith(".easykash.net"))) throw new Error("Unexpected EasyKash checkout host");
    return { checkoutUrl: url.toString(), providerRef: data.easykashRef ? String(data.easykashRef) : null };
  },
  async refund() { throw new Error("EasyKash refund requires merchant-dashboard review; never mark refunded without provider confirmation"); },
};
