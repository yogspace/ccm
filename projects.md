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
- Keine laufenden Dev-Server von Max beenden oder deren Ports belegen. Für eigene Prüfungen `pnpm build` + `pnpm preview --port <freier Port>` und wieder beenden.

## Betrieb

- Deploy, Server, Proxy und Domains: Server-Handbuch im Repo `yogspace/proxy`.
- Container-Limit `mem_limit: 128m` gilt nur für den Static-Server; die Geometrie läuft im Browser des Nutzers.
- Wird später doch ein Backend nötig (z. B. Designs teilen), gehört es in diesen Stack (`/api` im selben Repo), nicht in eine allgemeine `api.mxwr.de`.

## Reihenfolge

1. `geometry/manifold.ts` + `cutter.ts` mit einer festen Testform (Kreis/Herz) → Mesh in `preview-3d.tsx` anzeigen. Im Production-Build prüfen, dass das WASM lädt.
2. Export 3MF/STL, Test-Import in Bambu Studio.
3. `draw-canvas.tsx` + `outline.ts` (Raster → Kontur) mit Live-Overlay.
4. Parameter-Panel, debounced Neuberechnung.
5. SVG-Upload.
6. Feinschliff: Druckhinweise, Mobil, Dark Mode, README.

## Roadmap

- **API: SVG rein, Ausstecher raus.** Eine Route (z. B. `POST /api/cutters`) nimmt ein SVG und optional dieselben Parameter wie die App entgegen und liefert den fertigen Ausstecher als 3MF oder STL zurück.
  - Zugang per API-Token (`Authorization: Bearer …`). Tokens nur gehasht speichern, pro Token Rate-Limit bzw. Kontingent.
  - Datenbank für Tokens und Nutzung (wer, wann, wie viel).
  - Geometrie serverseitig mit derselben Pipeline (`outline.ts` → `cutter.ts` → `export/`). manifold-3d läuft auch in Node; nur das Rastern des SVG braucht dort einen Canvas-Ersatz (z. B. resvg).
  - Läuft als `/api` in diesem Stack (siehe Betrieb), als eigener Container: Das 128m-Limit gilt nur für den Static-Server.
  - Datenschutz-Text ergänzen: Bei der API geht das SVG an den Server.
- **Zeichnung verschieben und skalieren, Vorlagen.** Eine Leiste unter der Zeichenfläche:
  - Vorlagen Stern, Kreis, Quadrat, Herz als Keks-Buttons. Sie landen wie ein SVG-Import als gefüllte Fläche (`Drawing.base`) und lassen sich danach weiter bemalen, rückgängig machen und teilen.
  - Verschieben und Skalieren der ganzen Zeichnung: ein Modus „Anfassen“ mit Rahmen um die Zeichnung. Ziehen verschiebt, Ecken oder Zwei-Finger-Geste skalieren. Weil die Zeichnung als Vektoren vorliegt (Striche + Fläche, siehe Link-Format), ist das eine affine Transformation aller Punkte samt Strichbreiten mit anschließendem Neumalen; Rückgängig und Teilen funktionieren dann von selbst.
  - Hinweis: Die Größe des Ausstechers in mm bleibt Sache des Reglers „Größe“, die Kontur wird ohnehin normiert. Verschieben und Skalieren schaffen Platz zum Weiterzeichnen und richten Importe aus.
- **Formen ineinander (innere Klingen mit Stegen).** Heute verwirft `cutter.ts` alles Innere, nur die äußere Kontur wird zum Ausstecher. Künftig:
  - **Regel:** Das Innere eines einzelnen Strichs (z. B. eines gemalten Herz-Umrisses) wird weiter gefüllt. Eine eigene Form, die innerhalb einer anderen liegt, wird zur inneren Klinge und schneidet ein Loch. Das gilt auch verschachtelt (Form in Form in Form). Ein eigenes Werkzeug ist dafür nicht nötig.
  - **Innere Klingen** mit derselben Wand, Verjüngung und Schneide wie außen. Die Wand wächst ins Loch hinein, damit der Keks innen wie außen eine glatte Kante bekommt.
  - **Stege verbinden** jede innere Klinge mit der Klinge, die sie umschließt, sonst wäre sie ein loses Teil:
    - nur oben auf Höhe der Falz, nie bis zur Schneide, damit sie den Teig nicht berühren. Beim Druck liegen sie dadurch auf dem Bett, also ohne Stützen;
    - sinnvoll platziert: mindestens zwei pro innerer Klinge, möglichst gleichmäßig verteilt, jeweils auf kürzestem Weg zur umschließenden Wand, ohne andere Klingen zu kreuzen;
    - Breite und Höhe so, dass sie stabil sind (ca. 3 mm breit, Falz-Höhe), aber den Keks nicht stören.
  - Zu kleine innere Formen (nicht sauber druckbar oder schneidbar) fallen weg wie heute schon kleine Inseln.
  - Vorschau: innere Klingen und Stege in der 3D-Ansicht. Das Link-Format braucht keine Änderung, weil die Zeichnung schon alles enthält.
- **Pinselvorschau beim Zeichnen.** Beim Hover über der Zeichenfläche zeigt ein Kreis in echter Strichstärke, wie breit der Strich wird (nur mit Maus/Stift, auf Touch gibt es kein Hover).

