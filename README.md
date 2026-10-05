# Cookie Cutter Maker

SVG hochladen oder zeichnen → daraus entsteht ein druckfertiger Ausstecher (3MF/STL) für MakerWorld. Live unter https://ccm.mxwr.de.

Die Geometrie wird komplett im Browser erzeugt, der Server liefert nur statische Dateien aus.

## Entwicklung

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm lint         # Biome (Format + Lint)
pnpm typecheck
pnpm build        # → dist/
```

## Deployment

Push auf `main` → GitHub Actions ([`deploy.yml`](.github/workflows/deploy.yml)):

1. **verify:** Biome + TypeScript
2. **build:** Docker-Image (Vite-Build → Caddy als Static-Server, siehe [`Dockerfile`](Dockerfile) / [`Caddyfile`](Caddyfile)) → `ghcr.io/yogspace/ccm`
3. **deploy:** per SSH auf den Hetzner-Server, `/opt/apps/ccm`: `docker compose pull && up -d`

Der Container spricht intern plain HTTP auf `:3000` und hängt im externen Docker-Netz `web`. HTTPS und Domain-Routing übernimmt der zentrale Proxy-Stack (Repo `proxy`, `/opt/apps/proxy`).

### Secrets (Settings → Secrets → Actions)

| Secret | Wert |
|---|---|
| `HETZNER_HOST` | Server-IP |
| `HETZNER_USER` | SSH-User |
| `HETZNER_SSH_KEY` | privater SSH-Key |

Alle drei mit denselben Werten wie im Portfolio-Repo.

Laufzeit-Variablen gibt es keine. Build-Zeit-Werte (`VITE_*`) kämen als `build-args` in die Pipeline.

### Server, einmalig

```bash
sudo mkdir -p /opt/apps/ccm && sudo chown deploy: /opt/apps/ccm
git clone <repo-url> /opt/apps/ccm
```

Voraussetzung: Netz `web` und Proxy-Stack laufen (siehe Repo `proxy`).
