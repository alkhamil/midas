# Midas (server + Studio) as one image: the Fastify server also serves the built Studio, so a single free web
# service is enough (plus an external Postgres and an S3-compatible bucket). See docs/deploy-gratis.md.
FROM node:22-slim AS build
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund
# ui-standard: the standard component kit the server builds every published library from.
RUN npm run build --workspace @midas/ui-standard && npm run build --workspace @midas/studio && npm run build --workspace @midas/server
# Keep only what the server needs at runtime.
RUN npm prune --omit=dev --no-audit --no-fund && find templates -name node_modules -prune -exec rm -rf {} +

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 AUTO_MIGRATE=true COOKIE_SECURE=true
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/studio/dist ./apps/studio/dist
COPY --from=build /app/templates ./templates
COPY --from=build /app/packages/builder-core/package.json ./packages/builder-core/package.json
COPY --from=build /app/packages/builder-core/src ./packages/builder-core/src
COPY --from=build /app/packages/ui-standard/package.json ./packages/ui-standard/package.json
COPY --from=build /app/packages/ui-standard/src ./packages/ui-standard/src
COPY --from=build /app/packages/ui-standard/dist ./packages/ui-standard/dist
EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
