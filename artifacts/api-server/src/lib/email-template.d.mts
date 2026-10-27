// Types for the vendored GAHEZ email template (email-template.mjs).
export interface EmailLink {
  label: string;
  url: string;
}

export interface EmailOptions {
  product?: "gahez" | "agent" | "tools" | "live" | "academy" | "sticky";
  robot?: "hero" | "phone" | "desk" | "dance" | null;
  preheader?: string;
  title: string;
  /** HTML allowed: escape user input with esc(). */
  intro?: string;
  rows?: Array<[string, string]>;
  body?: string;
  cta?: EmailLink;
  secondary?: EmailLink;
  note?: string;
  lang?: "ar" | "en";
}

export function renderEmail(opts: EmailOptions): { html: string; text: string };
export function esc(s: unknown): string;
