# Cookie Cutter Maker

SVG hochladen oder zeichnen → daraus entsteht ein druckfertiger Ausstecher (3MF/STL) für MakerWorld. Live unter https://ccm.mxwr.de.

Die Geometrie wird komplett im Browser erzeugt, der Server liefert nur statische Dateien aus.

## Funktionen

- Freihand zeichnen (Maus, Touch, Stift) mit geglättetem Strich und Pinselvorschau, Radiergummi (Radiertes wird wirklich aus den Strichen entfernt), Rückgängig/Wiederholen (auch ⌘/Strg+Z, ⌘/Strg+Umschalt+Z), Löschen, vergrößerbare Zeichenfläche mit Koordinatensystem in echten Maßen
- Werkzeuge Stift, Radiergummi und Verschieben: Was sich berührt, ist ein Objekt; es lässt sich verschieben, an den Ecken drehen und skalieren (auf Touch mit zwei Fingern), in der Strichstärke ändern und entfernen. Mehrere wählt man per Rahmen auf freier Fläche (alles, was ganz darin liegt) oder mit Umschalt-Klick
- SVG-Import verkraftet auch weiße Linien auf transparentem Grund und reine Haarlinien; findet sich keine Form, bleibt die Zeichnung stehen und es gibt eine Meldung
- Vorlagen: jede SVG-Datei in `src/presets/` wird automatisch eine (siehe unten), eingefügt als Umriss in Pinselstärke
- Leisten passen sich dem Platz an: Ist die Karte (auf dem Desktop, auch vergrößert) nicht deutlich höher als breit, stehen Werkzeuge links und Vorlagen rechts neben der Zeichenfläche, sonst darunter – die Fläche ist immer das größte Quadrat, das passt
- SVG/PNG-Import per Button oder Drag & Drop; landet auf der Zeichenfläche, danach kann man weiterzeichnen
- Formen in Formen werden zu Löchern: innere Klingen, verbunden über Stege an der Falz (abschaltbar)
- Live-Kontur (Schnittlinie) über der Zeichnung, 3D-Vorschau als Drehteller (im Uhrzeigersinn, abschaltbar); jeder neue Ausstecher bekommt eine andere Filamentfarbe
- 3D-Kekse als Icons (live gerendert, schauen zur Maus, drehen sich beim Hover) und im Hintergrund
- Maße in mm oder inch, Dateiname für den Export, Download als 3MF und STL (`<name>-80mm.3mf`)
- Teilen: oben die Seite selbst; „Kreation teilen“ bei den Downloads öffnet ein Fenster mit einem Bild des Ausstechers von oben und dem Link zur Zeichnung (der komplette Zustand steckt im URL-Hash)
- Deutsch/Englisch (i18next) unter `/de/` und `/en/` mit eigenen Texten für Suchmaschinen; `/` leitet je nach Browsersprache weiter
- Zähler „x Kreationen erstellt“ im Footer: Downloads und geteilte Kreationen zählen auf dem Server mit (dieselbe Kreation einmal pro Sitzung, gespeichert wird nur die Summe)
- Light/Dark Mode, Impressum & Datenschutz als Dialog, Animationen mit `motion`
- Zustand in einem Store ([valtio](https://valtio.dev)): Komponenten lesen selbst, was sie brauchen, statt es durchgereicht zu bekommen
- Favicon/Icons, Open-Graph-Bilder (en/de), Manifest, `robots.txt`, `sitemap.xml` und JSON-LD

## Aufbau

```
src/
  app.tsx                     Gerüst der Seite
  store.ts                    Zustand (valtio): Aktionen, Ausstecher-Worker, Link im Hash, Zähler, Scroll-Sperre
  components/                 draw-canvas, tool-picker, preview-3d, parameter-panel, export-buttons, share-creation, …
  drawing.ts                  Zeichnung als Vektoren: malen, Objekte finden, verschieben/drehen/skalieren, radieren
  presets.ts, presets/        Vorlagen (SVG-Dateien, per import.meta.glob eingebunden)
  geometry/
    outline.ts                Raster → Kontur (d3-contour), SVG-Import als Silhouette
    cutter.ts                 Kontur + Parameter → Manifold (Falz, Wand, Verjüngung, innere Klingen, Stege)
    cutter-worker.ts          rechnet cutter.ts im Web Worker, nur der neueste Auftrag zählt
    manifold.ts, mesh.ts      WASM-Singleton, Manifold → Rohdaten
  export/                     three-mf.ts, stl.ts, download.ts
  cookies/                    models.ts (Keks-Geometrien, auch aus Lucide-Icons), renderer.ts (ein WebGL-Kontext für alle Keks-Icons)
  i18n/                       de.ts, en.ts
  url-state.ts                Zustand ↔ URL-Hash
  units.ts                    mm/inch
api/
  stats.mjs                   Zähler-Logik (eine Zahl in stats.json), auch im Vite-Dev-Server eingebunden
  server.mjs                  Mini-API für den Container ccm-api, ohne Abhängigkeiten
vite.config.ts                baut zusätzlich dist/de/ und dist/en/ mit eigenen Meta-Texten, Zähler-API im Dev-Server
Caddyfile                     Weiterleitung / → /de/ oder /en/, /api/* → ccm-api, SPA-Fallback
```

### Vorlagen

Jede SVG-Datei in `src/presets/` erscheint automatisch als Vorlage. Die Reihenfolge folgt dem Dateinamen; eine führende Zahl (`1-star.svg`) sortiert nur. Der angezeigte Name kommt aus den Übersetzungen unter `presets.<name>` (z. B. `presets.star`), sonst aus dem Dateinamen. Ob die Form gefüllt oder als Linie gezeichnet ist, ist egal: Eingefügt wird ihr Umriss.

```

Dateinamen sind kebab-case (per Biome-Regel erzwungen).

### Schrift

Pally (Indian Type Foundry, [ITF Free Font License](https://www.fontshare.com)) wird selbst gehostet. Die Lizenz erlaubt das für die eigene Website, verbietet aber die Weitergabe, deshalb liegt die Datei **nicht** im (öffentlichen) Repo: `scripts/fetch-fonts.mjs` lädt sie vor `pnpm dev` und `pnpm build` nach `public/fonts/` (ignoriert). Schlägt das fehl, läuft die Seite mit der Systemschrift. Die App rendert erst, wenn die Schrift da ist (max. 1,5 s), damit sie nicht sichtbar umspringt.

### Link-Format

`#n=<Name>&<Parameter>=<Wert>&s=<Zeichnung>`. Parameter stehen nur drin, wenn sie vom Standard abweichen. Gespeichert wird die Zeichnung selbst, damit sie nach dem Öffnen genauso aussieht: je Strich die geglätteten Stiftpunkte und die Strichstärke (Radierer mit negativer Breite) und, nach einem SVG-Import, dessen Silhouette als Fläche. Striche werden je nach Stärke vereinfacht (Douglas-Peucker, 1,5–4 px), auf 2 px gerundet und als verkettete ZigZag-Varint-Deltas kodiert; das Ganze wird mit Deflate komprimiert und Base64url-kodiert. Das erste Varint ist die Formatversion (aktuell 3); die Versionen 1 (nur Kontur) und 2 werden weiterhin gelesen. Geteilte Links haben keinen Sprachpfad, damit Empfänger in ihrer eigenen Sprache landen. Der Hash wird nie an den Server geschickt.

### Bambu Studio

Beim Öffnen eines 3MF meldet Bambu Studio „The 3mf file has invalid config, load geometry data only“. Das passiert bei jedem 3MF, das nicht aus Bambu Studio selbst stammt (auch bei Fusion 360). Die Geometrie wird trotzdem vollständig geladen. Über *Datei → Import* erscheint die Meldung nicht.

## Geplant

Eine API, an die man ein SVG schickt und den fertigen Ausstecher zurückbekommt (mit API-Token und Datenbank), siehe Roadmap in [projects.md](projects.md).

## Entwicklung

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm lint         # Biome (Format + Lint)
pnpm typecheck
pnpm build        # → dist/
```

Der Zähler läuft in `pnpm dev` und `pnpm preview` gleich mit (Daten lokal in `api/.data/`, ignoriert). Einzeln: `node api/server.mjs` (Port 3001).

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

Daneben läuft der Zähler als zweiter Dienst `ccm-api` (siehe [`docker-compose.yml`](docker-compose.yml)): das fertige Image `node:22-alpine` führt `api/server.mjs` direkt aus dem Checkout in `/opt/apps/ccm` aus, ein eigenes Image braucht es nicht. Die Zahl liegt im Volume `ccm-data`. Caddy im `ccm`-Container leitet `/api/*` dorthin weiter.

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