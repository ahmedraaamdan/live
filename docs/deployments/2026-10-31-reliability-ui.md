# Reliability and mobile UI release — 2026-10-31

Deployed app and marketing; Agent, PostgreSQL service, LiveKit and private environment settings were not changed. No database migration.

## Corrections
- Normalize calendar hours across dates and Cairo DST, including a booked 23:00 slot asking for hour 24. A read-only production aggregate found one lesson extending beyond 23:00.
- Synchronize confirmed bookings into detail/public caches before routing; cancel stale requests; deduplicate rapid clicks and recover ambiguous network failures by reading the receipt. Existing confirmed reservations remain idempotent after a lesson closes. Catch asynchronous notification failures.
- Replace flashing placeholder frames with a delayed brand loader; preserve application navigation on route crashes; add bounded authenticated client-error reports.
- Add auth theme controls, application avatar menu and settings shortcut. Replace the marketing phone wireframe with approved hero artwork and improve the teacher section and restrained background animation.

## Validation
API suite: 21 passing tests, including 64 concurrent free-booking requests with 32 students and 8 places. The teacher-tools suite also passed against an isolated disposable PostgreSQL 17 database (37 assertions). Calendar: 13 checks. Booking cache: 4 checks. App/API/marketing typechecks and production builds passed. Mobile visual review at 390px passed. No real payment transaction or production load test was performed.

## Deployment
Runtime base images were built from updated sources. Final app/marketing static assets were layered into persistent images; latest source changes were also copied to both server checkouts. Compose recreated only app and web, both healthy. HTTPS health and both public origins returned 200; no container restarts.

Rollback tags: live-app-app:before-reliability-20261031 and live-web:before-reliability-20261031. Private pre-release database backup: /tmp/live-app-before-reliability-20261031.dump (mode 600). Preserve current MFA-aware authentication; do not use older pre-MFA images.
