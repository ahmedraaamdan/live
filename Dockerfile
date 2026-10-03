# live.gahez.space: build the marketing site from the workspace, then run it
# with its own small server (static pages + the waiting-list and contact
# forms, mailed over SMTP with nodemailer).
# Debian, not Alpine, for the build: pnpm-workspace.yaml strips every native
# binary except linux-x64 glibc (rollup, esbuild, lightningcss), so a musl
# image finds none of them. The runtime below needs no native code at all.
FROM node:24-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.21.0
COPY . .
# Only the site and what it depends on, not the API server or the sandbox.
RUN pnpm install --frozen-lockfile --filter "@workspace/jahez-live..." && pnpm approve-builds --all
WORKDIR /app/artifacts/jahez-live
# Set after the install: the site's packages are all devDependencies.
ENV NODE_ENV=production PORT=5173 BASE_PATH=/
RUN pnpm run build
# The server's one runtime dependency. nodemailer has no dependencies of its
# own, so dereferencing pnpm's symlink (-L) copies everything it needs.
RUN mkdir -p /server/node_modules && cp -rL node_modules/nodemailer /server/node_modules/

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/artifacts/jahez-live/dist/public ./dist/public
COPY --from=build /server/node_modules ./node_modules
COPY artifacts/jahez-live/server.mjs ./server.mjs
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
