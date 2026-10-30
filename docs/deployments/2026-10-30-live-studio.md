# Live marketing deployment — 2026-10-30

- URL: https://live.gahez.space/
- Source: local marketing-site changes based on 0196b76.
- Delivery: source archive applied to /srv/live, Docker Compose build, then up --no-build --wait.
- Archive SHA256: 367299e76e49ac25958f4376d39b92b315ea4f8d71f539bdc74f6960e4bfc16d.
- Image: live-web, manifest 48c71e3ebac1b2e3742d251c63612f0b007e9361194039aa3e51cc6027f046df.
- Previous image retained as live-web:before-studio-red-20261030.
- Previous tracked marketing source saved in /tmp/live-before-studio-red-20261030.tar.gz.
- Server .env was preserved. No app backend or payment changes were deployed.
- HTTPS checks passed for /, /classes, /teachers, /for-students, /for-teachers, /faq, /contact, /healthz and the Arabic WOFF2 font.
- Confirmed the new studio-home markup and #e11d48 identity in the public production stylesheet.
- GitHub was not synchronized: the local gh authentication is invalid. The deployed source is currently a working-tree change on the server and remains available in this workspace.
