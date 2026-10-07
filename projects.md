# Cookie Cutter Maker — Projekt-Brief

Arbeitsanweisung für die Weiterentwicklung in diesem Repo. Zuerst komplett lesen.

## Ziel

Web-App unter **https://ccm.mxwr.de**: Man **malt** eine Form (oder lädt optional ein **SVG** hoch), daraus entsteht ein **druckfertiger Ausstecher** mit **Falz** (flacher Rand zum Drücken mit der Hand). Export als **3MF** (primär, für Bambu Studio / MakerWorld) und **STL**.

Alles läuft **im Browser**: kein Backend, keine Accounts, kein Speichern auf dem Server. Der Container liefert nur statische Dateien aus.

## Stand

- Gerüst steht: Vite + React 19 + TypeScript, Biome, Docker (Caddy als Static-Server), Pipeline → https://ccm.mxwr.de. Siehe [README](README.md).
- `src/App.tsx` ist ein Platzhalter.
- Bereits installiert (noch nicht verwendet): `manifold-3d`, `three`, `d3-contour`, `fflate` (+ `@types/three`, `@types/d3-contour`).

## Funktionsumfang v1

1. **Zeichenfläche**: freihand mit Maus, Touch und Stift (Pointer Events). Pinselbreite einstellbar, Rückgängig, Alles löschen.
2. **SVG-Upload (optional)**: Datei wählen oder per Drag & Drop. Wird in dieselbe Pipeline wie die Zeichnung eingespeist (siehe Geometrie). Danach kann man weiterzeichnen.
3. **Live-Kontur**: Die erkannte Ausstecher-Kontur wird über der Zeichnung angezeigt, damit man sieht, was rauskommt.
4. **Parameter** (mit sinnvollen Defaults, alles in mm):

   | Parameter | Default | Bereich | Hinweis |
   |---|---|---|---|
   | Größe (längste Seite) | 80 | 30–200 | skaliert die Kontur |
   | Klingenhöhe | 15 | 8–30 | ab Oberkante Falz |
   | Wandstärke (unten, an der Falz) | 1.2 | 0.8–2.4 | Vielfache von 0.4 drucken am saubersten |
   | Schneide (Wandstärke oben) | 0.6 | 0.4–1.2 | dünne Kante zum Schneiden |
   | Länge Verjüngung | 1.6 | 0–10 | Bereich unter der Schneide, in dem die Wand dünner wird; kurz halten, sonst bricht die Schneide leichter |
   | Falz-Breite | 5 | 0–12 | 0 = kein Falz |
   | Falz-Höhe | 2 | 1–4 | |
   | Lücken schließen | 1 | 0–5 | schließt kleine Lücken in der Zeichnung |

5. **3D-Vorschau** (three.js, Orbit-Steuerung), aktualisiert sich nach jeder Änderung (debounced).
6. **Export**: „3MF herunterladen" (primär) und „STL herunterladen". Dateiname z. B. `cookie-cutter-80mm.3mf`.
7. **Druckhinweise** in der UI: PLA, 0.2 mm Schichthöhe, **Falz liegt auf dem Druckbett**, keine Stützen. In Bambu Studio einfach importieren.

Nicht in v1: Innenlinien/Prägestempel, mehrere Ausstecher nebeneinander anordnen, Speichern/Teilen, Text-Werkzeug.

## Geometrie

### Druckausrichtung

Gedruckt wird **Falz unten auf dem Bett, Schneide oben**. Benutzt wird der Ausstecher umgedreht: Falz oben, die Hand drückt auf den Falz. Dadurch braucht der Druck keine Stützen, und die dünne Schneide entsteht als letzte Schicht sauber.

```
z ↑
  │   ▕▏      ← Schneide (dünn), oben
  │   ▕▏
  │   ▕ ▏     ← Verjüngung
  │   ▕  ▏    ← Wand (Wandstärke)
  │   ▕  ▏
  │ ▄▄▟▄▄▄▄▄  ← Falz (Falz-Höhe), nach außen
  └──────────▶ außen
      ^ Kontur (Innenkante der Wand)
```

### Pipeline: Eingabe → Kontur

Zeichnung und SVG laufen **über dieselbe Raster-Pipeline**. Das ist robust gegen offene Striche, Kritzeleien und SVGs mit Strichen statt Flächen.

