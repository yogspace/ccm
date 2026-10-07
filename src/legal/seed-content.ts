import type { Locale } from "../seo";
import type { SiteLinks } from "../site-defaults";

/**
 * The legal text as it stood in the code before the CMS, as Lexical JSON –
 * what the “Imprint & privacy” global is seeded with at the first start
 * (legal/seed.ts), and what the page shows without a database.
 *
 * Written with a few small helpers instead of raw JSON: the nodes are the
 * ones the admin's editor writes itself (globals/legal.ts).
 */

type Node = Record<string, unknown>;

const text = (value: string): Node => ({
  type: "text",
  text: value,
  format: 0,
  style: "",
  mode: "normal",
  detail: 0,
  version: 1,
});

const element = (type: string, children: Node[], extra: Node = {}): Node => ({
  type,
  children,
  direction: "ltr",
  format: "",
  indent: 0,
  version: 1,
  ...extra,
});

const h2 = (value: string) => element("heading", [text(value)], { tag: "h2" });
const h3 = (value: string) => element("heading", [text(value)], { tag: "h3" });

/** A paragraph; strings are text, nodes (a site link) go in as they are. */
const p = (...parts: (string | Node)[]) =>
  element(
    "paragraph",
    parts.map((part) => (typeof part === "string" ? text(part) : part)),
    { textFormat: 0, textStyle: "" }
  );

let counter = 0;
/** Block ids as Payload makes them – 24 hex digits, stable for one seed. */
const id = () => (counter++).toString(16).padStart(24, "0");

const block = (blockType: string): Node => ({
  type: "block",
  format: "",
  version: 2,
  fields: { id: id(), blockName: "", blockType },
});

const siteLink = (link: keyof SiteLinks, label: string): Node => ({
  type: "inlineBlock",
  version: 1,
  fields: { id: id(), blockName: "", blockType: "siteLink", link, label },
});

const root = (children: Node[]) => ({
  root: element("root", children),
});

const german = () =>
  root([
    h2("Impressum"),
    h3("Angaben gemäß § 5 DDG"),
    block("address"),
    h3("Kontakt"),
    block("contactForm"),
    h3("Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV"),
    block("address"),

    h2("Datenschutz"),
    h3("Verantwortlicher"),
    p("Maximilian Weber, Anschrift siehe oben."),
    h3("Verarbeitung im Browser"),
    p(
      "Zeichnungen, hochgeladene SVGs und die erzeugten 3D-Modelle werden ausschließlich in deinem Browser verarbeitet und nicht an den Server übertragen. Ein geteilter Link enthält die Form im Teil hinter dem „#“; dieser Teil wird vom Browser nicht an den Server gesendet. Das gilt auch für Grußkarten samt Namen und Nachricht."
    ),
    p(
      "Sprache und Maßeinheit werden im lokalen Speicher deines Browsers abgelegt, damit sie beim nächsten Besuch erhalten bleiben – ebenso die Kreationen, die du als Keks speicherst (Link, Name, Größe und Umriss). Sie verlassen deinen Browser nicht; „Aufessen“ löscht einen Keks. Von sich aus setzt die Seite keine Cookies (nur gebackene), und Analyse- oder Tracking-Dienste Dritter kommen nicht zum Einsatz."
    ),
    p(
      "Die Schriftart „Pally“ (Indian Type Foundry, über Fontshare) wird vom eigenen Server geladen. Beim Aufruf werden dafür keine Daten an Dritte übertragen."
    ),
    h3("Hosting und Server-Logfiles"),
    p(
      "Die Website wird bei der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland, gehostet; es besteht ein Vertrag zur Auftragsverarbeitung. Beim Aufruf werden technisch notwendige Daten (IP-Adresse, Datum und Uhrzeit, aufgerufene Datei, Browsertyp und Betriebssystem) in Server-Logfiles verarbeitet, um die Website bereitzustellen und ihre Sicherheit zu gewährleisten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO."
    ),
    h3("Anonyme Statistik"),
    p(
      "Damit ich sehe, ob und wie der Cookie Cutter Maker genutzt wird, meldet die Seite beim Aufruf und bei einzelnen Aktionen (etwa Download, Teilen oder Karte erstellen) eine kurze Nachricht an meinen Server. Gespeichert werden dazu nur grobe Angaben: aufgerufene Seite, grobe Herkunft (etwa „Google“ oder „direkt“, nie die vollständige Adresse), Geräteklasse, Betriebssystem und Browser mit Hauptversion sowie der Zeitpunkt. Es werden keine Cookies gesetzt, keine IP-Adressen gespeichert und keine Kennungen vergeben – einzelne Einträge lassen sich weder einer Person zuordnen noch miteinander verknüpfen. Zeichnungen, Namen und Nachrichten werden nie übertragen. Die Einträge werden nach 90 Tagen gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Sendet dein Browser das Signal „Global Privacy Control“, wird nichts gezählt."
    ),
    h3("Kontaktformular"),
    p(
      "Wenn du mir über das Formular schreibst, gehen Name, E-Mail-Adresse und Nachricht per E-Mail an mich – verschickt über den Versanddienst Resend (Resend, Inc., USA). Gespeichert wird auf dem Server nichts. Ich nutze die Angaben nur, um dir zu antworten, und lösche die Mail, wenn die Sache erledigt ist (Art. 6 Abs. 1 lit. b und f DSGVO). Gegen Missbrauch hält der Server deine IP-Adresse höchstens zehn Minuten im Arbeitsspeicher."
    ),
    h3("Kekse spendieren über PayPal"),
    p(
      "Der Link „Spendier mir ’nen Keks“ führt zu PayPal (PayPal (Europe) S.à r.l. et Cie, S.C.A., 22–24 Boulevard Royal, L-2449 Luxemburg). Daten gehen erst an PayPal, wenn du ihn anklickst; dort gelten die Datenschutzhinweise von PayPal. Schickst du etwas, erhalte ich von PayPal deinen Namen, deine E-Mail-Adresse und den Betrag und nutze sie nur für die Abwicklung und meine Buchhaltung (Art. 6 Abs. 1 lit. b und c DSGVO)."
    ),
    h3("Deine Rechte"),
    p(
      "Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Widerspruch (Art. 21 DSGVO) sowie ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde."
    ),

    h2("Projekt"),
    p(
      "Der Quellcode liegt offen auf ",
      siteLink("source", "GitHub"),
      ". Wenn dir der Cookie Cutter Maker gefällt, kannst du mir über ",
      siteLink("donate", "PayPal"),
      " einen Keks spendieren."
    ),
  ]);

