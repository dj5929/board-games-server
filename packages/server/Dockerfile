# syntax=docker/dockerfile:1
# ---------- Build stage ----------
FROM node:24-alpine AS build
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY packages/engine-core/package.json packages/engine-core/
COPY packages/monopoly-engine/package.json packages/monopoly-engine/
COPY packages/catan-engine/package.json packages/catan-engine/
COPY packages/scotland-yard-engine/package.json packages/scotland-yard-engine/
COPY packages/server/package.json packages/server/

RUN npm ci

# Copy engine sources (compiled into server dist by tsc project references)
COPY tsconfig.json ./
COPY packages/engine-core ./packages/engine-core
COPY packages/monopoly-engine ./packages/monopoly-engine
COPY packages/catan-engine ./packages/catan-engine
COPY packages/scotland-yard-engine ./packages/scotland-yard-engine
COPY packages/server ./packages/server

# Build server to dist/server.js (also compiles referenced engine sources)
RUN npm run build --workspace @packages/server

# ---------- Runtime stage ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copy everything so workspace source packages (@packages/* -> src/index.ts) resolve
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/packages/engine-core ./packages/engine-core
COPY --from=build /app/packages/monopoly-engine ./packages/monopoly-engine
COPY --from=build /app/packages/catan-engine ./packages/catan-engine
COPY --from=build /app/packages/scotland-yard-engine ./packages/scotland-yard-engine
COPY --from=build /app/packages/server ./packages/server

# Install prod deps + tsx (tsx is a prod dep of server; tsx transpiles .ts workspace entry points at runtime)
RUN npm ci --omit=dev

EXPOSE 3000
ENV HOST=0.0.0.0 PORT=3000
CMD ["npx", "tsx", "packages/server/dist/server.js"]
