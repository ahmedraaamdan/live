/**
 * Every setting the API reads, in one place. Integrations that aren't
 * configured switch off cleanly (payments fall back to the mock gateway in
 * development, live/recording report "not configured", mail goes to the
 * local outbox) so the app runs end to end on a laptop with no accounts.
 */
// Relative paths resolve against the working directory: the package scripts
// run in artifacts/api-server; the Docker image sets each one explicitly.
import path from "node:path";

const str = (key: string, fallback = "") => (process.env[key] ?? fallback).trim();
const num = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && process.env[key] !== "" && process.env[key] !== undefined ? v : fallback;
};
const list = (key: string) =>
  str(key)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const isProd = process.env.NODE_ENV === "production";

const paymentProvider = str("PAYMENT_PROVIDER", isProd ? "paymob" : "mock") as "mock" | "paymob" | "easykash";
if (!["mock", "paymob", "easykash"].includes(paymentProvider)) throw new Error("Unsupported PAYMENT_PROVIDER");
if (isProd && paymentProvider === "mock") {
  throw new Error("PAYMENT_PROVIDER=mock is not allowed in production.");
}

export const env = {
  isProd,
  port: num("PORT", 8080),
  /** Where people open the app; links in emails point here. */
  appUrl: str("APP_URL", "http://localhost:5174").replace(/\/$/, ""),
  /** Public base of this API, for gateway webhooks. */
  apiUrl: str("API_URL", "http://localhost:8080").replace(/\/$/, ""),
  corsOrigins: [
    ...list("CORS_ORIGINS"),
    // The Capacitor shells load the app from these origins.
    "capacitor://localhost",
    "https://localhost",
    "http://localhost",
    "http://localhost:5174",
  ],
  superAdminEmails: list("SUPER_ADMIN_EMAILS").map((e) => e.toLowerCase()),
  adminEmails: list("ADMIN_EMAILS").map((e) => e.toLowerCase()),
  feeBps: num("PLATFORM_FEE_BPS", 1000),
  payoutHoldHours: num("PAYOUT_HOLD_HOURS", 24),
  migrationsFolder: str("MIGRATIONS_DIR") || path.resolve("../../lib/db/drizzle"),
  pgliteDir: str("PGLITE_DIR") || path.resolve(".data/pglite"),
  uploadDir: str("UPLOAD_DIR") || path.resolve(".data/uploads"),
  outboxDir: path.resolve(".data/outbox"),
  /** If set, the API also serves the built app (single origin in production). */
  appDist: str("APP_DIST"),

  payment: {
    provider: paymentProvider,
    easykash: { apiKey: str("EASYKASH_API_KEY"), hmacSecret: str("EASYKASH_HMAC_SECRET"), baseUrl: isProd ? "https://back.easykash.net" : str("EASYKASH_BASE_URL", "https://back.easykash.net") },
    paymob: {
      baseUrl: str("PAYMOB_BASE_URL", "https://accept.paymob.com").replace(/\/$/, ""),
      secretKey: str("PAYMOB_SECRET_KEY"),
      publicKey: str("PAYMOB_PUBLIC_KEY"),
      hmacSecret: str("PAYMOB_HMAC_SECRET"),
      /** Card, wallet, Apple Pay and Google Pay integration ids from the Paymob dashboard. */
      integrationIds: list("PAYMOB_INTEGRATION_IDS").map(Number).filter(Number.isFinite),
    },
  },

  livekit: {
    maxParticipants: num("LIVE_MAX_PARTICIPANTS", 0),
    maxRooms: num("LIVE_MAX_ROOMS", 0),
    url: str("LIVEKIT_URL"),
    apiKey: str("LIVEKIT_API_KEY"),
    apiSecret: str("LIVEKIT_API_SECRET"),
  },

  /** S3-compatible bucket (Cloudflare R2, AWS S3…) for lecture recordings. */
  recordings: {
    endpoint: str("RECORDING_S3_ENDPOINT"),
    region: str("RECORDING_S3_REGION", "auto"),
    bucket: str("RECORDING_S3_BUCKET"),
    accessKey: str("RECORDING_S3_ACCESS_KEY"),
    secret: str("RECORDING_S3_SECRET"),
    /** Public (or CDN) base URL the bucket's files are served from. */
    publicBase: str("RECORDING_PUBLIC_BASE").replace(/\/$/, ""),
  },

  security: {
    mfaEncryptionKey: str("MFA_ENCRYPTION_KEY"),
    googleClientId: str("GOOGLE_CLIENT_ID"), googleClientSecret: str("GOOGLE_CLIENT_SECRET"),
    facebookAppId: str("META_APP_ID"), facebookAppSecret: str("META_APP_SECRET"),
    facebookVersion: str("META_GRAPH_VERSION", "v23.0"),
    brokerUrl: str("SOCIAL_BROKER_URL"),
  },
  mail: {
    host: str("SMTP_HOST"),
    port: num("SMTP_PORT", 465),
    user: str("SMTP_USER"),
    pass: str("SMTP_PASS"),
    from: str("MAIL_FROM", "Gahez Live <support@gahez.space>"),
  },
};

export const liveConfigured = Boolean(env.livekit.url && env.livekit.apiKey && env.livekit.apiSecret);
export const recordingConfigured =
  liveConfigured && Boolean(env.recordings.bucket && env.recordings.accessKey && env.recordings.secret);
export const mailConfigured = Boolean(env.mail.host && env.mail.user && env.mail.pass);

export const paymentConfigured = env.payment.provider === "mock" || (env.payment.provider === "easykash" ? Boolean(env.payment.easykash.apiKey && env.payment.easykash.hmacSecret) : Boolean(env.payment.paymob.secretKey && env.payment.paymob.publicKey && env.payment.paymob.hmacSecret && env.payment.paymob.integrationIds.length));