1. **Rastern**: Striche (bzw. das SVG als `<img>` per Data-URL) auf ein Offscreen-Canvas zeichnen (~1024 px, quadratisch), schwarz auf transparent.
2. **Kontur finden**: `d3-contour` mit Schwellwert 0.5 auf den Alpha-Kanal → MultiPolygon (äußere Ringe + Löcher).
3. **In `CrossSection` überführen** (manifold-3d): alle Ringe, `fillRule: 'EvenOdd'`.
4. **Lücken schließen** (morphologisches Closing): `.offset(+r, 'Round')` dann `.offset(-r, 'Round')`.
5. **Löcher verwerfen**: Der Ausstecher folgt nur der Außenkontur. Aus `toPolygons()` nur Ringe mit positiver Fläche (Orientierung!) behalten und neu zusammensetzen. Winzige Teile (z. B. < 1 % der Gesamtfläche) verwerfen.
6. **Glätten und vereinfachen**: `.simplify(ε)`; optional Chaikin-Glättung vor dem CrossSection-Bau.
7. **Skalieren** auf die Zielgröße (längste Seite = Größe in mm), zentrieren, **y spiegeln** (Canvas-y zeigt nach unten).

Mehrere getrennte Außenkonturen sind erlaubt und ergeben mehrere Ausstecher im selben Modell. Ihre Falze verschmelzen ggf.; das ist ok.

### Pipeline: Kontur → Körper

Mit `manifold-3d` bauen. Booleans sind dort garantiert manifold, und der Slicer bekommt ein sauberes Mesh.

- `outline` = Kontur (Innenkante der Wand)
- **Falz**: `outline.offset(falzBreite) − outline`, extrudiert auf `falzHöhe`
- **Wand**: `outline.offset(wandstärke) − outline`, extrudiert von 0 bis `falzHöhe + klingenhöhe − verjüngung`
- **Verjüngung + Schneide**: in **Stufen** von Schichthöhe 0.2 mm übereinander, die Dicke linear von `wandstärke` auf `schneide`, jeweils `outline.offset(d) − outline`, extrudiert und per `translate([0,0,z])` hochgesetzt. Stufen in der Schichthöhe sind im Druck unsichtbar und viel einfacher als echte Schrägen.
- Alles per `Manifold.union([...])` vereinen.
- Die **Innenkante bleibt senkrecht**, verjüngt wird nur nach außen: Damit hat der Teig eine glatte Innenwand.

Join-Typ für Offsets: `'Round'` (keine spitzen Ecken außen, druckt sauberer).

### manifold-3d

- WASM laden: `import Module from 'manifold-3d'` + `const wasm = await Module(); wasm.setup();`, danach `wasm.CrossSection`, `wasm.Manifold`. Die `.wasm`-Datei in Vite per `?url` importieren und als `locateFile` übergeben, falls der Default-Pfad im Build nicht passt. **Im Production-Build testen** (`pnpm build && pnpm preview`), nicht nur im Dev-Modus.
- Einmal laden (Singleton), erst dann UI-Export freigeben.
- **Speicher**: manifold-Objekte sind WASM-Speicher. Zwischenergebnisse nach Gebrauch mit `.delete()` freigeben, sonst läuft der Speicher bei jeder Parameter-Änderung voll.
- Mesh holen: `manifold.getMesh()` → `vertProperties` (Float32Array, `numProp` Werte pro Vertex, die ersten 3 = xyz) und `triVerts` (Uint32Array).
- API: https://manifoldcad.org/docs/jsapi/. Relevante Signaturen (v3.5): `CrossSection.offset(delta, joinType?, miterLimit?, circularSegments?)`, `crossSection.extrude(height, nDivisions?, twistDegrees?, scaleTop?, center?)`, `simplify(epsilon?)`, `toPolygons()`, `area()`, `bounds()`, `Manifold.union(list)`.
- Falls die Berechnung bei großen Formen spürbar die UI blockiert: in einen Web Worker auslagern. Erst messen, nicht vorab.

### Export

