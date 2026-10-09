# Cookie Cutter Maker

Draw or upload an SVG → get a print-ready cookie cutter (3MF/STL) for MakerWorld. Live at https://ccm.mxwr.de.

The geometry is built entirely in the browser. The server ([Next.js](https://nextjs.org)) delivers the pages; a small [Payload](https://payloadcms.com) backend with MongoDB holds the anonymous statistics, the interface texts and the optional visitor accounts, editable in an admin.

## Features

- Freehand drawing (mouse, touch, pen) with a smoothed stroke and brush preview, an eraser (erased parts are really removed from the strokes), undo/redo (also ⌘/Ctrl+Z, ⌘/Ctrl+Shift+Z), clear, an enlargeable drawing area with a coordinate system in real dimensions – origin at the bottom left, like at school
- Tools pen, eraser and move: whatever touches is one object; it can be moved, rotated and scaled at the corners (two fingers on touch), given another stroke width and removed. Select several by dragging a box on empty space (everything entirely inside it) or with shift-click
- Embossing: the pen has two inks – black is cut out, pink is pressed into the cookie, exactly as drawn: lines as grooves, areas as hollows, only where there is cookie (never over an opening). An embossed area is made like a hole – its half-wide flange around it, held by flat links in the plate (never arches) – only filled, and instead of up to the cutting edge it reaches “Embossing from the flange” out of the plate (shown only then): from 0, flush, up to the blade height, as high as the walls. The 3D view never picks the pink filament then. The cookie around it stays open. In the 3D view the embossing is pink; the file is one piece. Beside the brush slider two dots as big as the brush, black and pink, the ink ringed – a click picks the other; with the move tool it recolours a selection
- The maker's mark: every cutter – every piece that hangs on nothing else, so shapes side by side are each signed – carries a small raised “MXWR” on top of its outer flange (up as it prints, so it prints crisp; about 9 mm above the dough in use) – where the flange runs calmest, upright where it can be, letter by letter around curves, never near a wall; mirrored cutters keep it readable. It can't be switched off; the flange is never narrower than the wall plus 3.35 mm so it always fits (the slider starts there, 4.55 mm with the default wall). `src/geometry/signature.ts`
- Templates: SVGs uploaded in the admin (see below), inserted as an outline in brush width and the pen's ink
- The bars adapt to the room: unless the card is clearly taller than wide (desktop, also enlarged), tools sit left and templates right of the drawing area, otherwise below – the area is always the largest square that fits
- SVG/PNG import via button or drag & drop; it lands on the drawing area and you can keep drawing. It copes with white lines on a transparent background and with pure hairlines; if no shape is found, the drawing stays and a message pops up
- Shapes inside shapes become holes (can be switched off): inner blades with a flange half as wide around them on the cookie side, never over an opening. What holds them is planned so the cutter stays easy to clean – as few connections as needed, no sharp corners:
  - holes whose flanges come close are linked flat, the closest pairs first and only as many as it takes (no criss-cross) – they form a group, held as one piece
  - groups are held one by one, the one nearest to what is held already first, each by the cheapest set of supports spread around it (two at least 90° apart, more for large groups, one for tiny ones) – short, square to the contours, flat rather than arched, apart from each other
  - open spans up to 8 mm are flat links at flange height, longer ones arched bridges: low in the middle, running into the walls with fillets measured by the real distance to the wall, always leaving room below the cutting edge for the dough
  - links and bridges blend into walls and flanges with round fillets; hairline gaps between flanges are closed, small pockets in the plate filled, larger ones rounded
  - adjustable bridge width
- Geometry tests (`pnpm test`, also in the pipeline): drawn and generated shapes must come out as one part, with nothing in the dough's room, nothing over an opening, no hairline slits or sharp corners next to inner blades, and no more arches than needed; embossing reaches exactly as deep as set and never near the cutting edge; links keep each stroke's ink. In the dev server, a “Test case” button in the corner saves the drawing on screen as a new one
- Live contour (cutting line) over the drawing, 3D preview as a turntable (floor and model turn together, can be stopped); every new cutter gets a different filament color
- 3D cookies as icons (rendered live, looking at the mouse, turning on hover) and in the background
- Dimensions in mm or inch, a name for the creation, download as 3MF and STL (`<name>-80mm.3mf`)
- Printing tips and error messages as popovers in neon pink, anchored with CSS anchor positioning
- Sharing: at the top the page itself; at the bottom of the page, in front of a fan of example cutters, “Share creation” opens a dialog with a picture of the cutter from above, the link to the drawing (a click copies it), saving the picture and sharing it with text and link (the complete state lives in the URL hash) – and a sun cookie for donations
- Bake it: every creation also makes a 3D cookie in its shape – dough with a rounded edge, holes and all, icing poured a little inside the edge (narrower or left off where the shape is thin) and sprinkles on top, always the same for the same shape
- Cookie bar: “Save as cookie” (and every download) keeps the creation as such a cookie in this browser “This site uses cookies” – your own: a bar slides up from the bottom with the first scroll, sticks to the bottom of the screen and stops right above the footer; a click on a cookie opens a little menu – open it, save it online or take it offline, eat it – closed it becomes a jar. Filling it is a little show: the cookie flies from its button into its place along an arc, the others make room, it plops in with crumbs; eaten ones leave with a twist
- Share as a card: in the share dialog, add who it is for, who it is from and a message (a little preview shows it running around the cutter) and get a link to the card's own page – one screen without scrolling: the cutter in 3D on a card, the message turning around it, 3MF/STL to download and a way to the maker. A click turns the card over – on its back lies the cookie it bakes. Like every link, it all lives in the hash
- Online cookies, optional: each cookie in the jar is offline (on this device only) or online – its cloud says which, a click changes it, and saving asks. Online, it is kept in an account – on every device logged in – and has a short link: shared, its link is short, only the model (`s=`) goes to the server, everything else stays in the link. Taken offline (or eaten), it is on this device only again and its short link goes – asked first. The account comes with the first cookie online: no name, no email, a passphrase of three words, some with a number, made by the server and shown once (see below)
- Example gallery: cards like the share picture – built in the admin from a creation's link (the cutter rendered from above) or from any picture in Media; five are drawn at random on every load
- German/English (i18next) under `/de` and `/en` with their own texts for search engines; `/` redirects by browser language. The interface texts can be edited in the admin (see below)
- Anonymous statistics without cookies: page views (page, coarse source, device class, OS, browser) and actions (downloads, sharing, cards, imports) on our own server – no IP, no identifier, nothing linking two rows, deleted after 90 days; Global Privacy Control is respected. Evaluated in the admin, optionally as a mail report (see below)
- Light/dark mode, imprint & privacy as a dialog – written in the admin as rich text, with the contact form in it – animations with `motion`, no scrolling behind open dialogs
- State in one store ([valtio](https://valtio.dev)): components read what they need themselves instead of having it passed down
- Favicon/icons, Open Graph images (en/de), manifest, `robots.txt`, `sitemap.xml` and JSON-LD

## Structure

```
src/
  app/
    (frontend)/[locale]/      the pages: /de and /en (editor), /de/card and /en/card (greeting card) – layout with meta texts
    (frontend)/next/          internal routes: track, action (statistics beacons), analytics-exclude, account/ (create, login, logout, links: a cookie online or back), shape/[code] (a short link's model), cron/stats-digest (mail report), cron/accounts (pruning), fixture (dev only)
    (payload)/                the admin (/admin) and Payload's REST API (/api) – generated by Payload; custom.scss styles only the previews (legal text editor, its blocks) like the site
  proxy.ts                    “/” and “/card” → /de or /en by browser language
  editor-root.tsx, editor.tsx the editor in the browser only (next/dynamic without SSR): texts, templates, gallery handed over by the page
  editor-app.tsx              the editor's frame
  index.css                   Tailwind: the theme (colors, font sizes, breakpoints), base styles, keyframes – the site's only stylesheet
  glaze.css                   a favorite color's shades (card page, share picture) – also loaded by the admin's preview
  cn.ts                       joins class names; of conflicting utilities the later wins (tailwind-merge)
  card/                       the greeting card: card-root/card-entry (browser only), card-page (the page), greeting-card (the card that turns), card-front/card-back, card-actions (files, picture), speech-bubble, sprinkles, card-cookies (raining down), card-cutter (3D on the card), use-cutter/load-cutter, use-bites/bite (biting the cookie), card-link (what the link brings)
  store.ts                    state (valtio): actions, cutter worker, link in the hash, scroll lock
  draw/                       the drawing area: draw-canvas (puts it together), use-drawing (the drawing, selection, undo), use-pen (drawing, erasing), use-move (selecting, moving, scaling), use-area-fit (its size beside or above the bars), tool-picker, draw-templates, draw-actions, brush-options, draw-marks, draw-grid, shape-head
  components/                 preview-3d, parameter-panel, share-creation, gallery-fan, cookie-bar, cookie-fx (flight, crumbs), button, card, dialog (shared by imprint and account), account-dialog (opened from the cookie bar), link-field (copy – short when the creation is online, else “Save online”), dev-fixture (dev server only: saves the drawing as a test case), …; styles.ts: classes shared by several
  account/                    the accounts: rules (limits, checks – browser and server), server (passphrase, its key, login cookie), client (login, cookies online and back, short links), prune (deleting idle ones), words (passphrase words, de/en)
  drawing.ts                  the drawing as vectors: painting, finding objects, moving/rotating/scaling, erasing
  presets.ts                  a template's outline from its SVG
  content.ts, assets.ts       templates and the gallery's cards from the CMS; the editor gets them through a context
  cache.ts, media.ts          cache tags and their expiry; where uploads are kept
  geometry/
    outline.ts                raster → contour (d3-contour), SVG import as a silhouette
    cutter.ts                 contour + parameters → Manifold (wall, taper, flange plate), puts it all together; also the cookie's icing
    islands.ts                which contour lies inside which (cookie, hole, cookie in the hole …)
    connections.ts            plans what holds the inner blades: flat links and arches
    bridges.ts                builds an arched bridge (height field with fillets)
    rings.ts                  2D helpers for contours
    cutter-worker.ts          runs cutter.ts in a web worker, only the latest job counts
    manifold.ts, mesh.ts      WASM singleton (public/manifold.wasm), Manifold → raw mesh
  export/                     three-mf.ts, stl.ts, download.ts, file-name.ts
  cookies/                    the 3D cookies: dough.ts (dough, sizes, sprinkles), kinds.ts (the icon cookies), svg-cookies.ts (traced from SVGs and Lucide icons), shape-cookie.ts (baked from creations), bites.ts (biting them), renderer.ts (one WebGL context for all cookie icons)
  i18n/                       de.ts, en.ts (the texts' seed and shape), index.ts (i18next with the texts from the server)
  translations/               the Translations global: fields from the keys (tree.ts), seeding (seed.ts), reading for the pages (texts.ts)
  payload.config.ts           Payload: MongoDB, collections, globals, seeding at start
  collections/                templates (SVG uploads), gallery (cards), media (pictures with alt texts), users (admin login), accounts and short-links (visitors), page-views, actions
  globals/                    site (links, address), legal (imprint & privacy, rich text), translations, analytics (statistics, mail report, own devices)
  legal/                      the legal text's blocks, its rendering on the server, its seed (the text as it stood in the code)
  site-defaults.ts, site-context.ts   links and address before the CMS (seed and fallback); the links in the browser
  fields/                     admin views: analytics/ (overview, visitors, actions, range), visit-matrix, buttons
  stats/                      statistics on the server: device classes, sources, exclusion, auth, mail, page names
  analytics.ts                sends page views and actions (sendBeacon)
  seo.ts                      meta texts, link previews, JSON-LD per language
  url-state.ts                state ↔ URL hash
  short-shape.ts              short links: the model for `k=` fetched and put back as `s=` before the page reads its link
  cookie-jar.ts, cookie-flight.ts   the cookie bar's cookies in localStorage (online ones also in the account); a cookie's flight into the bar
  filaments.ts, hash-text.ts  filament colors, stable numbers from texts (same color, same sprinkles everywhere)
  greeting.ts                 the card's link: recipient, sender, message on top of the creation's hash
  units.ts                    mm/inch
scripts/                      prepare.mjs (Pally + manifold.wasm before dev/build), sync-db.sh, sync-media.sh, setup-cron.sh
test/                         tests (Vitest): cutter.test.ts (geometry, embossing), clean.ts (inspects a cutter in slices), shapes.ts, fixtures/ (drawn shapes), url-state.test.ts (link format)
```

File names are kebab-case (enforced by a Biome rule). Code comments and this README are in English.

### Styling

[Tailwind CSS](https://tailwindcss.com) v4, configured in CSS (`src/index.css`, no config file). The design's tokens are the theme – `bg-page`, `text-ink`, `text-small`, `ease-spring` …; colors are overridden where the page changes (dark mode, the `paper` utility on the drawing area, the card page's favorite color), so the utilities follow along. Components carry their utilities in `className`; what several share sits in a component (`Button` with its kinds, `Card`, `Field`) or in `components/styles.ts`. Elements' defaults (buttons, focus ring, range inputs) are base styles written with `@apply`. Tailwind styles the site only – the admin keeps Payload's own styles (`custom.scss`).

### Templates, gallery and media

Templates and the gallery live in the admin (**Templates**, **Gallery**), in the order of their lists (drag & drop); pictures in **Media**. The files are in the `media` volume on the server, locally in `media/` (ignored).

- **Templates:** an SVG each, filled or drawn as a line – its outline is inserted. With a name in German and English (locale switch at the top); it is shown on hover and read out (“Insert Star”).
- **Gallery:** cards for the fan between editor and footer, each like the share picture – its color (one of Site's card colors), the cutter on the card, its name; five are drawn at random on every load. Above the list, **Build a card from a link**: paste a creation's link, pick name and color, and the cutter is built and rendered from above right in the admin – the picture goes to Media, the card to the gallery. A card can also take any picture from Media (one on a white ground takes the card's tint).
- **Media:** all pictures, each with its alt text (both languages). Each gets a 600 × 489 WebP – the shape of the cutter's place on the card – for the fan.

The 3D cookies take their colors from **Site → Cookies**: the dough (its specks and sheen follow it) and the chocolate (the chips, and in its shade the chocolate dough). Their sprinkles are the card colors and white; one too close to what it lies on – the icing, or the dough – turns a little lighter or darker, white gives way to another color (`src/cookies/dough.ts`).

Saving or deleting shows on the site right away (cache tags, see `src/cache.ts`).

### Font

Pally (Indian Type Foundry, [ITF Free Font License](https://www.fontshare.com)) is self-hosted. The licence allows that for your own website but forbids redistribution, so the file is **not** in the (public) repo: `scripts/prepare.mjs` downloads it into `public/fonts/` (ignored) before `pnpm dev` and `pnpm build` – and copies manifold's WebAssembly to `public/manifold.wasm` (ignored as well, always the installed version). If that fails, the page runs with the system font. The app only renders once the font is there (at most 1.5 s), so it does not visibly jump.

### Link format

`#n=<name>&<parameter>=<value>&s=<drawing>`. Parameters are only included when they differ from the defaults. The drawing itself is stored, so it looks just the same after opening: per stroke the smoothed pen points and the stroke width (erasers with a negative width) and, after an SVG import, its silhouette as an area. Strokes are simplified depending on their width (Douglas-Peucker, 1.5–4 px), rounded to 2 px and encoded as chained ZigZag varint deltas; the whole thing is deflate-compressed and base64url-encoded. The first varint is the format version (currently 3; 4 when something is embossed – then a pen stroke's width is written doubled, its lowest bit the ink, so links without embossing stay byte for byte as before); versions 1 (contour only) and 2 are still read. Shared links have no language path, so recipients land in their own language. A greeting card is the same link under `/<language>/card` – the sender's language, like the message – plus `&t=<recipient>&f=<sender>&m=<message>` (older links with `to=`/`from=` are still read); `/card` alone (older links) follows the browser. Older links with a trailing slash (`/de/card/#…`) are redirected; the hash survives. The hash is never sent to the server.

A short link has `k=<code>` in place of `s=<drawing>` – seven letters and digits standing for the model of a cookie put online; everything else stays in the link as it was. Opened, the page fetches the model (`/next/shape/<code>`) and turns the address back into the full link (`history.replaceState`) before reading it, so whoever got it keeps a link that works even once the short link is gone. A dead code shows a message instead of the cutter.

### Bambu Studio

When opening a 3MF, Bambu Studio reports “The 3mf file has invalid config, load geometry data only”. That happens with every 3MF not made by Bambu Studio itself (Fusion 360 too). The geometry is still loaded completely. Via *File → Import* the message does not appear.

## License

The source code is public so it can be read – to show how the site works and that it keeps its privacy promises. It is **not open source**: all rights reserved. Hosting or running it yourself, copying or reusing it (or parts of it), redistributing it or using it commercially needs written permission. See [LICENSE](LICENSE).

## Planned

- Link previews for short links: the code would have to move from the hash into the path, so the server sees which creation to show.
- An API you send an SVG to and get the finished cutter back from (with API tokens and a database).
- “Get it printed”: hand the finished cutter straight to a print service (e.g. Craftcloud or Treatstock) to choose material and shop and order there.

Details in the roadmap in [projects.md](projects.md).

## Development

```bash
pnpm install
cp .env.example .env                              # then fill in PAYLOAD_SECRET (openssl rand -hex 32)
make up-db                                        # local MongoDB on 27018 (make down-db stops it)
pnpm dev          # http://localhost:3000, admin at /admin
pnpm lint         # Biome (format + lint)
pnpm typecheck    # Next's route types + TypeScript
pnpm test         # geometry tests (Vitest); “Test case” in the dev server adds the drawing on screen to test/fixtures/
pnpm build        # → .next/ (standalone)
```

The first admin comes from `PAYLOAD_ADMIN_EMAIL`/`PAYLOAD_ADMIN_PASSWORD` in `.env` (created at start while there is no user). After changing collections or globals: `pnpm generate:types`; after adding admin components: `pnpm generate:importmap`.

`pnpm payload:sync` copies production to the local setup (over SSH – the host alias from `SYNC_REMOTE` in `.env`): `payload:media:sync` the uploads into `media/` (rsync, only what changed), `payload:db:sync` the database – `mongodump` into a temp file, checked, then `mongorestore --drop` – and finally `payload:db:revalidate`, so the running dev server drops its cached content (with `REVALIDATE_SECRET` from `.env`).

### Statistics

In the admin under **Analytics**: page views and actions over a time range (today, yesterday, 7/30/90 days, since the last report) with the same span before for comparison, page views per hour or day (a click on a bar narrows everything down), pages × devices as a heatmap, sources, and what people did. Deleting by range, everything or one device profile.

- **Own devices:** in the sidebar “Don't count this device” – once per device, logged in; afterwards it is not counted even logged out. Logged-in admins are never counted.
- **Contact form:** in the imprint (dialog) – mailed to `MAIL_CONTACT_RECIPIENT` via Resend, nothing stored; a honeypot and a rate limit (5 per 10 minutes and IP, in memory only) against abuse.
- **Mail report:** in the sidebar daily, weekly or monthly (off by default), “Send the report now” to try it. Needs the secrets `CRON_SECRET`, `RESEND_API_KEY`, `MAIL_FROM` and `MAIL_STATS_RECIPIENT`; the cron job is installed by every deploy. The route also prunes rows older than 90 days.

### Accounts

Two roles: the admin's **Users** (Payload's own login) and visitors' **Accounts** on the site. For visitors an account is where their online cookies are kept: it comes with the first cookie put online (in the cookie bar, or “Short link? Save online” under the share link), and “Log in” in the bar fetches the online cookies on another device – the closed jar stays even when empty for that.

- **Passphrase:** three words in the visitor's language, one to three of them with a number from 1 to 99 – `kuh7-traktor-waffel21` (`src/account/words.ts`, about 40 bits), made by the server and shown once. The database keeps only `scrypt(passphrase)` peppered with `PAYLOAD_SECRET` – **changing that secret makes every passphrase useless and logs everyone out**. Upper case, spaces or commas don't matter when typing it, nor whether a number sticks to its word. The browser it was made or typed in keeps it (localStorage, never sent anywhere) – “Show passphrase” in the account; logging out or deleting forgets it there, a login that ran out keeps it and fills it in. There is no recovery beyond that: nothing links an account to a person, so a lost passphrase is lost (Art. 11 GDPR – said in the privacy text); the account goes like any unvisited one.
- **Login:** a signed httpOnly cookie `ccm-account` with the account's id, for 180 days like the account itself, renewed on every visit. A visit takes the account's online cookies as they are (one taken offline or eaten elsewhere goes here too); the offline cookies stay. Logging out takes the online cookies off that browser (it may be someone else's device); deleting the account keeps them there, offline.
- **Short links:** one per model and account, made when a cookie goes online (`POST /next/account/links` with the cookie), gone when it is taken offline or eaten (`DELETE`, unless another online cookie has the same model) or with the account. A link is short when its model belongs to an online cookie – the creation's, the card's.
- **What an account keeps:** its online cookies (at most 30, like the jar) with their short links' models. Nothing else: no name, no email, no IP.
- **Going:** deleted with its short links after 180 days without a visit, after 7 if it never kept anything – daily by `/next/cron/accounts` (cron job from `scripts/setup-cron.sh`, with `CRON_SECRET`) – or by the visitor (“Delete account”), or in the admin under **Accounts**, which shows when each was made and last visited and how many cookies it keeps online. There a **Label** helps to find it again (search above the list, or **find an account by its passphrase** – its key computed, nothing kept), **Last login** shows the last login with the passphrase, and **Keep forever** exempts it from the automatic deletion – for your own accounts, say. Only a kept account can get **New passphrase**: a fresh one, kept with it to look up; the old one stops working, and unkept it is deleted again – no other account ever has its passphrase stored. Label and keeping are the only things to change there; the privacy text mentions all of it.
- **Against abuse:** rate limits in memory per IP – 5 new accounts an hour, 10 logins in 10 minutes (and 1,000 an hour altogether), 60 cookies online an hour, 120 models fetched a minute; changes only from the site's own pages (Origin check, SameSite cookie).

### Imprint, privacy and links

- **Site:** the links (mxwr.de in the footer and on the card, MakerWorld, PayPal, GitHub) and the address – in one place.
- **Imprint & privacy:** the dialog behind “Imprint & privacy” as rich text, German and English – imprint, privacy, rights (software, design and the example cutters reserved; what visitors draw is theirs) and the project. The editor has what the dialog draws – big headings (h2) for the parts, small ones (h3) for the sections, paragraphs, bold, italic, lists, links – and looks like it (Pally, the same sizes). Its own blocks:
  - **Address** – the address from Site, shown where the block sits (twice in the imprint, kept once).
  - **Contact form** – the real form (`/next/contact`).
  - **Site link** (inline) – linked words in a sentence pointing to one of Site's links (“GitHub”, “PayPal”).
  - **Last updated** (inline) – the date the text was last saved, in the reader's language.

The admin's **Seeds** page fills both with what stands in the code (Fill), or sets them back to it (Replace…); until then – and without a database – the page shows exactly that.

### Interface texts

In the admin under **Translations**, German and English (locale switch at the top). The fields come from the keys in `src/i18n/de.ts`: a new key is a new field right away, the site shows its text from the code; **Seeds → Translations** writes it into the CMS and deletes keys the code no longer has. What is changed in the admin is never overwritten. Saving shows the texts on the site right away.

## Deployment

Work happens on `development`. Roll out with:

```bash
make deploy   # pushes development, merges into main, pushes main, back to development
```

A push to `main` → GitHub Actions ([`deploy.yml`](.github/workflows/deploy.yml)):

1. **verify:** Biome + TypeScript + geometry tests
2. **build:** Docker image (Next.js standalone, see [`Dockerfile`](Dockerfile)) → `ghcr.io/yogspace/ccm`
3. **deploy:** via SSH to the Hetzner server, `/opt/apps/ccm`: writes `.env` from the secrets (stops if the essential ones are missing), `docker compose pull && up -d --remove-orphans`, then installs the cron jobs – mail report and account pruning (`scripts/setup-cron.sh`, idempotent)

Two services (see [`docker-compose.yml`](docker-compose.yml)): `ccm` speaks plain HTTP on `:3000`, keeps the uploads in the `media` volume and is attached to the external Docker network `web` – HTTPS and domain routing are handled by the central proxy stack (repo `proxy`, `/opt/apps/proxy`). `mongo` only lives in the internal network, its data in the `mongo_data` volume; pinned to 8.2.9 with shadow stacks off (see the comment there).

### Secrets (Settings → Secrets → Actions)

| Secret | Value |
|---|---|
| `HETZNER_HOST` | server IP |
| `HETZNER_USER` | SSH user |
| `HETZNER_SSH_KEY` | private SSH key |
| `NEXT_PUBLIC_SERVER_URL` | `https://ccm.mxwr.de` |
| `PAYLOAD_SECRET` | `openssl rand -hex 32` – also keys the account passphrases: changing it locks every visitor out of their account |
| `CRON_SECRET` | `openssl rand -hex 32` (mail report, account pruning) |
| `RESEND_API_KEY` | Resend API key (contact form, mail report) |
| `MAIL_FROM` | sender on a domain verified at Resend |
| `MAIL_CONTACT_RECIPIENT` | who gets the contact form's messages |
| `MAIL_STATS_RECIPIENT` | who gets the mail report |

The three `HETZNER_*` with the same values as for the other apps on the server. The rest is written to `/opt/apps/ccm/.env` on every deploy (see [`.env.example`](.env.example)) – change a value here, then deploy; edits to the file on the server don't last. Without `NEXT_PUBLIC_SERVER_URL` or `PAYLOAD_SECRET` the deploy stops and the running version stays.

### Server, once

```bash
sudo mkdir -p /opt/apps/ccm && sudo chown deploy: /opt/apps/ccm
git clone <repo-url> /opt/apps/ccm
```

The `.env` comes with the first deploy (secrets above). For the very first admin add `PAYLOAD_ADMIN_EMAIL`/`PAYLOAD_ADMIN_PASSWORD` to it by hand once and restart – the next deploy drops them again.

Prerequisite: the `web` network and the proxy stack are running (see repo `proxy`).

test pipeline
