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
COPY packages/web-client/package.json packages/web-client/

RUN npm ci

# Copy engine sources (web-client imports @packages/* from source)
COPY tsconfig.json ./
COPY packages/engine-core ./packages/engine-core
COPY packages/monopoly-engine ./packages/monopoly-engine
COPY packages/catan-engine ./packages/catan-engine
COPY packages/scotland-yard-engine ./packages/scotland-yard-engine
COPY packages/web-client ./packages/web-client

# Bake the API origin into the bundle
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build --workspace web-client

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/packages/web-client/dist /usr/share/nginx/html
COPY packages/web-client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
