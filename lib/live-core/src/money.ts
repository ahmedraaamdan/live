/**
 * Money is always an integer number of piasters (1 EGP = 100 piasters),
 * named `…Cents` across the codebase. Never store or add floats.
 */

/** Platform share of every paid booking, in basis points (1000 = 10%). */
export const DEFAULT_PLATFORM_FEE_BPS = 1000;

export function splitBooking(priceCents: number, feeBps: number = DEFAULT_PLATFORM_FEE_BPS) {
  const platformCents = Math.round((priceCents * feeBps) / 10_000);
  return { platformCents, teacherCents: priceCents - platformCents };
}

const egp = new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** "150 ج.م" — Latin digits, which Egyptian apps and receipts use. */
export function formatEGP(cents: number): string {
  return `${egp.format(cents / 100)} ج.م`;
}

export function egpToCents(egpAmount: number): number {
  return Math.round(egpAmount * 100);
}
