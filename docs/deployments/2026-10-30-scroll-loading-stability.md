# Scrollbar and loading stability — 30 October 2026

Frontend only. Root html reserves a permanent thin scroll lane, with brand-red thumbs for native scrollbars. The thumb still follows ordinary native scrolling; no scripted fake scrollbar or scroll interception is introduced. OS overlay-scrollbar visibility remains controlled by the OS/browser, but overlay scrollbars do not change the content width.

AppShell now lives above the page Suspense boundary for authenticated destinations, including the home redirect. This preserves the rail/bottom bar and decorative shell while a new lazy page loads. Authed still enforces session and role access and no longer mounts a separate shell for each route. Live, payment, authentication and shared public lecture pages retain their standalone layout.

Removed the whole-page entry opacity/translation animation. Scroll restoration and collapsed-header measurement use layout effects so their initial state is applied before paint. Full-page loading uses a stable skeleton; the optional spinner waits 180ms and its timer is cleaned up on unmount.

Verification: app TypeScript and production build succeeded; inspected route classification for all authenticated groups and standalone/public paths, single shell ownership and fallback placement. A fresh interactive browser check remains unavailable because the browser automatic approval check previously failed on usage limits; no alternate browser control was used to bypass it. Backend health is checked after the rollout. No streaming transport change or native platform generation is part of this deployment.

Source archive SHA256: 6cc412b4d43b0c1a3a9dbba96653dbb16c5d63db7ca1c44957e1cf9a4c4e5a5f.
Rollback image: live-app-app:before-scroll-loading-20261030.
Server source backup: /tmp/live-app-before-scroll-loading-20261030.tar.gz.
App is recreated with --no-deps; databases, uploads and gateway/media environment are retained.

Current platform evidence: React/Vite web client and Capacitor config/plugins are present. No android/ or ios/ native project directory exists in artifacts/live-app. Android Studio / macOS with Xcode project generation, device permissions, signing and real device validation are still required before claiming tested store binaries.

YouTube research (no integration deployed): official policies prohibit charging to watch content in an embedded YouTube player; unlisted URLs can be reshared. YouTube is a potential distribution option for free public lessons, not a private-paywall replacement.
- https://developers.google.com/youtube/terms/developer-policies
- https://support.google.com/youtube/answer/157177
- https://support.google.com/youtube/answer/9228390

Published image manifest: 30f7d5621680cdc7564ee304ba59d3020d4530042c3aff850baa062cc8ec2ff2. Container healthy.
