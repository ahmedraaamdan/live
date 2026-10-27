# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev:watch` — run the API (port 8080; without `DATABASE_URL` it uses an embedded PGlite database)
- `pnpm --filter @workspace/live-app run dev` — run the Gahez Live app (port 5174, proxies `/api`)
- `pnpm --filter @workspace/api-server run seed:demo` / `run smoke` — demo data / end-to-end check against a running dev API
- `pnpm --filter @workspace/db run generate` — write a SQL migration after changing `lib/db/src/schema` (applied on API start)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/jahez-live` — the public-facing React/Vite frontend (deployed to GitHub Pages). Design tokens + motion system: `artifacts/jahez-live/src/styles/tokens.css` and `animations.css`. **Full design system guide: `artifacts/jahez-live/DESIGN_SYSTEM.md`** — read it before adding or restyling any page; live reference at `/style-guide`.
- `artifacts/api-server` — Express API for the app: auth, lectures, Paymob payments + ledger, LiveKit, Q&A/board over SSE, homework, parent and admin. Serves the built app in production (`Dockerfile.app`, `docker-compose.app.yml`).
- `artifacts/live-app` — the Gahez Live app (teacher / student / parent / admin), web + Capacitor shells for Android/iOS. **Design system: `artifacts/live-app/DESIGN_SYSTEM.md`**, live at `/design`.
- `lib/live-core` — the contract shared by API and app: constants, zod request schemas, response types, whiteboard model.
- `docs/app/` — the one-month plan (PLAN.md), ARCHITECTURE.md, and the feed ranking design (RANKING.md).
- `artifacts/mockup-sandbox` — design/mockup scratch space.
- `lib/db` — Drizzle schema (source of truth for DB shape). `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` — OpenAPI-generated contract + client hooks.
- `.github/workflows/deploy-pages.yml` — builds `jahez-live` and deploys it to GitHub Pages on every push to `main`.

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
