import { ArrowUpRight } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../analytics";
import { Crumbs } from "../components/cookie-fx";
import CookieIcon from "../components/cookie-icon";
import RingText from "../components/ring-text";
import SiteFooter from "../components/site-footer";
import { cookieSeed } from "../cookie-jar";
import { setPageGlaze } from "../glaze";
import { useCardColor } from "../site-context";
import { formatLength, initialUnit } from "../units";
import CardActions from "./card-actions";
import CardBack from "./card-back";
import CardCookies from "./card-cookies";
import CardFront from "./card-front";
import { greeting, hasShape, shared } from "./card-link";
import GreetingCard from "./greeting-card";
import SpeechBubble from "./speech-bubble";
import { Confetti, Sprinkles } from "./sprinkles";
import { useBites } from "./use-bites";
import { useCutter } from "./use-cutter";

/** “… *click*” – what the card's speech bubbles say before a click. */
const Click = ({ children }: { children: string }) => {
  const { t } = useTranslation();
  return (
    <>
      {children} <em className="font-semibold">{t("card.click")}</em>
    </>
  );
};

/**
 * The greeting card's page: who it is for, the card with the cutter in the
 * middle and the message running around it, who it is from – then the files
 * to print it, the way to make your own and the footer. One screen, no
 * scrolling. A click turns the card over: on its back lies the cookie the
 * cutter bakes, to be eaten.
 */
