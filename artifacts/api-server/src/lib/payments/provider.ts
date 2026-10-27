import type { Lecture, Payment, User } from "@workspace/db";

export interface CheckoutInput {
  payment: Payment;
  lecture: Lecture;
  payer: User;
}

/**
 * A payment gateway. The student is sent to `checkoutUrl`; the gateway
 * later tells the API the outcome (webhook for Paymob, a button for the
 * mock), which ends in payments.confirmPayment / failPayment.
 */
export interface PaymentProvider {
  name: "mock" | "paymob";
  createCheckout(input: CheckoutInput): Promise<{ checkoutUrl: string; providerRef: string | null }>;
  refund(payment: Payment): Promise<void>;
}
