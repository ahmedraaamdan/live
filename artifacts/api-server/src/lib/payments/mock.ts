/**
 * Development gateway: "checkout" is a page in the app (/dev/pay/:id) with
 * a button per payment method that calls POST /api/payments/mock/:id/complete.
 * Refused in production by env.ts.
 */
import { env } from "../env";
import type { PaymentProvider } from "./provider";

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout({ payment }) {
    return { checkoutUrl: `${env.appUrl}/dev/pay/${payment.id}`, providerRef: `mock_${payment.id}` };
  },
  async refund() {
    // Nothing to call: the mock never took real money.
  },
};
