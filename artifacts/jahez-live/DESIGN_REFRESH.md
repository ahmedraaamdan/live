# Gahez Live — Studio redesign

Implemented locally in the existing React/Vite application. The approved Arabic copy and public routes are retained.

- New home composition: oversized Arabic type, working lesson demo, subject index, animated course discovery, sticky booking chapters, teacher directory, teaching workspace, app availability, FAQ and final invitation.
- Framer Motion drives text entrance, viewport reveals, pointer tilt, scroll-linked classroom movement, reading progress and filtered-card transitions. CSS supplies the sticky chapter stack. Reduced motion disables spatial effects.
- The shared design refresh covers navigation, footer, catalogues, content pages and forms. Student and teacher pages have their own classroom/workspace compositions.
- Light and dark appearance follows the system until the visitor chooses a preference. The choice is retained locally.
- Cairo and Space Grotesk WOFF2 fonts are self-hosted; licenses are in public/fonts.
- Marketing sample data is explicitly labeled. Booking still follows the existing registration flow; no backend or payment behavior was changed.
- Generated SEO titles/descriptions now read the same route manifest as the browser.

Validation: TypeScript, production client/SSR builds and 14 prerendered routes; browser review at desktop, 390px and 320px; lesson tab switching and answer reveal; home subject filtering; catalog empty search state; mobile navigation; FAQ expansion; light/dark switching; no horizontal page overflow at the smallest tested size.

A Lighthouse performance score was not measured. No public deployment was performed.


## Current direction — 30 October 2026
The current reference-inspired design uses Live red, warm paper, Lalezar headings, Readex Pro body, original G + Gahez + Live lockup, black outlines and offset shadows. See src/styles/playful.css for current overrides. Generated hero and fictional teacher illustrations are in public/images. Light is the default; explicit theme choices are respected. Content-protection UI is a casual-copy deterrent, not DRM.
