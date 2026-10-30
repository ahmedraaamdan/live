# Arabic content refresh, teacher tools & verification deployment — 30 October 2026

Commit SHA: 810f3f0de558ef7d43dae3ee34f1e53b670fd029.
Rollback images:
- live-app-app:before-full-deploy-20261030
- live-web:before-full-deploy-20261030
Database backup: /tmp/live-app-backup-final-20261030.dump (verified with pg_restore).

Summary of deployed features:
1. Arabic marketing copy rewrite across all public pages, studio motion, hero artwork, and lesson lab.
2. Teacher profiles with story cards and verified QR code routing.
3. Teacher verification workflow with private document management and admin verification panel.
4. Two-factor authentication (MFA/TOTP) support and account security controls.
5. Reusable homework templates and weighted MCQ quizzes with auto-grading.
6. EasyKash integration and LiveKit pilot streaming preserved.

Container status:
- live-app-app-1: healthy, 200 OK on /api/healthz
- live-web-1: healthy, 200 OK on /healthz
