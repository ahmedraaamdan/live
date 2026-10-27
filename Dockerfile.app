# The Gahez Live app (app.live.gahez.space): the API and the built web app
# in one container, so the browser talks to a single origin. The marketing
# site keeps its own image (Dockerfile).
#
# Debian for the build: pnpm-workspace.yaml keeps only the linux-x64 glibc
# native binaries (rollup, esbuild, lightningcss), so a musl image finds none.
FROM node:24-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.21.0
COPY . .
RUN pnpm install --frozen-lockfile --filter "@workspace/api-server..." --filter "@workspace/live-app..." && pnpm approve-builds --all
ENV NODE_ENV=production
RUN pnpm --filter @workspace/live-app run build && pnpm --filter @workspace/api-server run build
# The bundle's only runtime dependency left external. nodemailer has no
# dependencies of its own, so dereferencing pnpm's symlink (-L) is enough.
RUN mkdir -p /out/node_modules && cp -rL artifacts/api-server/node_modules/nodemailer /out/node_modules/

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    APP_DIST=/app/public \
    MIGRATIONS_DIR=/app/migrations \
    UPLOAD_DIR=/data/uploads
COPY --from=build /app/artifacts/api-server/dist ./dist
COPY --from=build /app/artifacts/live-app/dist ./public
COPY --from=build /app/lib/db/drizzle ./migrations
COPY --from=build /out/node_modules ./node_modules
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
