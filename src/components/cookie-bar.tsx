import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { type Launch, onCookieLaunch } from "../cookie-flight";
import { eatCookie, openCookie, setJarOpen, store } from "../store";
import Button from "./button";
import { CookieFlight, Crumbs } from "./cookie-fx";
import CookieIcon from "./cookie-icon";

/** How long (ms) a fresh cookie is announced. */
const FRESH_MS = 4000;
/** How long (ms) crumbs stay. */
const CRUMBS_MS = 700;

const spring = { type: "spring", stiffness: 420, damping: 26 } as const;
// A landing cookie overshoots a little – it plops into its place.
const plop = { type: "spring", stiffness: 520, damping: 14 } as const;

type Burst = { at: { x: number; y: number }; id: number };

/**
 * The cookie bar: “This site uses cookies” – your own. Every creation kept
 * as a cookie in its own shape; a click opens it again, the small cross eats
 * it. It opens on every visit (and when a cookie is saved) until closed; then
 * a jar brings it back.
 *
 * It sits right above the footer and sticks to the bottom of the screen
 * while scrolling – so it never covers the footer or the sun. It slides in
 * with the first scroll (or right away when a cookie is saved).
 *
 * Filling it is a little show: the saved cookie flies from its button into
 * its place (cookie-fx.tsx), the others make room, it plops in with crumbs,
 * the bar gulps. Eaten cookies leave with a twist and crumbs, the gap closes.
 */
