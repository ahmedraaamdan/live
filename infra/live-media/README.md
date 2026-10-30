# Limited LiveKit pilot

Authorized scope: no additional paid subscription, no recording, one live lecture and 25 students plus the teacher. Server version v1.13.11 is pinned by image digest. Limits are enforced in app configuration and room creation; CPU/RAM limits bound this pilot and are not a capacity guarantee.

Use host networking for media performance. Signaling and authenticated RoomService requests go through the existing HTTPS app.live.gahez.space edge routes `/rtc*` and `/twirp/livekit.*`. Port 7880 is not public: UFW allows it only from the existing Caddy Docker network. Allow media TCP 7881 and UDP 7882; embedded authenticated TURN uses UDP 3478. TURN/TLS on port 443 is not configured in this pilot, so restrictive networks may fail even if ordinary home/mobile connectivity works. Do not promise universal connectivity before testing those networks.

`livekit.example.yaml` is a template. Generate the real API key and secret on the server, keep its YAML mode 0640 with gid 10001, and add the keypair privately to `/srv/live-app/.env.app`. No real credentials belong in this directory. Keep a private backup of app environment and the shared Caddyfile before edits. Validate and reload Caddy without changing existing routes. Avoid creating a new public API listener or exposing metrics/debug ports.

Production configuration: LIVEKIT_URL=wss://app.live.gahez.space, LIVE_MAX_PARTICIPANTS=26, LIVE_MAX_ROOMS=1. S3/egress configuration stays unset. Upgrading beyond this pilot requires real load testing, bandwidth allowance confirmation, capacity planning and a dedicated media node.

Official references: https://docs.livekit.io/transport/self-hosting/deployment/ ; https://docs.livekit.io/transport/self-hosting/ports-firewall/ .
