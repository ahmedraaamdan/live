# Lesson and mobile app visual refresh — 30 October 2026

Scope: frontend only. Public lecture page rebuilt with a light brand header, subject artwork, clear booking card, countdown, teacher details and mobile booking bar. Authenticated lecture header shares the artwork. Recording copy no longer promises automatic recording when it is disabled; the student page only displays a recording section when one exists.

The public /design route and its lazy import were removed, along with the account link. The gallery is not emitted as a production chunk. The private source remains available for developer reference but is not a user destination.

Mobile layer: low-opacity subject sketches behind shell pages, compact home illustrations, a next-lecture ticket motif, softer card outlines/shadows on phones, rounded bottom navigation, 44px control targets and 16px editable text to avoid mobile input zoom. Motion uses transforms: short screen entry and tab feedback, two gentle illustration cycles; prefers-reduced-motion receives no decorative animation. Live media pages remain outside the authenticated shell.

No new external library, generated teacher portrait, payment integration change, database migration or production test account. Artwork uses the existing Lucide family and brand tokens. Theme choice remains in account settings; only the internal design gallery is removed.

Verification: latest TypeScript passed. Production build compiles both app and API. Before the browser limit was reached, the public lesson was visually checked on desktop and at 390px, with no horizontal overflow, and the authenticated student header was inspected on desktop. The final wallpaper/navigation additions were checked by source/types/build, not by a new browser screenshot: automatic browser approval failed on usage limits, and no alternative browser automation was used to bypass that gate.

Final incremental source archive SHA256: 16360e43ecb3b7917abb589e5f71f550839ecba4a894b687ab05f08c40d7f3f0.
Rollback image: live-app-app:before-mobile-ui-20261030 (already includes the rebuilt lesson page).
Original pre-lesson image: live-app-app:before-lesson-layout-20261030.
Server-only source backups: /tmp/live-app-before-mobile-ui-20261030.tar.gz and /tmp/live-app-before-lesson-layout-20261030.tar.gz.
Deployment restarts only app using --no-deps, preserving gateway/media environment, databases and uploads.

Final image manifest: f5fb5fc32d9255b195d455b7a6549817ce45262e17ee5790b5668dd665aae69f.
