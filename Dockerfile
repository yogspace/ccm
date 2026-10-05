# Build: statische Vite-App nach /app/dist
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
# Erst nur Manifest + Lockfile → der teure Install-Layer bleibt gecacht,
# solange sich die Dependencies nicht ändern.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime: Caddy liefert nur statische Dateien aus. HTTPS macht der zentrale
# Proxy-Stack, dieser Container spricht intern plain HTTP auf :3000.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 3000
