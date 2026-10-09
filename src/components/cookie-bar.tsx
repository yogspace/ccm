import {
  ArrowUpRight,
  Cloud,
  CloudOff,
  KeyRound,
  Link2,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import {
  account,
  eatEverywhere,
  type OnlineResult,
  putOnline,
  replacedBy,
  replaceOnline,
  takeBack,
} from "../account/client";
import { cn } from "../cn";
import { type Launch, onCookieLaunch } from "../cookie-flight";
import { eatCookie, openCookie, setJarOpen, store } from "../store";
import { openAccount } from "./account-dialog";
import Button from "./button";
import { CookieFlight, Crumbs } from "./cookie-fx";
import CookieIcon from "./cookie-icon";
import { cookieInButton, cookieInIconButton, menu, menuItem } from "./styles";

/** How long (ms) a fresh cookie is announced. */
const FRESH_MS = 4000;
/** How long (ms) crumbs stay. */
const CRUMBS_MS = 700;

const spring = { type: "spring", stiffness: 420, damping: 26 } as const;
// A landing cookie overshoots a little – it plops into its place.
const plop = { type: "spring", stiffness: 520, damping: 14 } as const;

type Burst = { at: { x: number; y: number }; id: number };

/**
 * Online too? A changed version of an online one: its short link to it?
 * Offline again? Eat one that is online?
 */
type Prompt = { kind: "ask" | "replace" | "back" | "eat"; hash: string };

/**
 * The cookie bar: “This site uses cookies” – your own. Every creation kept
 * as a cookie in its own shape; a click on one asks what to do with it. It opens on every visit (and when a cookie is saved) until closed; then
 * a jar brings it back.
 *
 * It sits right above the footer and sticks to the bottom of the screen
 * while scrolling – so it never covers the footer or the sun. It slides in
 * with the first scroll (or right away when a cookie is saved).
 *
 * Filling it is a little show: the saved cookie flies from its button into
 * its place (cookie-fx.tsx), the others make room, it plops in with crumbs,
 * the bar gulps. Eaten cookies leave with a twist and crumbs, the gap closes.
 *
 * Each cookie is offline – on this device only – or online
 * (account/client.ts); its cloud says which. A click on a cookie asks what
 * to do: open it, put it online or take it offline, eat it. Online, it is in the
 * account, on every device, and its link is short; taken offline (asked
 * first: its short link goes) it is on this device only again.
 * Saving asks whether to put it online. The first one online makes the
 * account (account-dialog.tsx); “Log in” fetches the online cookies on
 * another device – so the closed jar stays even when empty.
 */
const CookieBar = () => {
  const { t } = useTranslation();
  const { jar, jarOpen, lastSaved } = useSnapshot(store);
  const { state, busy } = useSnapshot(account);
  const still = useReducedMotion();
  /** A question about a cookie, in a row under the bar. */
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [failed, setFailed] = useState<OnlineResult | null>(null);
  const [, expire] = useState(0);
  // With cookies in it, the bar is there right away; empty, the jar comes
  // with the first scroll.
  const [shown, setShown] = useState(
    () => window.scrollY > 0 || store.jar.length > 0
  );
  /** The cookie whose menu is open (its hash). */
  const [chosen, setChosen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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
    if (lastSaved || jar.length > 0) setShown(true);
  }, [lastSaved, jar.length]);

  // Chosen, its menu opens by it (anchored to its tile).
  useEffect(() => {
    if (chosen) menuRef.current?.showPopover();
  }, [chosen]);
  const closeMenu = () => {
    try {
      menuRef.current?.hidePopover();
    } catch {
      // Closed already.
    }
  };
  const inMenu = chosen ? jar.find(({ hash }) => hash === chosen) : undefined;

  // Just saved, offline: online too? Asked with every save – changed from
  // an online cookie: its short link to this version, or a new cookie?
  const savedAt = newest?.savedAt;
  useEffect(() => {
    if (!(savedAt && lastSaved)) return;
    const cookie = store.jar.find(({ hash }) => hash === lastSaved);
    if (cookie && !cookie.code) {
      const kind = replacedBy(lastSaved) ? "replace" : "ask";
      setPrompt({ kind, hash: lastSaved });
    }
  }, [savedAt, lastSaved]);
  const asked = prompt && jar.find(({ hash }) => hash === prompt.hash);
  // Online by now (from the share box), the question is answered.
  const showPrompt =
    asked &&
    !((prompt.kind === "ask" || prompt.kind === "replace") && asked.code);

  const goOnline = async (hash: string) => {
    setFailed(null);
    setPrompt(null);
    const result = await putOnline(hash);
    if (result === "login") openAccount();
    else if (result !== "ok") setFailed(result);
  };

  const goReplace = async (hash: string) => {
    setFailed(null);
    setPrompt(null);
    const result = await replaceOnline(hash);
    if (result === "login") openAccount();
    else if (result !== "ok") setFailed(result);
  };

  const goBack = async (hash: string) => {
    setFailed(null);
    if (await takeBack(hash)) setPrompt(null);
    else setFailed("failed");
  };

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
    const tile = slot?.querySelector("[data-cookie]");
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

  /** Eats a cookie – online, only once asked (its short link goes). */
  const eat = async (hash: string, asked = false) => {
    const cookie = store.jar.find((other) => other.hash === hash);
    if (cookie?.code && !asked) {
      setPrompt({ kind: "eat", hash });
      return;
    }
    const tile = slots.current.get(hash)?.querySelector("[data-cookie]");
    const box = tile && !still ? tile.getBoundingClientRect() : null;
    setFailed(null);
    if (cookie?.code) {
      if (!(await eatEverywhere(hash))) {
        setFailed("failed");
        return;
      }
    } else eatCookie(hash);
    setPrompt(null);
    if (box) {
      crumble({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    }
  };

  const line = fresh
    ? t("jar.fresh", { name: fresh.name || t("jar.unnamed") })
    : t("jar.subtitle", { count: jar.length });

  // Closed, the jar sits on the right. Where the bar gets as wide as the
  // page, it stays above the sun too.
  return (
    <div
      className="pointer-events-none sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex translate-y-[calc(100%+2rem)] justify-center opacity-0 [transition:translate_0.6s_var(--ease-spring),opacity_0.3s_var(--ease-soft)] *:pointer-events-auto data-closed:justify-end data-shown:translate-y-0 data-shown:opacity-100 max-lg:mb-14"
      data-closed={!jarOpen || undefined}
      data-shown={shown || undefined}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {jarOpen ? (
          <motion.aside
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-label={t("jar.label")}
            className="grid max-w-[min(62rem,100%)] grid-cols-[auto_minmax(0,auto)_auto] items-center gap-x-5 gap-y-2 rounded-3xl bg-surface py-2.5 pr-3.5 pl-6 text-ink shadow-[0_0.3rem_0.8rem_rgb(4_8_60/0.16),0_1.6rem_3rem_-1rem_rgb(4_8_60/0.5)] max-sm:w-full max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:pt-3 max-sm:pr-3 max-sm:pb-2 max-sm:pl-4"
            exit={{ opacity: 0, scale: 0.85, y: 16 }}
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            key="bar"
            layout
            transition={spring}
          >
            {/* `layout` on the content too: while the bar animates its size,
                its content is kept from being stretched. */}
            <motion.div
              className="grid max-w-60 justify-items-start gap-0.5 text-small leading-[1.3] text-muted"
              layout="position"
            >
              <strong className="text-body text-ink">{t("jar.title")}</strong>
              {/* A new line (a fresh cookie, the count) slides in. */}
              <span
                aria-live="polite"
                className="animate-[rise_0.35s_var(--ease-soft)_both]"
                key={line}
              >
                {line}
              </span>
              {/* Logged out: “Log in” – the online cookies on this device
                  too; logged in: the account. */}
              <Button
                className="mt-1 gap-1 text-small font-bold"
                kind="link"
                onClick={openAccount}
                title={state === "in" ? undefined : t("jar.logInHint")}
                type="button"
              >
                <CookieIcon
                  className={cookieInButton}
                  icing={state === "in" ? "#ffc31f" : "#ffffff"}
                  icon={KeyRound}
                  key={state}
                  roll={-14}
                  size={36}
                />
                {state === "in" ? t("jar.account") : t("jar.logIn")}
              </Button>
            </motion.div>
            {/* Leaving cookies are taken out of the flow here (popLayout).
                On phones on a row of its own. */}
            <motion.ul
              className="relative flex snap-x gap-1 overflow-x-auto px-3 py-1 scrollbar-thin empty:hidden mask-[linear-gradient(90deg,transparent,#000_0.75rem,#000_calc(100%-0.75rem),transparent)] max-sm:col-span-full max-sm:row-start-2 max-sm:-mx-2"
              layout
              layoutScroll
              ref={listRef}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {jar.map((cookie) => {
                  const name = cookie.name || t("jar.unnamed");
                  const status = cookie.code
                    ? t("jar.statusOnline")
                    : t("jar.statusOffline");
                  // Its place is made, but it shows only once it has landed.
                  const waiting = flight?.hash === cookie.hash;
                  return (
                    <motion.li
                      animate={
                        waiting
                          ? { opacity: 0, scale: 0.4 }
                          : { opacity: 1, scale: 1, rotate: 0 }
                      }
                      className={cn(
                        "relative flex-none snap-start",
                        chosen === cookie.hash && "[anchor-name:--cookie-menu]"
                      )}
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
                        aria-haspopup="menu"
                        aria-label={`${name} – ${status}`}
                        className="h-auto w-24 flex-col gap-0 rounded-xl bg-transparent px-1 pt-1 pb-1.5 text-tiny hover:enabled:bg-surface-2"
                        onClick={() => setChosen(cookie.hash)}
                        title={`${name} – ${status}`}
                        type="button"
                      >
                        <CookieIcon
                          className="-mt-3 -mb-2"
                          shape={cookie.shape}
                          size={92}
                          tilt={-0.35}
                        />
                        <span className="max-w-full truncate">{name}</span>
                      </Button>
                      {/* Online or offline: the cloud only says which – clear
                          when online, see-through when not. */}
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute top-0 left-0 grid size-7 place-items-center",
                          !cookie.code && "opacity-35"
                        )}
                      >
                        <CookieIcon
                          className={cookieInIconButton}
                          icing="#2a44ff"
                          icon={Cloud}
                          size={34}
                          spin={busy.includes(cookie.hash)}
                        />
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </motion.ul>
            <Button
              aria-label={t("jar.close")}
              className="size-10 self-start"
              kind="icon"
              layout="position"
              onClick={() => {
                setJarOpen(false);
                setPrompt(null);
                setFailed(null);
              }}
              title={t("jar.close")}
              type="button"
            >
              <CookieIcon
                className={cookieInIconButton}
                icing="#ff5fa8"
                icon={X}
                roll={8}
                size={52}
              />
            </Button>
            {/* A question about a cookie, or what went wrong: a row of its
                own, under everything. */}
            {(showPrompt || failed) && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="col-span-full flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-surface-2 py-2 pr-2 pl-4 max-sm:-mr-1 max-sm:-ml-2"
                initial={{ opacity: 0, y: 6 }}
                layout="position"
              >
                {showPrompt ? (
                  <>
                    <p className="grid gap-px text-small leading-[1.3]">
                      <strong className="text-ink">
                        {t(`jar.${prompt.kind}Title`, {
                          // Switching: the short link's own cookie.
                          name:
                            (prompt.kind === "replace"
                              ? replacedBy(prompt.hash)?.name
                              : asked.name) || t("jar.unnamed"),
                        })}
                      </strong>
                      <span className="text-muted">
                        {failed
                          ? t(failed === "full" ? "jar.full" : "account.failed")
                          : t(`jar.${prompt.kind}Hint`)}
                      </span>
                    </p>
                    <span className="flex gap-2 max-xs:w-full max-xs:*:grow">
                      <Button
                        onClick={() => {
                          setFailed(null);
                          // Not in its place: a new cookie – online too?
                          setPrompt(
                            prompt.kind === "replace"
                              ? { kind: "ask", hash: prompt.hash }
                              : null
                          );
                        }}
                        type="button"
                      >
                        {t(
                          prompt.kind === "ask"
                            ? "jar.askNo"
                            : prompt.kind === "replace"
                              ? "jar.replaceNo"
                              : "jar.cancel"
                        )}
                      </Button>
                      <Button
                        disabled={busy.includes(prompt.hash)}
                        kind="primary"
                        onClick={() =>
                          prompt.kind === "ask"
                            ? goOnline(prompt.hash)
                            : prompt.kind === "replace"
                              ? goReplace(prompt.hash)
                              : prompt.kind === "back"
                                ? goBack(prompt.hash)
                                : eat(prompt.hash, true)
                        }
                        type="button"
                      >
                        <CookieIcon
                          className={cookieInButton}
                          icing={
                            prompt.kind === "ask" || prompt.kind === "replace"
                              ? "#ffc31f"
                              : "#ff5fa8"
                          }
                          icon={
                            prompt.kind === "ask"
                              ? Cloud
                              : prompt.kind === "replace"
                                ? Link2
                                : prompt.kind === "back"
                                  ? CloudOff
                                  : X
                          }
                          roll={-8}
                          size={44}
                          spin={busy.includes(prompt.hash)}
                        />
                        {t(`jar.${prompt.kind}Yes`)}
                      </Button>
                    </span>
                  </>
                ) : (
                  <p className="py-1.5 text-small text-muted">
                    {t(failed === "full" ? "jar.full" : "account.failed")}
                  </p>
                )}
              </motion.div>
            )}
          </motion.aside>
        ) : (
          // The jar while the bar is closed – empty too: the way to log in.
          <motion.div
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.4, rotate: 12 }}
            initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
            key="jar"
            layout
            transition={plop}
          >
            <Button
              aria-label={t("jar.reopen", { count: jar.length })}
              className="relative size-16 rounded-2xl bg-surface p-0 shadow-[0_1rem_2rem_-0.8rem_rgb(4_8_60/0.55)] [transition:scale_0.4s_var(--ease-spring),background_0.2s_var(--ease-soft)] hover:enabled:bg-[color-mix(in_oklab,var(--color-surface-2)_82%,var(--color-ink))]"
              onClick={() => setJarOpen(true)}
              title={t("jar.reopen", { count: jar.length })}
              type="button"
            >
              <CookieIcon className="m-0" kind="chip" size={70} />
              {jar.length > 0 && (
                <motion.span
                  animate={{ scale: [1.4, 1] }}
                  className="absolute -top-1.5 -right-1.5 h-6 min-w-6 rounded-xl bg-neon px-1.5 text-tiny leading-6 text-on-neon"
                  key={jar.length}
                  transition={plop}
                >
                  {jar.length}
                </motion.span>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* What to do with a cookie: open it, put it online or take it
          offline, eat it. Logged out, putting it online leads to the account
          first; eating one online asks first. */}
      <div
        className={cn(
          menu,
          "[position-anchor:--cookie-menu] [position-area:block-start]"
        )}
        onToggle={(event) => {
          if (event.newState === "closed") setChosen(null);
        }}
        popover="auto"
        ref={menuRef}
        role="menu"
      >
        {inMenu && (
          <>
            <p className="grid gap-px px-3 pt-1.5 pb-2 text-small leading-[1.3]">
              <strong className="truncate text-body text-ink">
                {inMenu.name || t("jar.unnamed")}
              </strong>
              <span className="text-muted">
                {inMenu.code ? t("jar.statusOnline") : t("jar.statusOffline")}
              </span>
            </p>
            <Button
              className={menuItem}
              onClick={() => {
                closeMenu();
                openCookie(inMenu.hash);
              }}
              role="menuitem"
              type="button"
            >
              <CookieIcon
                className={cookieInButton}
                icing="#2a44ff"
                icon={ArrowUpRight}
                roll={-8}
                size={40}
              />
              {t("jar.openIt")}
            </Button>
            {inMenu.code ? (
              <Button
                className={menuItem}
                onClick={() => {
                  closeMenu();
                  if (state === "in") {
                    setPrompt({ kind: "back", hash: inMenu.hash });
                  } else openAccount();
                }}
                role="menuitem"
                type="button"
              >
                <CookieIcon
                  className={cookieInButton}
                  icing="#ff5fa8"
                  icon={CloudOff}
                  roll={8}
                  size={40}
                />
                {t("jar.offline")}
              </Button>
            ) : (
              <Button
                className={menuItem}
                onClick={() => {
                  closeMenu();
                  goOnline(inMenu.hash);
                }}
                role="menuitem"
                type="button"
              >
                <CookieIcon
                  className={cookieInButton}
                  icing="#2a44ff"
                  icon={Cloud}
                  roll={-8}
                  size={40}
                />
                {t("jar.online")}
              </Button>
            )}
            <Button
              className={menuItem}
              onClick={() => {
                closeMenu();
                eat(inMenu.hash);
              }}
              role="menuitem"
              type="button"
            >
              <CookieIcon
                className={cookieInButton}
                icing="#ff5fa8"
                icon={X}
                roll={8}
                size={40}
              />
              {t("jar.eatIt")}
            </Button>
          </>
        )}
      </div>
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