- **3MF**: ZIP (per `fflate`) mit `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`. Im Model `unit="millimeter"`, ein `<object type="model">` mit `<mesh><vertices>` / `<triangles>`, ein `<build><item>`. Bambu Studio importiert so ein Standard-3MF problemlos; ein Bambu-Projekt-3MF mit Druckprofil ist **nicht** nötig.
- **STL**: binär (80-Byte-Header, Dreiecksanzahl, je Dreieck Normale + 3 Vertices + 2 Byte Attribut).
- Download per `Blob` + `URL.createObjectURL` + temporärem `<a download>`.

## Struktur (Vorschlag)

```
src/
  App.tsx                  Layout: Zeichenfläche | Parameter | 3D-Vorschau
  components/
    draw-canvas.tsx        Zeichnen, Undo, Löschen, SVG-Import, Kontur-Overlay
    parameter-panel.tsx    Regler/Zahlenfelder für die Parameter
    preview-3d.tsx         three.js-Szene, Orbit-Controls
    export-buttons.tsx
  geometry/
    manifold.ts            WASM-Singleton laden
    outline.ts             Raster → Kontur (Schritte 1–7)
    cutter.ts              Kontur + Parameter → Manifold
    mesh.ts                Manifold → three.BufferGeometry / Rohdaten
  export/
    three-mf.ts
    stl.ts
    download.ts
```

Reine Geometrie-Funktionen (`outline.ts` ohne Canvas-Teil, `cutter.ts`, Exporte) ohne React schreiben, damit sie testbar sind.

## Qualitätskriterien

