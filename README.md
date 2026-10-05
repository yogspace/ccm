# Cookie Cutter Maker

SVG hochladen oder zeichnen → daraus entsteht ein druckfertiger Ausstecher (3MF/STL) für MakerWorld. Live unter https://ccm.mxwr.de.

Die Geometrie wird komplett im Browser erzeugt, der Server liefert nur statische Dateien aus.

## Funktionen

- Freihand zeichnen (Maus, Touch, Stift) mit geglättetem Strich, Rückgängig (auch ⌘/Strg+Z), Löschen, vergrößerbare Zeichenfläche mit Koordinatensystem in echten Maßen
- SVG/PNG-Import per Button oder Drag & Drop; landet auf der Zeichenfläche, danach kann man weiterzeichnen
- Live-Kontur (Schnittlinie) über der Zeichnung, 3D-Vorschau als Drehteller (im Uhrzeigersinn, abschaltbar); jeder neue Ausstecher bekommt eine andere Filamentfarbe
- 3D-Kekse als Icons (live gerendert, schauen zur Maus, drehen sich beim Hover) und im Hintergrund
- Maße in mm oder inch, Dateiname für den Export, Download als 3MF und STL (`<name>-80mm.3mf`)
- Teilen: Der komplette Zustand steckt im URL-Hash; Link kopieren und (wo vorhanden) das System-Teilen-Menü
- Deutsch/Englisch (i18next), Light/Dark Mode, Impressum & Datenschutz als Dialog, Animationen mit `motion`
- Favicon/Icons, Open-Graph-Bild, Manifest, `robots.txt`, `sitemap.xml` und JSON-LD in `public/` bzw. `index.html`

## Aufbau

```
src/
  app.tsx                     Layout und Zustand
  components/                 draw-canvas, preview-3d, parameter-panel, export-buttons, …
  geometry/
    outline.ts                Raster → Kontur (d3-contour), SVG-Import als Silhouette
    cutter.ts                 Kontur + Parameter → Manifold (Falz, Wand, Verjüngung in 0,2-mm-Stufen)
    cutter-worker.ts          rechnet cutter.ts im Web Worker, nur der neueste Auftrag zählt
    use-cutter.ts             React-Hook zum Worker
    manifold.ts, mesh.ts      WASM-Singleton, Manifold → Rohdaten
  export/                     three-mf.ts, stl.ts, download.ts
  cookies/                    models.ts (Keks-Geometrien, auch aus Lucide-Icons), renderer.ts (ein WebGL-Kontext für alle Keks-Icons)
  i18n/                       de.ts, en.ts
  url-state.ts                Zustand ↔ URL-Hash
  units.ts                    mm/inch
```

Dateinamen sind kebab-case (per Biome-Regel erzwungen).

### Schrift

Pally (Indian Type Foundry, [ITF Free Font License](https://www.fontshare.com)) wird selbst gehostet. Die Lizenz erlaubt das für die eigene Website, verbietet aber die Weitergabe, deshalb liegt die Datei **nicht** im (öffentlichen) Repo: `scripts/fetch-fonts.mjs` lädt sie vor `pnpm dev` und `pnpm build` nach `public/fonts/` (ignoriert). Schlägt das fehl, läuft die Seite mit der Systemschrift. Die App rendert erst, wenn die Schrift da ist (max. 1,5 s), damit sie nicht sichtbar umspringt.

### Link-Format

`#n=<Name>&<Parameter>=<Wert>&s=<Zeichnung>`. Parameter stehen nur drin, wenn sie vom Standard abweichen. Gespeichert wird die Zeichnung selbst, damit sie nach dem Öffnen genauso aussieht: die geglätteten Stiftpunkte jedes Strichs mit Strichstärke und, nach einem SVG-Import, dessen Silhouette als Fläche. Alles wird vereinfacht (Douglas-Peucker), auf das 1024er-Raster der Zeichenfläche gerundet, als ZigZag-Varint-Deltas kodiert, mit Deflate komprimiert und Base64url-kodiert. Das erste Varint ist die Formatversion. Version 1 (nur die Ausstecher-Kontur) wird weiterhin gelesen. Der Hash wird nie an den Server geschickt.

### Bambu Studio

Beim Öffnen eines 3MF meldet Bambu Studio „The 3mf file has invalid config, load geometry data only“. Das passiert bei jedem 3MF, das nicht aus Bambu Studio selbst stammt (auch bei Fusion 360). Die Geometrie wird trotzdem vollständig geladen. Über *Datei → Import* erscheint die Meldung nicht.

## Geplant

- Eine API, an die man ein SVG schickt und den fertigen Ausstecher zurückbekommt (mit API-Token und Datenbank).
- Vorlagen (Stern, Kreis, Quadrat, Herz) sowie Verschieben und Skalieren der Zeichnung, als Leiste unter der Zeichenfläche.
- Formen ineinander: innere Formen werden zu inneren Klingen, verbunden durch Stege an der Falz.
- Pinselvorschau beim Hover über der Zeichenfläche.

Details in der Roadmap in [projects.md](projects.md).

## Entwicklung

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm lint         # Biome (Format + Lint)
pnpm typecheck
pnpm build        # → dist/
```

## Deployment

Gearbeitet wird auf `development`. Ausgerollt wird mit:

```bash
make deploy   # pusht development, merged nach main, pusht main, zurück auf development
```

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

test pipeline