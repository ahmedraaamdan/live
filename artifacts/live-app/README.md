# Gahez Live app

Teacher, student, parent and admin app: web first, the same build wrapped
for Android and iOS with Capacitor. Architecture: [docs/app/ARCHITECTURE.md](../../docs/app/ARCHITECTURE.md) ·
plan: [docs/app/PLAN.md](../../docs/app/PLAN.md) · design: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Run it locally (no accounts, no database to install)

Two terminals from the repository root:

```bash
# 1. API on :8080: embedded Postgres (PGlite), mock payments, mail to .data/outbox
ADMIN_EMAILS=admin@gahez.space pnpm --filter @workspace/api-server run dev:watch

# 2. App on :5174 (proxies /api to :8080)
pnpm --filter @workspace/live-app run dev
```

Open http://localhost:5174. For a lively demo (teachers, a student, a
parent, an admin, live classes with votes and attendance, homework, a
recording), with the API running:

```bash
pnpm --filter @workspace/api-server run seed:demo   # prints the demo logins
pnpm --filter @workspace/api-server run smoke       # 25-step end-to-end check
```

Useful while developing: `/design` (the design system), `/api/dev/outbox`
(every email the app would have sent).

> Windows: the lockfile targets the Linux build machine and strips other
> platforms' native binaries. To run locally on Windows, remove the four
> `win32-x64` lines from `pnpm-workspace.yaml` overrides, `pnpm install`, and
> don't commit that change (restore the file and run
> `pnpm install --lockfile-only` before committing).

## Real integrations

Set these on the API (see [.env.app.example](../../.env.app.example)):
Paymob (`PAYMENT_PROVIDER=paymob`, keys, integration ids, HMAC secret),
LiveKit (`LIVEKIT_URL`, key, secret), R2 for recordings, Zoho SMTP. Each
one left empty switches off cleanly.

## Mobile apps (Capacitor)

```bash
cd artifacts/live-app
VITE_API_URL=https://app.live.gahez.space VITE_PUBLIC_APP_URL=https://app.live.gahez.space pnpm run build
npx cap add android     # once; needs Android Studio
npx cap add ios         # once; needs a Mac with Xcode
npx cap sync
npx cap open android    # or ios
```

Then, in the native projects (once):

- **Android** `AndroidManifest.xml`: `CAMERA`, `RECORD_AUDIO`,
  `MODIFY_AUDIO_SETTINGS` permissions; an intent filter for
  `https://app.live.gahez.space` (App Links) and the `gahezlive` scheme.
- **iOS** `Info.plist`: `NSCameraUsageDescription`,
  `NSMicrophoneUsageDescription` (Arabic text), `UIBackgroundModes: audio`;
  Associated Domains `applinks:app.live.gahez.space`.

Payments open in the system browser (`@capacitor/browser`) because Apple
Pay doesn't run inside a WebView; read the App Store payment rule in
[docs/app/PLAN.md](../../docs/app/PLAN.md) before submitting.

## Deploy

`cd /srv/live-app && git pull && docker compose --env-file .env.app -f docker-compose.app.yml up -d --build`
on the server (its own checkout, separate from the site's /srv/live; API + built
app in one container, plus Postgres; migrations
run on start). Point Caddy's `app.live.gahez.space` at `live-app:8080`.
