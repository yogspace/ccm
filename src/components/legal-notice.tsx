import { X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import Button from "./button";
import CookieIcon from "./cookie-icon";

const ADDRESS = (
  <address>
    Maximilian Weber
    <br />
    Waltherstraße 2
    <br />
    64289 Darmstadt
    <br />
    Deutschland
  </address>
);

const CONTACT_URL = "https://mxwr.de/de/impressum";
const REPO_URL = "https://github.com/yogspace/ccm";
const DONATE_URL = "https://paypal.me/yogspace";

const German = () => (
  <>
    <h2>Impressum</h2>
    <h3>Angaben gemäß § 5 DDG</h3>
    {ADDRESS}
    <p>
      Kontakt: über das{" "}
      <a href={CONTACT_URL} rel="noopener" target="_blank">
        Kontaktformular auf mxwr.de
      </a>
    </p>
    <h3>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
    {ADDRESS}

    <h2>Datenschutz</h2>
    <h3>Verantwortlicher</h3>
    <p>Maximilian Weber, Anschrift siehe oben.</p>
    <h3>Verarbeitung im Browser</h3>
    <p>
      Zeichnungen, hochgeladene SVGs und die erzeugten 3D-Modelle werden
      ausschließlich in deinem Browser verarbeitet und nicht an den Server
      übertragen. Ein geteilter Link enthält die Form im Teil hinter dem „#“;
      dieser Teil wird vom Browser nicht an den Server gesendet.
    </p>
    <p>
      Sprache und Maßeinheit werden im lokalen Speicher deines Browsers
      abgelegt, damit sie beim nächsten Besuch erhalten bleiben. Es werden keine
      Cookies gesetzt und keine Analyse- oder Tracking-Dienste eingesetzt.
    </p>
    <p>
      Die Schriftart „Pally“ (Indian Type Foundry, über Fontshare) wird vom
      eigenen Server geladen. Beim Aufruf werden dafür keine Daten an Dritte
      übertragen.
    </p>
    <h3>Hosting und Server-Logfiles</h3>
    <p>
      Die Website wird bei der Hetzner Online GmbH, Industriestr. 25, 91710
      Gunzenhausen, Deutschland, gehostet; es besteht ein Vertrag zur
      Auftragsverarbeitung. Beim Aufruf werden technisch notwendige Daten
      (IP-Adresse, Datum und Uhrzeit, aufgerufene Datei, Browsertyp und
      Betriebssystem) in Server-Logfiles verarbeitet, um die Website
      bereitzustellen und ihre Sicherheit zu gewährleisten. Rechtsgrundlage ist
      Art. 6 Abs. 1 lit. f DSGVO.
    </p>
    <h3>Deine Rechte</h3>
    <p>
      Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16),
      Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und
      Widerspruch (Art. 21 DSGVO) sowie ein Beschwerderecht bei einer
      Datenschutzaufsichtsbehörde.
    </p>

    <h2>Projekt</h2>
    <p>
      Der Quellcode liegt offen auf{" "}
      <a href={REPO_URL} rel="noopener" target="_blank">
        GitHub
      </a>
      . Wenn dir der Cookie Cutter Maker gefällt, kannst du mir über{" "}
      <a href={DONATE_URL} rel="noopener" target="_blank">
        PayPal
      </a>{" "}
      einen Keks spendieren.
    </p>
  </>
);

const English = () => (
  <>
    <h2>Legal notice</h2>
    <h3>Information pursuant to § 5 DDG (German Digital Services Act)</h3>
    {ADDRESS}
    <p>
      Contact: via the{" "}
      <a href={CONTACT_URL} rel="noopener" target="_blank">
        contact form on mxwr.de
      </a>
    </p>
    <h3>Responsible for content pursuant to § 18 (2) MStV</h3>
    {ADDRESS}

    <h2>Privacy</h2>
    <h3>Controller</h3>
    <p>Maximilian Weber, address see above.</p>
    <h3>Processing in your browser</h3>
    <p>
      Drawings, uploaded SVGs and the generated 3D models are processed entirely
      in your browser and are never sent to the server. A shared link carries
      the shape in the part after the “#”, which browsers do not send to the
      server.
    </p>
    <p>
      Your language and unit are kept in your browser’s local storage so they
      persist between visits. No cookies are set and no analytics or tracking
      services are used.
    </p>
    <p>
      The typeface “Pally” (Indian Type Foundry, via Fontshare) is served from
      our own server, so no data is sent to third parties to load it.
    </p>
    <h3>Hosting and server logs</h3>
    <p>
      The site is hosted by Hetzner Online GmbH, Industriestr. 25, 91710
      Gunzenhausen, Germany, under a data processing agreement. When you visit,
      technically necessary data (IP address, date and time, requested file,
      browser type and operating system) is processed in server logs to deliver
      the site and keep it secure. Legal basis: Art. 6 (1) (f) GDPR.
    </p>
    <h3>Your rights</h3>
    <p>
      You have the right of access (Art. 15 GDPR), rectification (Art. 16),
      erasure (Art. 17), restriction of processing (Art. 18) and objection (Art.
      21 GDPR), and the right to lodge a complaint with a supervisory authority.
    </p>

    <h2>Project</h2>
    <p>
      The source code is open on{" "}
      <a href={REPO_URL} rel="noopener" target="_blank">
        GitHub
      </a>
      . If you like Cookie Cutter Maker, you can buy me a cookie via{" "}
      <a href={DONATE_URL} rel="noopener" target="_blank">
        PayPal
      </a>
      .
    </p>
  </>
);

const LegalNotice = () => {
  const { t, i18n } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        className="link"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        {t("footer.imprint")}
      </Button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape schließt den Dialog nativ, der Klick ist nur für den Hintergrund */}
      <dialog
        aria-label={t("footer.imprint")}
        className="legal"
        // Klick auf den abgedunkelten Hintergrund schließt den Dialog.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        ref={dialogRef}
      >
        {/* Außerhalb des Scrollbereichs, damit er beim Scrollen stehen bleibt. */}
        <Button
          aria-label={t("legal.close")}
          className="icon legal-close"
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          <CookieIcon icing="#ff5fa8" icon={X} roll={8} size={56} />
        </Button>
        <div className="legal-body">
          {i18n.resolvedLanguage === "de" ? <German /> : <English />}
        </div>
      </dialog>
    </>
  );
};

export default LegalNotice;
