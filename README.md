# Cookie Cutter Maker

Draw or upload an SVG → get a print-ready cookie cutter (3MF/STL) for MakerWorld. Live at https://ccm.mxwr.de.

The geometry is built entirely in the browser; the server only serves static files (plus a tiny counter API).

## Features

- Freehand drawing (mouse, touch, pen) with a smoothed stroke and brush preview, an eraser (erased parts are really removed from the strokes), undo/redo (also ⌘/Ctrl+Z, ⌘/Ctrl+Shift+Z), clear, an enlargeable drawing area with a coordinate system in real dimensions – origin at the bottom left, like at school
- Tools pen, eraser and move: whatever touches is one object; it can be moved, rotated and scaled at the corners (two fingers on touch), given another stroke width and removed. Select several by dragging a box on empty space (everything entirely inside it) or with shift-click
- Templates: every SVG file in `src/presets/` becomes one automatically (see below), inserted as an outline in brush width
- The bars adapt to the room: unless the card is clearly taller than wide (desktop, also enlarged), tools sit left and templates right of the drawing area, otherwise below – the area is always the largest square that fits
- SVG/PNG import via button or drag & drop; it lands on the drawing area and you can keep drawing. It copes with white lines on a transparent background and with pure hairlines; if no shape is found, the drawing stays and a message pops up
- Shapes inside shapes become holes (can be switched off): inner blades with a flange around them on the cookie side – close holes join up over their flanges. Each hole gets at least one arched bridge to a wall: low in the middle, running into the walls with fillets measured by the real distance to the wall, always leaving room below the cutting edge for the dough. Further bridges become flat links when a neighbouring hole's flange is closer than the wall. Adjustable bridge width
- Live contour (cutting line) over the drawing, 3D preview as a turntable (floor and model turn together, can be stopped); every new cutter gets a different filament colour
- 3D cookies as icons (rendered live, looking at the mouse, turning on hover) and in the background
- Dimensions in mm or inch, a name for the creation, download as 3MF and STL (`<name>-80mm.3mf`)
- Printing tips and error messages as popovers in neon pink, anchored with CSS anchor positioning
- Sharing: at the top the page itself; at the bottom of the page, in front of a fan of example cutters, “Share creation” opens a dialog with a picture of the cutter from above, the link to the drawing (a click copies it), saving the picture and sharing it with text and link (the complete state lives in the URL hash) – and a sun cookie for donations
- Example gallery: every picture in `src/gallery/` can show up in the fan; five are drawn at random on every load
- German/English (i18next) under `/de/` and `/en/` with their own texts for search engines; `/` redirects by browser language
- “x creations made” counter in the footer: downloads and shared creations are counted on the server (the same creation once per session, only the total is stored)
- Light/dark mode, imprint & privacy as a dialog, animations with `motion`, no scrolling behind open dialogs
- State in one store ([valtio](https://valtio.dev)): components read what they need themselves instead of having it passed down
- Favicon/icons, Open Graph images (en/de), manifest, `robots.txt`, `sitemap.xml` and JSON-LD

## Structure

```
src/
  app.tsx                     the page's frame
  store.ts                    state (valtio): actions, cutter worker, link in the hash, counter, scroll lock
  components/                 draw-canvas, tool-picker, preview-3d, parameter-panel, share-creation, gallery-fan, …
  drawing.ts                  the drawing as vectors: painting, finding objects, moving/rotating/scaling, erasing
  presets.ts, presets/        templates (SVG files, included via import.meta.glob)
  gallery/                    pictures for the fan at the bottom of the page
  geometry/
    outline.ts                raster → contour (d3-contour), SVG import as a silhouette
    cutter.ts                 contour + parameters → Manifold (flange, wall, taper, inner blades, bridges)
    cutter-worker.ts          runs cutter.ts in a web worker, only the latest job counts
    manifold.ts, mesh.ts      WASM singleton, Manifold → raw mesh
  export/                     three-mf.ts, stl.ts, download.ts
  cookies/                    models.ts (cookie geometries, also from Lucide icons), renderer.ts (one WebGL context for all cookie icons)
  i18n/                       de.ts, en.ts
  url-state.ts                state ↔ URL hash
  units.ts                    mm/inch
api/
  stats.mjs                   counter logic (one number in stats.json), also mounted in the Vite dev server
  server.mjs                  mini API for the ccm-api container, without dependencies
vite.config.ts                additionally builds dist/de/ and dist/en/ with their own meta texts, counter API in the dev server
Caddyfile                     redirect / → /de/ or /en/, /api/* → ccm-api, SPA fallback
```

File names are kebab-case (enforced by a Biome rule). Code comments and this README are in English.

### Templates

Every SVG file in `src/presets/` shows up as a template automatically. The order follows the file name; a leading number (`1-star.svg`) only sorts. The displayed name comes from the translations under `presets.<name>` (e.g. `presets.star`), otherwise from the file name. Whether the shape is filled or drawn as a line does not matter: its outline is inserted.

### Gallery

Every picture (`jpg`, `png`, `webp`, `avif`) in `src/gallery/` can show up in the fan between editor and footer; five are drawn at random on every load. Square pictures fit best – e.g. the white card cut out of a “Share creation” picture.

### Font

Pally (Indian Type Foundry, [ITF Free Font License](https://www.fontshare.com)) is self-hosted. The licence allows that for your own website but forbids redistribution, so the file is **not** in the (public) repo: `scripts/fetch-fonts.mjs` downloads it into `public/fonts/` (ignored) before `pnpm dev` and `pnpm build`. If that fails, the page runs with the system font. The app only renders once the font is there (at most 1.5 s), so it does not visibly jump.

### Link format

`#n=<name>&<parameter>=<value>&s=<drawing>`. Parameters are only included when they differ from the defaults. The drawing itself is stored, so it looks just the same after opening: per stroke the smoothed pen points and the stroke width (erasers with a negative width) and, after an SVG import, its silhouette as an area. Strokes are simplified depending on their width (Douglas-Peucker, 1.5–4 px), rounded to 2 px and encoded as chained ZigZag varint deltas; the whole thing is deflate-compressed and base64url-encoded. The first varint is the format version (currently 3); versions 1 (contour only) and 2 are still read. Shared links have no language path, so recipients land in their own language. The hash is never sent to the server.

### Bambu Studio

When opening a 3MF, Bambu Studio reports “The 3mf file has invalid config, load geometry data only”. That happens with every 3MF not made by Bambu Studio itself (Fusion 360 too). The geometry is still loaded completely. Via *File → Import* the message does not appear.

## Planned

- An API you send an SVG to and get the finished cutter back from (with API tokens and a database).
- “Get it printed”: hand the finished cutter straight to a print service (e.g. Craftcloud or Treatstock) to choose material and shop and order there.

Details in the roadmap in [projects.md](projects.md).

## Development

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm lint         # Biome (format + lint)
pnpm typecheck
pnpm build        # → dist/
```

The counter runs along in `pnpm dev` and `pnpm preview` (data locally in `api/.data/`, ignored). On its own: `node api/server.mjs` (port 3001).

## Deployment

Work happens on `development`. Roll out with:

```bash
make deploy   # pushes development, merges into main, pushes main, back to development
```

A push to `main` → GitHub Actions ([`deploy.yml`](.github/workflows/deploy.yml)):

1. **verify:** Biome + TypeScript
2. **build:** Docker image (Vite build → Caddy as a static server, see [`Dockerfile`](Dockerfile) / [`Caddyfile`](Caddyfile)) → `ghcr.io/yogspace/ccm`
3. **deploy:** via SSH to the Hetzner server, `/opt/apps/ccm`: `docker compose pull && up -d`

The container speaks plain HTTP on `:3000` internally and is attached to the external Docker network `web`. HTTPS and domain routing are handled by the central proxy stack (repo `proxy`, `/opt/apps/proxy`).

Next to it the counter runs as a second service `ccm-api` (see [`docker-compose.yml`](docker-compose.yml)): the stock `node:22-alpine` image runs `api/server.mjs` straight from the checkout in `/opt/apps/ccm`, no image of its own needed. The number lives in the `ccm-data` volume. Caddy in the `ccm` container forwards `/api/*` there.

### Secrets (Settings → Secrets → Actions)

| Secret | Value |
|---|---|
| `HETZNER_HOST` | server IP |
| `HETZNER_USER` | SSH user |
| `HETZNER_SSH_KEY` | private SSH key |

All three with the same values as in the portfolio repo.

There are no runtime variables. Build-time values (`VITE_*`) would go into the pipeline as `build-args`.

### Server, once

```bash
sudo mkdir -p /opt/apps/ccm && sudo chown deploy: /opt/apps/ccm
git clone <repo-url> /opt/apps/ccm
```

Prerequisite: the `web` network and the proxy stack are running (see repo `proxy`).

test pipeline