const CookieBar = () => {
  const { t } = useTranslation();
  const { jar, jarOpen, lastSaved } = useSnapshot(store);
  const still = useReducedMotion();
  const [, expire] = useState(0);
  const [shown, setShown] = useState(() => window.scrollY > 0);
  const [flight, setFlight] = useState<Launch | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const listRef = useRef<HTMLUListElement>(null);
  const slots = useRef(new Map<string, HTMLLIElement>());
  const newest = jar.find((cookie) => cookie.hash === lastSaved);
  const flying = flight
    ? jar.find((cookie) => cookie.hash === flight.hash)
    : undefined;

  useEffect(() => {
    if (shown) return;
    const show = () => setShown(true);
    window.addEventListener("scroll", show, { once: true, passive: true });
    return () => window.removeEventListener("scroll", show);
  }, [shown]);

  useEffect(() => {
    if (lastSaved) setShown(true);
  }, [lastSaved]);

  // A cookie takes off: the list goes back to its start, where it lands.
  useEffect(
    () =>
      onCookieLaunch((launch) => {
        setShown(true);
        listRef.current?.scrollTo({ left: 0, behavior: "smooth" });
        if (!still) setFlight(launch);
      }),
    [still]
  );

  // A fresh cookie is announced for a moment – also when the same one is
  // saved again. Taken from when it was baked, so the line changes once with
  // the count, not twice.
  const age = newest ? Date.now() - newest.savedAt : Number.POSITIVE_INFINITY;
  const fresh = age < FRESH_MS ? newest : undefined;
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(
      () => expire((n) => n + 1),
      FRESH_MS - (Date.now() - fresh.savedAt)
    );
    return () => clearTimeout(timer);
  }, [fresh]);

  const crumble = useCallback((at: { x: number; y: number }) => {
    const id = performance.now();
    setBursts((current) => [...current, { at, id }]);
    setTimeout(
      () => setBursts((current) => current.filter((burst) => burst.id !== id)),
      CRUMBS_MS
    );
  }, []);

  /**
   * Where the flying cookie lands: the middle of its tile. The slot is still
   * shrunk (it waits for its cookie), so its own scale is taken out.
   */
  const landingSpot = useCallback(() => {
    const slot = flight && slots.current.get(flight.hash);
    const tile = slot?.querySelector(".cookie");
    if (!(slot && tile)) return null;
    const box = slot.getBoundingClientRect();
    const scale = box.width / (slot.offsetWidth || 1) || 1;
    const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const inner = tile.getBoundingClientRect();
    return {
      x: middle.x + (inner.left + inner.width / 2 - middle.x) / scale,
      y: middle.y + (inner.top + inner.height / 2 - middle.y) / scale,
    };
  }, [flight]);

  // Landed: it plops in, crumbs fly, the list gulps.
  const land = (at: { x: number; y: number }) => {
    setFlight(null);
    crumble(at);
    listRef.current?.animate(
      [{ scale: "1" }, { scale: "1.035" }, { scale: "1" }],
      { duration: 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
    );
  };

  const eat = (hash: string) => {
    const tile = slots.current.get(hash)?.querySelector(".cookie");
    if (tile && !still) {
      const box = tile.getBoundingClientRect();
      crumble({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    }
    eatCookie(hash);
  };

  if (jar.length === 0 && bursts.length === 0) return null;

  const line = fresh
    ? t("jar.fresh", { name: fresh.name || t("jar.unnamed") })
    : t("jar.subtitle", { count: jar.length });

  return (
    <div
      className="cookie-dock"
      data-closed={!jarOpen || undefined}
      data-shown={shown || undefined}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {jarOpen ? (
          <motion.aside
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-label={t("jar.label")}
            className="cookie-bar"
            exit={{ opacity: 0, scale: 0.85, y: 16 }}
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            key="bar"
            layout
            transition={spring}
          >
            {/* `layout` on the content too: while the bar animates its size,
                its content is kept from being stretched. */}
            <motion.p className="cookie-bar-text" layout="position">
              <strong>{t("jar.title")}</strong>
              <span aria-live="polite" className="cookie-bar-line" key={line}>
                {line}
              </span>
            </motion.p>
            <motion.ul
              className="cookie-bar-list"
              layout
              layoutScroll
              ref={listRef}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {jar.map((cookie) => {
                  const name = cookie.name || t("jar.unnamed");
                  // Its place is made, but it shows only once it has landed.
                  const waiting = flight?.hash === cookie.hash;
                  return (
                    <motion.li
                      animate={
                        waiting
                          ? { opacity: 0, scale: 0.4 }
                          : { opacity: 1, scale: 1, rotate: 0 }
                      }
                      className="cookie-bar-item"
                      exit={{
                        opacity: 0,
                        scale: 0.2,
                        rotate: -50,
                        transition: { duration: 0.3 },
                      }}
                      initial={{ opacity: 0, scale: 0.4 }}
                      key={cookie.hash}
                      layout
                      ref={(element) => {
                        if (element) slots.current.set(cookie.hash, element);
                        else slots.current.delete(cookie.hash);
                      }}
                      transition={waiting ? { duration: 0 } : plop}
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
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </motion.ul>
            <Button
              aria-label={t("jar.close")}
              className="icon cookie-bar-close"
              layout="position"
              onClick={() => setJarOpen(false)}
              title={t("jar.close")}
              type="button"
            >
              <CookieIcon icing="#ff5fa8" icon={X} roll={8} size={52} />
            </Button>
          </motion.aside>
        ) : jar.length > 0 ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            className="cookie-jar-wrap"
            exit={{ opacity: 0, scale: 0.4, rotate: 12 }}
            initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
            key="jar"
            layout
            transition={plop}
          >
            <Button
              aria-label={t("jar.reopen", { count: jar.length })}
              className="cookie-jar"
              onClick={() => setJarOpen(true)}
              title={t("jar.reopen", { count: jar.length })}
              type="button"
            >
              <CookieIcon className="cookie-jar-icon" kind="chip" size={70} />
              <motion.span
                animate={{ scale: [1.4, 1] }}
                className="cookie-jar-count"
                key={jar.length}
                transition={plop}
              >
                {jar.length}
              </motion.span>
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {flight && flying && (
        <CookieFlight
          from={flight.from}
          key={flight.id}
          onLand={land}
          shape={flying.shape}
          target={landingSpot}
        />
      )}
      {bursts.map((burst) => (
        <Crumbs at={burst.at} key={burst.id} seed={Math.round(burst.id)} />
      ))}
    </div>
  );
};

export default CookieBar;