const english = () =>
  root([
    h2("Legal notice"),
    h3("Information pursuant to § 5 DDG (German Digital Services Act)"),
    block("address"),
    h3("Contact"),
    block("contactForm"),
    h3("Responsible for content pursuant to § 18 (2) MStV"),
    block("address"),

    h2("Privacy"),
    h3("Controller"),
    p("Maximilian Weber, address see above."),
    h3("Processing in your browser"),
    p(
      "Drawings, uploaded SVGs and the generated 3D models are processed entirely in your browser and are never sent to the server. A shared link carries the shape in the part after the “#”, which browsers do not send to the server. The same goes for greeting cards with their names and message."
    ),
    p(
      "Your language and unit are kept in your browser’s local storage so they persist between visits – and so are the creations you save as cookies (link, name, size and outline). They never leave your browser; eating a cookie deletes it. The site sets no cookies of its own accord (only baked ones), and no third-party analytics or tracking services are used."
    ),
    p(
      "The typeface “Pally” (Indian Type Foundry, via Fontshare) is served from our own server, so no data is sent to third parties to load it."
    ),
    h3("Hosting and server logs"),
    p(
      "The site is hosted by Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany, under a data processing agreement. When you visit, technically necessary data (IP address, date and time, requested file, browser type and operating system) is processed in server logs to deliver the site and keep it secure. Legal basis: Art. 6 (1) (f) GDPR."
    ),
    h3("Anonymous statistics"),
    p(
      "So I can see whether and how Cookie Cutter Maker is used, the site sends a short note to my server when a page is opened and for some actions (such as downloading, sharing or creating a card). Only coarse details are stored: the page, a coarse source (such as “Google” or “direct”, never the full address), device class, operating system and browser with its major version, and the time. No cookies are set, no IP addresses stored and no identifiers assigned – single entries can neither be traced to a person nor linked to each other. Drawings, names and messages are never sent. The entries are deleted after 90 days. Legal basis: Art. 6 (1) (f) GDPR. If your browser sends the “Global Privacy Control” signal, nothing is counted."
    ),
    h3("Contact form"),
    p(
      "When you write to me with the form, your name, email address and message reach me by email – sent through the mail service Resend (Resend, Inc., USA). Nothing is stored on the server. I use the details only to answer you and delete the mail once the matter is settled (Art. 6 (1) (b) and (f) GDPR). Against abuse the server keeps your IP address in memory for at most ten minutes."
    ),
    h3("Buying me a cookie via PayPal"),
    p(
      "The “Buy me a cookie” link leads to PayPal (PayPal (Europe) S.à r.l. et Cie, S.C.A., 22–24 Boulevard Royal, L-2449 Luxembourg). No data goes to PayPal until you click it; PayPal’s privacy notice applies there. If you send something, PayPal passes me your name, email address and the amount, which I use only to process it and for my bookkeeping (Art. 6 (1) (b) and (c) GDPR)."
    ),
    h3("Your rights"),
    p(
      "You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and objection (Art. 21 GDPR), and the right to lodge a complaint with a supervisory authority."
    ),

    h2("Project"),
    p(
      "The source code is open on ",
      siteLink("source", "GitHub"),
      ". If you like Cookie Cutter Maker, you can buy me a cookie via ",
      siteLink("donate", "PayPal"),
      "."
    ),
  ]);

/** The legal text in a language, as Lexical JSON. */
export const legalSeed = (locale: Locale) =>
  locale === "de" ? german() : english();
