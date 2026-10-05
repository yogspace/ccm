export const de = {
  title: "Cookie Cutter Maker – Ausstecher selbst gestalten und 3D-drucken",
  tagline:
    "Form malen oder SVG hochladen – raus kommt ein druckfertiger Ausstecher.",
  language: "Sprache",
  unit: "Maßeinheit",
  steps: {
    shape: "Form",
    cutter: "Ausstecher",
  },
  draw: {
    hint: "Umriss malen oder SVG hierher ziehen",
    hintSub: "Geschlossene Linien werden gefüllt.",
    brush: "Pinselstärke",
    undo: "Rückgängig",
    clear: "Löschen",
    upload: "SVG hochladen",
    drop: "Loslassen zum Importieren",
    expand: "Zeichenfläche vergrößern",
    shrink: "Zeichenfläche verkleinern",
  },
  preview: {
    empty: "Hier erscheint dein Ausstecher.",
    loading: "Lade Geometrie-Engine …",
    rotate: "Automatisch drehen",
  },
  params: {
    title: "Maße",
    size: "Größe",
    bladeHeight: "Klingenhöhe",
    wall: "Wandstärke",
    edge: "Schneide",
    taper: "Verjüngung",
    flangeWidth: "Falz-Breite",
    flangeHeight: "Falz-Höhe",
    smoothing: "Lücken schließen",
    reset: "Zurücksetzen",
  },
  export: {
    name: "Dateiname",
    namePlaceholder: "z. B. Herz",
    threeMf: "3MF herunterladen",
    stl: "STL",
  },
  hints: {
    title: "Druckhinweise",
    material: "PLA, 0,2 mm Schichthöhe",
    orientation: "Falz liegt auf dem Druckbett",
    supports: "Keine Stützen nötig",
    slicer: "In Bambu Studio einfach importieren",
    bambu:
      "Meldet Bambu Studio „invalid config“: einfach OK – die Geometrie ist vollständig. Ohne Meldung geht es über Datei → Import.",
  },
  share: {
    share: "Teilen",
    text: "Schau mal, mein Ausstecher – direkt anpassen und als 3MF/STL herunterladen:",
    copy: "Link kopieren",
    copied: "Kopiert",
  },
  legal: {
    close: "Schließen",
  },
  footer: {
    imprint: "Impressum & Datenschutz",
  },
  errors: {
    engine: "Geometrie-Engine konnte nicht geladen werden.",
    build: "Aus dieser Form ließ sich kein Ausstecher erzeugen.",
    read: "Datei konnte nicht gelesen werden.",
    invalidSvg: "Keine gültige SVG-Datei.",
    noCanvas: "Dein Browser unterstützt kein Canvas.",
  },
};
