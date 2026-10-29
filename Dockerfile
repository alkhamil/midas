# Midas (server + Studio) as one image: the Fastify server also serves the built Studio, so a single free web
# service is enough (plus an external Postgres and an S3-compatible bucket). See docs/deploy-gratis.md.
FROM node:26-slim AS build
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund
RUN npm run build --workspace @midas/studio && npm run build --workspace @midas/server
# Keep only what the server needs at runtime.
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 AUTO_MIGRATE=true COOKIE_SECURE=true
COPY --from=build /app/node_modules ./node_modules
# The server builds React packages from library versions with @midas/builder-core (a workspace link in node_modules).
COPY --from=build /app/packages/builder-core ./packages/builder-core
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/studio/dist ./apps/studio/dist
EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
