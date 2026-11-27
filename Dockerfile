# NEXORA API + SPA — production image (Fly / Railway / Render)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    SERVE_SPA=1 \
    DATABASE_URL=file:/data/nexora.db
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
# prisma CLI + tsx needed at runtime for migrate/seed/boot
# SQLite + uploads live under /data (DATABASE_URL=file:/data/nexora.db).
# Do NOT add a Docker VOLUME instruction — Railway rejects it. Persist /data by
# attaching a Railway Volume mounted at /data in the service settings (Fly uses
# fly.toml [[mounts]]). Without a volume, /data is ephemeral container storage.
RUN mkdir -p /data/uploads uploads \
  && chmod +x ./scripts/docker-entrypoint.sh
EXPOSE 4000
CMD ["./scripts/docker-entrypoint.sh"]
