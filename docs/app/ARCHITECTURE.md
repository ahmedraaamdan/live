# Gahez Live app: architecture

One codebase for web, Android and iOS. The marketing site
(`artifacts/jahez-live`, live.gahez.space) is separate and unchanged.

```
artifacts/live-app      React 19 + Vite + Tailwind 4 SPA; Capacitor 8 shells for Android/iOS
artifacts/api-server    Express 5 API (also serves the built app in production)
lib/live-core           Shared contract: constants, zod request schemas, response types, board model
lib/db                  Drizzle schema + SQL migrations (Postgres; PGlite in local dev)
docs/app                Plan, ranking design, this file
```

## Decisions

| Decision | Why |
|---|---|
| **Capacitor**, not React Native | The app *is* the web app; the shells add camera/mic permissions, deep links, the system browser for payments and (next) push. One UI, one test surface. |
| **LiveKit** for video | Open source WebRTC SFU with a cloud option: start on LiveKit Cloud, self-host later without code changes. Room-composite **egress** records to S3/R2. Works in Android WebView and iOS WKWebView (14.3+). |
| Q&A, attendance and the whiteboard go through **our API + SSE**, not LiveKit data channels | They're stored (questions answered after class, board review, attendance reports) and keep working if the video provider changes. One event stream per lecture (`GET /api/lectures/:id/events`). |
| **Paymob** Intention API + Unified Checkout | One hosted page for cards, mobile wallets (Vodafone Cash, Orange, e&, WE), Apple Pay and Google Pay in Egypt. The webhook (HMAC-SHA512 verified) is the only thing that confirms a payment; the redirect back only triggers polling. |
| **Ledger**, not a balance column | `wallet_entries` is append-only: each paid booking writes the teacher's 90% and the platform's 10%, *pending* until `PAYOUT_HOLD_HOURS` after the lecture, then *available*. Payouts debit at request time; refunds void or reverse. Balances are sums. |
| **Bearer tokens** (opaque, SHA-256 stored), not cookies | Same auth on web and inside the shells, where third-party cookies are unreliable. Revocable per device; a password reset signs out everywhere. |
| **Shared contract package** instead of OpenAPI codegen | The repo's Orval scaffold only had a health check. `@workspace/live-core` gives the API and the app the same zod schemas and types with no generation step. |
| **PGlite** when `DATABASE_URL` is unset (dev only) | The whole product runs on a laptop with no database or Docker. Production refuses to start without Postgres. |
| Integrations **switch off cleanly** | No LiveKit keys → studio shows a local camera preview and a notice; no SMTP → mail goes to `.data/outbox` (listed at `/api/dev/outbox`); `PAYMENT_PROVIDER=mock` → an in-app test checkout (refused in production). |

## Main flows

**Booking:** teacher creates a lecture → share link `/l/:code` (WhatsApp) →
student signs up / in → `POST /lectures/:id/book` → Paymob checkout (system
browser in the shells) → webhook → `confirmPayment` (idempotent, row-locked)
→ booking confirmed, ledger entries, emails to student **and parent**,
notifications to student, parents and teacher.

**Live:** teacher opens the studio up to 30 min early → `live/start` (room
created, recording started, students notified by email + in-app) → students
join with a subscribe-only token; their app sends a heartbeat every 30 s
(attendance) → questions/answers/board ops stream over SSE → `live/end`
stops the recording → LiveKit webhook marks it ready → students notified.

**Whiteboard:** vector ops (`lib/live-core/src/board.ts`) in a fixed
1600×900 space. The teacher's app applies ops locally and batches them to
`POST /lectures/:id/board` every ~60 ms; the API stores durable ops and
relays all of them (drafts and the laser pointer are relay-only). Viewers
render crisp vectors at any size; late joiners replay `GET /board`. The
canvas is also published to LiveKit as a screen-share track so the
recording includes it.

**Feed ranking:** see [RANKING.md](RANKING.md).

## Scaling notes

- SSE fan-out and the scheduler are in-process: fine for one API instance
  (thousands of concurrent viewers). For several instances, put
  Postgres `LISTEN/NOTIFY` or Redis behind `lib/events.ts#publish` and run
  the scheduler in one instance (`SCHEDULER=off` elsewhere).
- Uploads are on a volume (`UPLOAD_DIR`); move `lib/storage.ts` to R2 when
  homework photos outgrow one disk.
- The main JS bundle is ~190 KB gzipped; LiveKit (~157 KB) loads only in
  the live room. Route-level splitting is a week-4 task.

## Security checklist (state today)

- Passwords: scrypt with per-user salt. Sessions: 256-bit random tokens, stored hashed.
- Every lecture resource checks ownership/booking (`lib/access.ts`); recordings' URLs are only sent to people who may watch.
- Paymob webhook: HMAC verified with a constant-time compare; amounts come from our DB, never the client.
- Upload URLs are unguessable UUIDs (an `<img>` can't send a bearer token); move to signed, expiring URLs with R2.
- To do before launch: rate limiting on auth and booking, email verification, audit log for admin actions.
