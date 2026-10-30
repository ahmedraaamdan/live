# Owner switching deployment — 30 October 2026

Source SHA256: b57e2227c5b57412ea901665e718232413bf3e4a983afce3924e47a346f38cf9.
Previous image: live-app-app:before-account-switch-20261030.
Server-only database backup: /tmp/live-app-before-account-switch-20261030.dump (custom format, pg_restore --list verified, restrictive umask).
Server source backup: /tmp/live-app-source-before-account-switch-20261030.tar.gz.

App alone is recreated with --no-deps. Gateway, LiveKit pilot, database and uploads remain configured. Migration 0005 is additive. See ../app/ACCOUNT_SWITCHING.md for authorization, tests and the delegated-session revocation required before rolling back to older auth code.

PostgreSQL test used a fresh tmpfs database in an internal Docker network, an explicit audit-only database hostname/name, no published database port, no production volumes and no real credentials. Its container/network were removed by the cleanup trap. The temporary build-stage image is only for testing TypeScript against PostgreSQL, not the running app image.

Published image manifest: 7c49c5af58555a1a21bb4b4ca26b14da33262ba95e07cbaf901be68fe967f42d. Container health passed.