- Der Export ist **immer manifold** (prüfbar: `manifold.status()` bzw. Import in Bambu Studio ohne Reparatur-Warnung).
- Eine gezeichnete Form mit kleiner Lücke (< „Lücken schließen") ergibt trotzdem einen geschlossenen Ausstecher.
- Ein SVG mit nur Strichen (keine Füllung) funktioniert.
- Keine Speicherlecks bei wiederholtem Ändern der Parameter (WASM-Objekte freigeben).
- Mobil bedienbar (Touch-Zeichnen; beim Zeichnen nicht scrollen → `touch-action: none` auf dem Canvas).
- Light- und Dark-Mode.

## Konventionen (verbindlich)

- **Komponenten als `const`-Arrow-Functions**, nicht als `function`-Deklaration.
- **`children` immer über `PropsWithChildren` typen**, nie `ReactNode` direkt.
- Bedingte Klassen: falls ein `cn()`-Helper eingeführt wird, **Objekt-Syntax** (`cn("a", { b: cond })`), keine Template-Literals.
- **Keine Ordner mit nur einer `index`-Datei**; Datei direkt ablegen, Ordner erst ab zwei Dateien.
- Formatierung/Lint: Biome (`pnpm lint`, `pnpm lint:fix`), Typen: `pnpm typecheck`. Beides muss vor jedem Commit grün sein, die Pipeline prüft es.
- **Commits ohne `Co-Authored-By`- oder sonstige Claude-Signatur.** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- README bei neuen Features/Struktur-Änderungen mitpflegen.
- Gearbeitet wird auf `development`; ausgerollt wird mit `make deploy` (merged nach `main` → Pipeline → https://ccm.mxwr.de).
- Keine laufenden Dev-Server von Max beenden oder deren Ports belegen. Für eigene Prüfungen `pnpm dev --port <freier Port>` (bzw. `pnpm build` + `pnpm start -p <freier Port>`) und wieder beenden.

## Betrieb

- Deploy, Server, Proxy und Domains: Server-Handbuch im Repo `yogspace/proxy`.
- Zwei Dienste: `ccm` (Next + Payload, `mem_limit: 512m`, im Betrieb ~135 MB) und `mongo` (8.2.9, `mem_limit: 512m`, kleiner WiredTiger-Cache). Die Geometrie läuft weiter im Browser des Nutzers.
- Backend-Funktionen gehören in diesen Stack (Payload im selben Repo), nicht in eine allgemeine `api.mxwr.de`.

## Reihenfolge

1. `geometry/manifold.ts` + `cutter.ts` mit einer festen Testform (Kreis/Herz) → Mesh in `preview-3d.tsx` anzeigen. Im Production-Build prüfen, dass das WASM lädt.
2. Export 3MF/STL, Test-Import in Bambu Studio.
3. `draw-canvas.tsx` + `outline.ts` (Raster → Kontur) mit Live-Overlay.
4. Parameter-Panel, debounced Neuberechnung.
5. SVG-Upload.
6. Feinschliff: Druckhinweise, Mobil, Dark Mode, README.

## Umbau auf Next.js + Payload (Stand 2026-10-07)

### Stand

- **Phase 0 bestanden:** Editor, Geometrie-Worker und manifold-WASM laufen unter Next 16 (Turbopack), ebenso die Kartenseite; Produktions-Build und Docker-Image (331 MB, ~135 MB RAM) gehen.
- **Phase 1 umgesetzt auf dem Branch `next`, noch nicht ausgerollt:**
  - `/de`, `/en`, `/de/card`, `/en/card`, Weiterleitung von `/` und `/card` per Next-Proxy; Meta-Texte und JSON-LD über `generateMetadata`.
  - Payload mit MongoDB (eigener Container): Statistik (Seitenaufrufe, Aktionen, Auswertung im Admin, eigene Geräte ausnehmen, Mail-Report per Cron), Oberflächentexte als Translations-Global, Vorlagen und Galerie als Uploads.
  - Kontaktformular im Impressum (Resend), statt auf mxwr.de zu verweisen.
  - Revalidierung über Cache-Tags (`expire: 0`, `/next/revalidate-all`), Sync-Skripte für Datenbank und Uploads.
  - Keksleiste mit Animationen beim Befüllen (Flug ins Glas, Krümel).
- **Vor dem Ausrollen auf dem Server:** `/opt/apps/ccm/.env` anlegen (siehe `.env.example`), erster Admin über `PAYLOAD_ADMIN_EMAIL`/`PASSWORD`, Vorlagen und Galerie im Admin hochladen, Resend-Absender, `scripts/setup-cron.sh`. Das alte Volume `ccm_ccm-data` (Zähler) kann danach weg.

### Warum

- **Die Roadmap braucht ein Backend:** Kurzlinks, API mit Tokens, „Drucken lassen“ (Datei ablegen), später Shop, Galerie, vielleicht Accounts.
- **Echte Link-Vorschauen:** Heute steckt alles im Hash, und der erreicht den Server nie. Deshalb kann eine Vorschau in WhatsApp oder iMessage nichts Persönliches zeigen. Mit Kurzlinks bekommt jede Karte und jede Kreation ihren eigenen Titel und ihr eigenes Vorschaubild („Eine Karte für Carla“ mit dem Ausstecher).
- **Anonyme Statistik:** ohne Cookies, ohne IP, Auswertung im Admin, optional als Mail. Der Zähler im Footer ist dafür entfallen.
- **Bewährter Stack** (Next 16, Payload 3.89): Statistik mit `/next/track`, Cron-Digest, Dockerfile mit Next standalone – später Kurzlinks.

### Was bleibt

- **Der Editor bleibt clientseitig:** Malfläche, Geometrie im Worker (manifold-WASM), 3D-Vorschau, Kekse. Er zieht als Client-Komponente (`"use client"`) fast unverändert um. Server-Rendering macht ihn nicht schneller und soll es auch nicht.
- **Unverändert:** `src/geometry/`, `store.ts`, `url-state.ts`, `drawing.ts`, die Komponenten und die Tests (Vitest).
- **Hash-Links bleiben gültig:** Alte Links öffnen wie bisher, und Teilen funktioniert weiterhin auch ohne Server.
- **Server-Seite unverändert:** Domain, Proxy-Block (`ccm:3000`), Netz `web`, Pipeline-Muster.

### Zielbild

- **Routen (App Router):**
  - `/[locale]`: Editor, de/en
  - `/[locale]/card`: Grußkarte, Hash wie heute
  - `/k/[code]`: Kurzlink. Der Server rendert Titel und Vorschaubild und zeigt dann Karte bzw. Editor mit den gespeicherten Daten.
  - `/admin`: Payload
  - `/api/…`: Payload-REST und eigene Routen (Statistik, später `/api/v1/cutters`)
  - `/`: Weiterleitung nach Browsersprache per Next-Proxy statt Caddy
- **Payload-Collections:**
  - `users`: nur Admin, später API-Keys für Partner
  - `short-links`: Code, gespeicherter Hash, Typ (Kreation oder Karte), Vorschaubild, Aufrufe, Datum. Keine Personendaten außer dem, was jemand selbst in die Karte schreibt.
  - `templates`, `gallery`: Vorlagen (SVG) und Galeriebilder als Uploads ✓
  - `page-views`, `actions` und das Global `analytics` ✓; Global `translations` ✓
  - später `media`: die Vorschaubilder der Kurzlinks
  - später `api-tokens` (gehasht, mit Kontingent) und `orders` (Shop)
- **Datenbank:** MongoDB als eigener Container (entschieden 2026-10-07): schemalos, also keine Migrationen, wenn aus neuen Text-Keys neue Felder im Translations-Global werden. Keine andere App teilt sie.
- **Betrieb:**
  - Dockerfile mit Next standalone.
  - Compose mit `ccm` und `mongo`, Volumes `mongo_data` und `media`.
  - `ccm-api` und das Caddyfile im Container entfallen, Next liefert alles selbst aus.
  - `mem_limit` 512m je Dienst.

### Phasen

**Phase 0 – Probelauf (Machbarkeit)**
- Gerüst Next 16 + Payload 3.89 auf einem Branch, die Editor-Seite als Client-Komponente.
- **Zu prüfen, Hauptrisiko zuerst:**
  - Geometrie-Worker (`new Worker(new URL(…, import.meta.url), { type: "module" })`) und manifold-WASM im Next-Build (Turbopack und webpack)
  - three.js, Pally-Font-Script
  - Docker-Image: Bau, Größe, Start
- **Ergebnis:** Go oder No-Go. Plan B: Die Vite-App bleibt, Payload läuft als kleiner eigener Next-Dienst daneben (nur Backend), und die Kurzlink-Route rendert dort.

**Phase 1 – Gleichstand (Umzug ohne neue Funktionen)**
- `/de` und `/en`, Spracherkennung, SEO-Texte und Vorschaubild über `generateMetadata` (ersetzt das Vite-Plugin `localizedPages`), `sitemap` und `robots`.
- Kartenseite, Keksleiste, Teilen-Dialog, Statistik über Payload (ersetzt `api/server.mjs` und den Dienst `ccm-api`).
- Testfälle speichern (Alt+Shift+F) als Route, die es nur in der Entwicklung gibt.
- Pipeline: verify (Biome, TypeScript, Vitest), dann build (Image), dann deploy. Compose ohne `ccm-api`.
- **Abnahme:**
  - alle bisherigen Links öffnen gleich
  - Tests grün
  - Ladezeit nicht schlechter
  - RAM unter 400 MB

**Phase 2 – Kurzlinks und Vorschauen**
- „Link kopieren“ und „Karte erstellen“ erzeugen einen Kurzlink: Der Browser schickt den Hash und das Bild, das er ohnehin schon malt (Teilen-Bild bzw. Kartenbild). Der Server legt beides ab und gibt `ccm.mxwr.de/k/abc12` zurück.
- `/k/[code]` liefert Titel und Vorschaubild für Messenger und zeigt dann die Seite.
- **Datenschutz:** Kurzlinks speichern Zeichnung, Namen und Nachricht auf dem Server.
  - Text anpassen
  - Löschfrist, z. B. ein Jahr ohne Aufruf
  - Missbrauch begrenzen: Rate-Limit pro IP, ohne die IP zu speichern

**Phase 3 – API und Druckdienst**
- API-Tokens (gehasht, mit Kontingent) und `POST /api/v1/cutters`: SVG rein, 3MF oder STL raus. manifold läuft in Node, das Rastern übernimmt `@napi-rs/canvas`.
- „Drucken lassen“: STL kurz ablegen, Konfiguration bei Craftcloud anlegen, weiterleiten (siehe Roadmap).

**Phase 4 – Shop (noch offen)**
- Selbst verkaufen oder nur über Partner drucken lassen?
- Zahlung (Stripe), Widerruf, AGB, Impressum und Datenschutz anpassen.

### Risiken

- **Worker und WASM im Next-Bundler:** Das ist das Hauptrisiko, deshalb steht der Probelauf zuerst.
- **Ressourcen:** Mit Payload-Admin und Next werden Image, Build-Zeit und RAM größer. Nach dem Upgrade auf CX33 ist das unkritisch.
- **Datenschutz-Versprechen:** Bisher galt „nichts auf dem Server“. Mit Kurzlinks stimmt das nicht mehr ganz, Datenschutztext und README müssen es ehrlich sagen.
- **Backups:** Datenbank und Uploads liegen in Volumes. Die Hetzner-Backups decken sie ab, dazu `pnpm payload:sync` auf den Mac.

### Offene Entscheidungen

1. ~~**Datenbank:**~~ MongoDB, eigener Container (entschieden).
2. **Kurzlinks:** immer oder nur auf Wunsch? Empfehlung: Karten immer kurz (wegen der Vorschau), Kreationen wahlweise. Hash-Links bleiben gültig.
3. **Accounts:** Bleibt es beim Admin-Login für dich, oder sollen später auch Nutzer Konten haben, etwa für eine Galerie?
4. ~~**Code mit anderen Apps teilen?**~~ Nein: Muster übernehmen statt gemeinsamer Pakete. Die Apps bleiben unabhängig deploybar.

## Roadmap

- **API: SVG rein, Ausstecher raus.** Baut auf dem Umbau auf Next.js + Payload auf (Phase 3). Eine Route (z. B. `POST /api/cutters`) nimmt ein SVG und optional dieselben Parameter wie die App entgegen und liefert den fertigen Ausstecher als 3MF oder STL zurück.
  - Zugang per API-Token (`Authorization: Bearer …`). Tokens nur gehasht speichern, pro Token Rate-Limit bzw. Kontingent.
  - Datenbank für Tokens und Nutzung (wer, wann, wie viel).
  - Geometrie serverseitig mit derselben Pipeline (`outline.ts` → `cutter.ts` → `export/`). manifold-3d läuft auch in Node; nur das Rastern des SVG braucht dort einen Canvas-Ersatz (z. B. resvg).
  - Läuft als `/api` in diesem Stack (siehe Betrieb), als eigener Container: Das 128m-Limit gilt nur für den Static-Server.
  - Datenschutz-Text ergänzen: Bei der API geht das SVG an den Server.
- **Direkt drucken lassen.** Neben den Downloads ein Button „Drucken lassen“: Der Ausstecher geht an einen Druckdienst, dort wählt man Material, Shop und Versand und bezahlt.
  - Ablauf: Der Server speichert die erzeugte STL/3MF kurzzeitig (z. B. 24 h) unter einer zufälligen URL, legt damit beim Dienst eine Bestellkonfiguration an und leitet den Nutzer dorthin weiter. Braucht also denselben serverseitigen Speicher wie die API – deshalb zusammen planen.
  - Prinzip wie bei [city-roads](https://anvaka.github.io/city-roads/) (Karte → Zazzle): Der Browser lädt die Datei an einen kleinen eigenen Endpunkt, der sie öffentlich ablegt und die URL zurückgibt; daraus wird ein Deep Link mit Partner-ID, der direkt auf der fertigen Bestellseite landet (dort `src/lib/getZazzleLink.js`, rund 30 Zeilen). Hier: STL-Upload in `ccm-api` + Link zum Druckdienst.
  - **Craftcloud** (All3DP, München): Preisvergleich über 150+ Druckshops und Materialien. STL-URL rein, Konfigurations-Link (`app.craftcloud3d.com/configuration/…`) raus – so binden es z. B. Cults und Kiln an. Ob es ein Partner-/Provisionsmodell für vermittelte Bestellungen gibt, ist nicht öffentlich: bei Craftcloud anfragen.
  - **Treatstock**: API mit Upload, Preisen und Bestellung (STL, PLY, 3MF); Nutzer landen per Redirect oder eingebettetem Widget beim Bestellen. Provision je abgeschlossener Bestellung. Upload nur serverseitig mit Partner-Key (über support@treatstock.com).
  - Weniger passend: **Slant 3D** (Druckfarm-API für Firmen; wir wären selbst Verkäufer mit Bezahlung und Versand), **Shapeways** (API mit OAuth, eher Marktplatz).
  - Empfehlung: erst Craftcloud (größte Auswahl, Sitz in Deutschland), Treatstock als Alternative mit klarer Provision.
  - Hinweis im Dialog: PLA/PETG, für Lebensmittelkontakt nur kurz und gut gereinigt verwenden.
  - Datenschutz-Text ergänzen: Beim Drucken lassen geht das Modell an den Server und an den Druckdienst.