const CardPage = () => {
  const { t, i18n } = useTranslation();
  // The favorite color from the CMS by its number – unknown: the first.
  // The page in its scheme, the cutter and the cookie's icing in it.
  const { glaze } = useCardColor(greeting.color);
  const { cutter, mesh, failed, retry, waitShown, baked, bake } = useCutter();
  /** Turned over: the cookie side up. Every turn bursts sprinkles again. */
  const [turns, setTurns] = useState(0);
  const flipped = turns % 2 === 1;
  const dough = useMemo(
    () =>
      cutter && baked
        ? {
            dough: cutter.outline,
            icing: cutter.icing,
            seed: cookieSeed(cutter.outline),
          }
        : null,
    [cutter, baked]
  );
  // The one on the back in the favorite color; those raining down stay
  // colorful.
  const cookie = useMemo(() => dough && { ...dough, glaze }, [dough, glaze]);
  const { bites, eaten, yum, crumbs, bite, reset } = useBites(cookie);

  const name = shared.name.trim() || "Cookie Cutter";
  const lang = i18n.resolvedLanguage ?? "en";
  const unit = initialUnit();
  const message = greeting.message || t("card.ring");
  const heading = greeting.to
    ? t("card.for", { name: greeting.to })
    : t("card.forYou");
  const sizeLabel = formatLength(
    shared.params.size,
    unit,
    lang,
    unit === "in" ? 1 : 0
  );

  // The page in the favorite color – set before the first paint already
  // (glaze.ts), kept while the card is open; the browser's bar along.
  useEffect(() => {
    setPageGlaze(glaze);
    const page = getComputedStyle(document.body).backgroundColor;
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )) {
      meta.content = page;
    }
    return () => setPageGlaze(null);
  }, [glaze]);

  useEffect(() => {
    document.title = greeting.to
      ? t("card.titleFor", { name: greeting.to })
      : t("card.title");
  }, [t]);

  // Back from the back/forward cache, its 3D views gave their memory away
  // (card-cutter.tsx) – so start afresh.
  useEffect(() => {
    const back = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, []);

  const turn = () => {
    setTurns((count) => count + 1);
    // Turned before the cookie is baked: it bakes now – the cutter's
    // entrance in front is out of sight anyway.
    bake();
    // Turned to the back: a fresh cookie – set while the back is still
    // hidden, so a bitten one never vanishes in view.
    if (!flipped) reset();
    if (turns === 0) trackEvent("card-turned");
  };

  // One screen without scrolling: who it is for, the card with the cutter
  // and the message running around it, who it is from, the files, the way to
  // the maker, the footer – room above and below the content (1fr). The
  // stage takes what is left, but never more than the width allows – any
  // room beyond that goes above and below, not between the lines. One
  // column, never wider than the screen – whatever is inside. Sizes follow
  // the screen's height, the card's insides follow the card (container
  // units). The card reaches into the safe areas.
  //
  // Phones: the card first and big – the stage wider than the screen, the
  // message running around goes out at the sides. The page scrolls on to
  // the buttons and the footer instead of squeezing the card into one
  // screen (index.css).
  //
  // Behind it all: light from behind the card, a neon glow rising from below.
  return (
    <main
      className="relative isolate grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[1fr_auto_minmax(0,min(100vw-2rem,38rem))_auto_auto_auto_1fr_auto] items-center justify-items-center gap-y-[clamp(0.3rem,1.5dvh,0.9rem)] overflow-hidden px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-center before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:bg-[radial-gradient(ellipse_55%_42%_at_50%_47%,rgb(255_255_255/0.2),transparent_72%),radial-gradient(ellipse_90%_55%_at_50%_118%,rgb(255_71_208/0.3),transparent_70%)] max-xs:h-auto max-xs:min-h-dvh max-xs:grid-rows-[1fr_auto_118vw_auto_auto_auto_1fr_auto]"
      data-greeting
    >
      {/* The card's own cookie, a few times in the background. */}
      {dough && <CardCookies shape={dough} />}
      {/* The rows above the cookies span the whole width, invisibly – they
          let clicks through to the cookies behind them; only the card (it
          turns over) and the buttons below take them. Who it is from and
          the buttons may be missing – their rows stay empty. */}
      <h1
        className="pointer-events-none row-start-2 mt-[clamp(0rem,1.5dvh,1rem)] max-w-full -rotate-2 animate-[greet-rise_0.9s_var(--ease-soft)_0.1s_both] text-[clamp(1.8rem,min(7.2dvh,150vw/(var(--chars,8)+2)),4.4rem)] leading-[1.05] font-bold tracking-tight wrap-anywhere embolden-25"
        // Long names get smaller instead of taking several lines.
        style={{ "--chars": heading.length } as CSSProperties}
      >
        {heading}
      </h1>

      {/* The stage is the largest square that fits the room left. Phones:
          wider than the screen – centred by hand, a grid puts what is wider
          than its cell at the start. */}
      <div className="pointer-events-none row-start-3 grid size-full min-h-0 place-items-center @container-size">
        <div
          className="pointer-events-none relative aspect-square w-[min(100cqw,100cqh,38rem)] @container max-xs:ml-[calc(50cqw-min(62.5cqw,50cqh))] max-xs:w-[min(125cqw,100cqh)] max-xs:justify-self-start"
          data-part="stage"
        >
          {/* The message, all the way around – slowly turning like a record. */}
          <RingText
            className="absolute inset-0 size-full animate-[ring-in_1.6s_var(--ease-soft)_0.45s_both,ring-turn_150s_linear_infinite] overflow-visible fill-on-page font-semibold whitespace-pre"
            text={message}
          />
          {greeting.message && <p className="sr-only">{greeting.message}</p>}
          <Sprinkles turns={turns} />
          {eaten && <Confetti />}
          {/* The cutter speaks: “Turn me *click*” – once it stands on the
              card, until the card is turned for the first time. */}
          <SpeechBubble
            delay={1.4}
            say={{ key: "turn", text: <Click>{t("card.turnMe")}</Click> }}
            shown={!!mesh && turns === 0}
          />
          {/* The cookie on the back speaks: “Eat me *click*” – once the card
              has turned, until the cookie is eaten (or the card turned
              back); after each bite something else (“Mmmh!”). */}
          <SpeechBubble
            delay={0.6}
            say={
              bites.length > 0 && yum
                ? { key: `yum-${bites.length}`, text: yum }
                : { key: "eat", text: <Click>{t("card.eatMe")}</Click> }
            }
            shown={flipped && !!cookie && !eaten}
            swing={bites.length % 2 === 0 ? 0 : 5}
          />
          <GreetingCard
            back={
              <CardBack
                bites={bites}
                cookie={cookie}
                eaten={eaten}
                message={message}
                name={name}
                onBite={bite}
              />
            }
            disabled={!hasShape}
            flipped={flipped}
            front={
              <CardFront
                failed={failed}
                flipped={flipped}
                glaze={glaze}
                mesh={mesh}
                name={name}
                sizeLabel={sizeLabel}
                waitShown={waitShown}
              />
            }
            held={flipped && !eaten}
            onTurn={turn}
          />
        </div>
      </div>

      {greeting.from && (
        <p
          className="pointer-events-none row-start-4 max-w-full -rotate-1 animate-[greet-rise_0.9s_var(--ease-soft)_0.65s_both] text-[clamp(1rem,min(3.3dvh,110vw/(var(--chars,8)+2)),1.7rem)] leading-[1.2] font-semibold text-on-page-muted wrap-anywhere"
          style={{ "--chars": greeting.from.length + 4 } as CSSProperties}
        >
          {t("card.fromName", { name: greeting.from })}
        </p>
      )}

      <CardActions
        failed={failed}
        glaze={glaze}
        heading={heading}
        mesh={mesh}
        name={name}
        onRetry={retry}
        sizeLabel={sizeLabel}
      />
      <a
        className="row-start-6 inline-flex animate-[greet-rise_0.9s_var(--ease-soft)_0.9s_both] items-center gap-1 rounded-xl bg-white/10 py-1 pr-1.5 pl-4 text-small font-bold text-on-page transition-[background-color] hover:bg-white/20"
        data-part="cta"
        href={`/${lang}`}
      >
        {t("card.makeOwn")}
        <CookieIcon
          icing="#ff5fa8"
          icon={ArrowUpRight}
          idle={false}
          size={40}
        />
      </a>

      {/* The editor's foot at the bottom – its line is the floor the cookies
          lie on. */}
      <SiteFooter
        className="relative row-start-8 mt-1.5 animate-[greet-rise_0.9s_var(--ease-soft)_1s_both] justify-self-stretch"
        compact
      />
      {crumbs.map((crumb) => (
        <Crumbs at={crumb} key={crumb.id} seed={Math.floor(crumb.id)} />
      ))}
    </main>
  );
};

export default CardPage;
