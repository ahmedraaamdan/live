# Live visual refresh — 30 October 2026

Marketing and application share Live red, warm paper surfaces, Lalezar headings, Readex Pro text, black outlines and offset shadows. Original G + Gahez + Live lockup is preserved. Fonts are self-hosted with OFL licenses. Generated illustrations are illustrative marketing assets; actual app accounts retain their own avatar or initials.

Light is the default before first paint. An explicitly saved dark preference remains available. Casual copy, selection, context-menu and image dragging are blocked outside editable fields; this is a UI deterrent, not DRM. Explicit share/copy buttons remain functional.

Common app controls, navigation, dashboards, cards, forms, overlays and authentication have been restyled without backend or schema changes. Student, teacher and parent demo sign-in tested against an isolated local database. Production builds and TypeScript checks passed; marketing prerenders 13 routes and a 404 page.


Production deployment: sources transferred only for `artifacts/jahez-live` to `/srv/live`, and `artifacts/live-app` to `/srv/live-app`. Backend, environment, uploads and database sources were preserved. Existing image backups: `live-web:before-playful-20261030`, `live-app-app:before-playful-20261030`. Source backups: `/tmp/live-before-playful-20261030.tar.gz`, `/tmp/app-before-playful-20261030.tar.gz` on server. Database service was not recreated.

Archive SHA256: marketing `56d801ffca2907b1a2a55d1635f5512a39d463d38bd90a729060382f62933f82`; app `c89f68869372ccc17675aa096851c15153b743c4a9a2f59b14c73a60c8b3a341`.

Verified public marketing and app routes, health endpoints, local fonts and hero images return HTTP 200. Published app visually verified at desktop width; light default and copy-deterrent CSS confirmed.
