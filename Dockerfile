# Build: static Vite app into /app/dist
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
# Manifest + lockfile first → the expensive install layer stays cached as long
# as the dependencies do not change.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime: Caddy only serves static files. HTTPS is done by the central proxy
# stack; this container speaks plain HTTP on :3000 internally.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 3000
