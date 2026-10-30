# Owner account switching

The existing administrator whose email is in SUPER_ADMIN_EMAILS may switch to any other account. If the optional list is empty, ADMIN_EMAILS is the operator-owner fallback. The administrator role and an active account are both required; public signup cannot grant either authority. Production preflight matched exactly one existing active administrator without printing its contact details.

Top-bar controls: Switch account / Sign out. Search accepts name, email or phone across all roles. Selecting a result opens the real target account without its password. During delegation the switch control becomes Return, and a persistent account banner identifies the target and offers Return even in standalone screens. Suspended accounts can be inspected by the owner, while ordinary suspended-account login stays blocked. Nested switching is rejected.

Sessions: the original admin token stays in its existing browser storage. A separate one-hour target token is kept in sessionStorage for the current tab. The server stores only token hashes and links the delegation to the original session. Every request rechecks that the parent session exists, is unexpired, and belongs to an active allowlisted administrator. Revoking that session, suspending the owner or removing the role invalidates delegation. Search and switching never use a browser-provided owner flag as authority.

Return revokes the target token and returns only {ok:true}; it never exchanges a target token for an admin token. The browser must retain the original owner session. Queries are cancelled/cleared at an identity change, active mutations defer switching, and a local lock prevents overlapping switches. An expired child restores the original session with a fresh /me query. Late 401 responses from an older identity cannot erase the newer identity.

Sign out while delegated revokes the original parent and its child access; other independent administrator sessions and the real target user's sessions remain unaffected. Passwords are never changed or disclosed.

Audit: account_switches retains actor/target IDs and start/end timestamps. Structured server logs attribute delegated write requests to both actor and target, with method, path and status. Logs do not include bearer tokens or passwords. No customer email is sent merely for switching.

Migration 0005_big_mockingbird adds account_switches and nullable sessions.actor_token_hash / switch_id. Existing sessions remain compatible. Before deploying save the server-only database/source snapshots and previous image.

Rollback to older authentication code: revoke delegated sessions first (DELETE FROM sessions WHERE actor_token_hash IS NOT NULL), then restore the old image. Keep the additive columns/audit table; do not restore an entire database solely to roll back code. Older authentication code does not understand the parent-session restriction, so do not leave delegated tokens active across a rollback.

Verification: 38 security checks passed on isolated PGlite and PostgreSQL17. Nine client token-isolation checks passed using an in-memory storage/fetch unit harness (no browser control). The 54 baseline API checks and 13 existing payment/ledger unit cases passed. App/API typechecks and builds passed. No production target account was impersonated for testing and no financial transaction, email or production test account was created. A fresh visual browser pass was unavailable due to the existing automatic-review usage limit.
