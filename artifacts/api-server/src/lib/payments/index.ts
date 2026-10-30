import { easykashProvider } from "./easykash";
import { env } from "../env";
import { mockProvider } from "./mock";
import { paymobProvider } from "./paymob";
import type { PaymentProvider } from "./provider";

export function paymentProviderFor(name: string): PaymentProvider {
  if (name === "easykash") return easykashProvider;
  if (name === "paymob") return paymobProvider;
  if (name === "mock") return mockProvider;
  throw new Error("Unsupported payment provider");
}
export const provider = paymentProviderFor(env.payment.provider);
