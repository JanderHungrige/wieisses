# Wie isses? — Node 24 runs the TypeScript server directly (type stripping, built-in node:sqlite);
# the kiosk and admin pages are built by Vite. The build stage runs typecheck and tests, so a red
# test never reaches the registry. Put the reverse proxy (TLS) in front of port 8080.
ARG NODE_VERSION=24.19.0-alpine

FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json tsconfig.server.json vite.config.ts vitest.config.ts ./
COPY shared ./shared
COPY server ./server
COPY web ./web
COPY tests ./tests
COPY dev ./dev
RUN npm run typecheck && npm test && npm run build

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:${NODE_VERSION} AS runtime
LABEL org.opencontainers.image.source="https://github.com/JanderHungrige/wieisses" \
      org.opencontainers.image.description="Wie isses? — Tablet-Umfrage für Grundschulkinder mit Admin-Auswertung"
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data STATIC_DIR=/srv/dist
WORKDIR /srv
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY shared ./shared
COPY server ./server
COPY --from=build /app/dist ./dist
# A new named volume copies this directory, so the unprivileged user owns /data.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/main.ts"]
