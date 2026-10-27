import { env } from "../env";
import { mockProvider } from "./mock";
import { paymobProvider } from "./paymob";
import type { PaymentProvider } from "./provider";

export const provider: PaymentProvider = env.payment.provider === "paymob" ? paymobProvider : mockProvider;
