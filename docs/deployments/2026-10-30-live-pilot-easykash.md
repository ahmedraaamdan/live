# Live pilot and shared EasyKash — 30 October 2026

Source archive SHA256: 9e3bac4f251c9f77fd3463b0b206b4063770632c60e3c697717e0c63f2f4084f.
Live image manifest: 5a01d0e03c3191abe7d1d9f6f7fb9d22a41a8e6c481b9db96924b8057e21f48e.
Agent image manifest: 36ea4879d4f2478f38c0beabd84b38f7c1f7849e0a0bdb62d637167fe8afcb51.

Server-only recovery snapshots:
- /tmp/live-app-before-easykash-20261030.dump (custom-format PostgreSQL; pg_restore --list verified)
- /tmp/live-app-source-before-easykash-20261030.tar.gz
- live-app-app:before-easykash-20261030 (includes working media pilot)
- /srv/live-app/.env.app.before-easykash-20261030 (private; preserve LiveKit when rolling back payments)
- agent-web:before-live-callback-20261030 and the two original callback/core files in /tmp

Migration 0004 is additive only. Roll back application code/environment without dropping columns or restoring the entire database. Restart only Live app / Agent web with --no-deps; retain the existing PostgreSQL, worker, Redis and upload volumes. Agent has only two scoped source edits, no schema changes. The patch is kept under infra/payments for later source-controlled deployment.

Media pilot is already verified with an external browser receiving actual synthetic video. No recording, new streaming subscription or VPS purchase. Limits: one live class, 25 student viewers plus the teacher; no 100-student capacity claim. Secret keypair remains only in private server files.

No real checkout, charge, customer email or production test account is created by verification. A real bank transaction remains untested. Merchant account authorization was probed with an empty validation-only request; current key reached validation and the no-key control returned 401. Merchant display name is not changed by this deployment.

The isolated PostgreSQL suite includes the existing 54 API cases, five pilot limits, four readiness guards and 21 fake-EasyKash cases. The temporary database uses tmpfs and an internal network with no published ports or production volumes/credentials. Unit tests and signature compatibility tests run separately. Docker build excludes local .data, nested environment files, tmp and source archives.

## Completed verification after rollout

Live app and Agent web were recreated independently with --no-deps. Both starts passed; Live app is healthy, Agent worker / PostgreSQL / Redis retained their prior uptimes. Public marketing, Live app and Agent return HTTP 200. Live API and HTML return Cache-Control: no-store.

Public config after private credential merge: liveConfigured=true, paymentConfigured=true, recordingConfigured=false, liveParticipantLimit=26, liveRoomLimit=1. Credentials were read and copied inside the server process, never printed or downloaded. The existing account callback setting was preserved.

Signed requests for intentionally nonexistent references verified routing: Live SHA-512 -> 404 unknown payment; forged Live signature -> 403; Agent current SHA-512 and legacy SHA-256 -> 404 unknown reference. No invoice or subscription was created or charged.

Post-migration safe aggregate checks: users/bookings/assignments/submissions remain 3/1/0/0. Four expected additive columns from migrations 0003 and 0004 exist. No student answers or financial transaction contents were read for these checks. All 84 API checks passed on the final image in isolated PostgreSQL17; temporary test containers and network were removed.
