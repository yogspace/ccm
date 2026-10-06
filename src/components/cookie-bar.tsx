import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { eatCookie, openCookie, setJarOpen, store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/** How long (ms) a fresh cookie is announced, and how long eating takes. */
const FRESH_MS = 4000;
const EAT_MS = 380;

/**
 * The cookie bar: “This site uses cookies” – your own. Every creation kept
 * as a cookie in its own shape; a click opens it again, the small cross eats
 * it. It opens on every visit (and when a cookie is saved) until closed; then
 * a jar brings it back.
 *
 * It sits right above the footer and sticks to the bottom of the screen
 * while scrolling – so it never covers the footer or the sun. It slides in
 * with the first scroll (or right away when a cookie is saved).
 */
const CookieBar = () => {
  const { t } = useTranslation();
  const { jar, jarOpen, lastSaved } = useSnapshot(store);
  const [eating, setEating] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [shown, setShown] = useState(() => window.scrollY > 0);
  const newest = jar.find((cookie) => cookie.hash === lastSaved);

  useEffect(() => {
    if (shown) return;
    const show = () => setShown(true);
    window.addEventListener("scroll", show, { once: true, passive: true });
    return () => window.removeEventListener("scroll", show);
  }, [shown]);

  useEffect(() => {
    if (lastSaved) setShown(true);
  }, [lastSaved]);

  // Announce a fresh cookie for a moment – also when the same one is saved again.
  useEffect(() => {
    if (!newest) return;
    setFresh(newest.name || t("jar.unnamed"));
    const timer = setTimeout(() => setFresh(null), FRESH_MS);
    return () => clearTimeout(timer);
  }, [newest, t]);

  if (jar.length === 0) return null;

  const eat = (hash: string) => {
    setEating(hash);
    setTimeout(() => {
      eatCookie(hash);
      setEating(null);
    }, EAT_MS);
  };

  return (
    <div className="cookie-dock" data-shown={shown || undefined}>
      <aside
        aria-label={t("jar.label")}
        className="cookie-bar"
        hidden={!jarOpen}
      >
        <p className="cookie-bar-text">
          <strong>{t("jar.title")}</strong>
          <span aria-live="polite">
            {fresh
              ? t("jar.fresh", { name: fresh })
              : t("jar.subtitle", { count: jar.length })}
          </span>
        </p>
        <ul className="cookie-bar-list">
          {jar.map((cookie) => {
            const name = cookie.name || t("jar.unnamed");
            return (
              <li
                className="cookie-bar-item"
                data-eating={eating === cookie.hash || undefined}
                data-fresh={cookie.hash === lastSaved || undefined}
                key={cookie.hash}
              >
                <Button
                  aria-label={t("jar.open", { name })}
                  className="cookie-bar-cookie"
                  onClick={() => openCookie(cookie.hash)}
                  title={t("jar.open", { name })}
                  type="button"
                >
                  <CookieIcon
                    className="cookie-tile"
                    shape={cookie.shape}
                    size={92}
                    tilt={-0.35}
                  />
                  <span>{name}</span>
                </Button>
                <Button
                  aria-label={t("jar.eat", { name })}
                  className="icon cookie-bar-eat"
                  onClick={() => eat(cookie.hash)}
                  title={t("jar.eat", { name })}
                  type="button"
                >
                  <CookieIcon
                    className="cookie-eat"
                    icing="#ff5fa8"
                    icon={X}
                    size={34}
                  />
                </Button>
              </li>
            );
          })}
        </ul>
        <Button
          aria-label={t("jar.close")}
          className="icon cookie-bar-close"
          onClick={() => setJarOpen(false)}
          title={t("jar.close")}
          type="button"
        >
          <CookieIcon icing="#ff5fa8" icon={X} roll={8} size={52} />
        </Button>
      </aside>
      <Button
        aria-label={t("jar.reopen", { count: jar.length })}
        className="cookie-jar"
        hidden={jarOpen}
        onClick={() => setJarOpen(true)}
        title={t("jar.reopen", { count: jar.length })}
        type="button"
      >
        <CookieIcon className="cookie-jar-icon" kind="chip" size={70} />
        <span className="cookie-jar-count">{jar.length}</span>
      </Button>
    </div>
  );
};

export default CookieBar;
