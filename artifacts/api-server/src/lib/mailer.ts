/**
 * Outgoing mail over SMTP (Zoho, the same mailbox as the marketing site).
 * Without SMTP settings every message is written to .data/outbox as an
 * .html file instead, so development shows exactly what would have gone out
 * (listed at GET /api/dev/outbox).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { env, mailConfigured } from "./env";
import { logger } from "./logger";

export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

const transport = mailConfigured
  ? nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.port === 465,
      auth: { user: env.mail.user, pass: env.mail.pass },
    })
  : null;

/** Never throws: a failed email must not fail the booking that caused it. */
export async function sendMail(mail: Mail): Promise<void> {
  const to = (Array.isArray(mail.to) ? mail.to : [mail.to]).filter(Boolean);
  if (to.length === 0) return;
  try {
    if (transport) {
      await transport.sendMail({ from: env.mail.from, ...mail, to });
      logger.info({ to, subject: mail.subject }, "Mail sent");
      return;
    }
    await mkdir(env.outboxDir, { recursive: true });
    const slug = `${new Date().toISOString().replace(/[:.]/g, "-")}-${to[0]!.replace(/[^a-z0-9]+/gi, "_")}`;
    const header = `<!-- to: ${to.join(", ")} | subject: ${mail.subject} -->\n`;
    await writeFile(path.join(env.outboxDir, `${slug}.html`), header + mail.html, "utf8");
    logger.info({ to, subject: mail.subject }, "Mail written to outbox (SMTP not configured)");
  } catch (err) {
    logger.error({ err, to, subject: mail.subject }, "Mail failed");
  }
}
