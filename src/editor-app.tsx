import { Rotate3d, Ruler } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { cn } from "./cn";
import AccountDialog from "./components/account-dialog";
import Button from "./components/button";
import { Card, CardHead, CardTitle } from "./components/card";
import CookieBackground from "./components/cookie-background";
import CookieBar from "./components/cookie-bar";
import CookieIcon from "./components/cookie-icon";
import ErrorPopup from "./components/error-popup";
import ExportButtons from "./components/export-buttons";
import GalleryFan from "./components/gallery-fan";
import Masthead from "./components/masthead";
import ParameterPanel from "./components/parameter-panel";
import Preview3d, { type PreviewHandle } from "./components/preview-3d";
import PrintHints from "./components/print-hints";
import ShareCreation from "./components/share-creation";
import SiteFooter from "./components/site-footer";
import {
  cookieInIconButton,
  cookieInLine,
  cookieInStageHint,
  cookieToggle,
  stage,
  stageHint,
} from "./components/styles";
import DrawCanvas from "./draw/draw-canvas";
import { connectStore, store, toggleAutoRotate } from "./store";
import { formatLength } from "./units";

/**
 * The page's frame. The store (store.ts) holds the state; components read it
 * themselves – here only what the frame shows directly.
 */
const App = () => {
  const { t, i18n } = useTranslation();
  // Synchronous, so the switch animates as a view transition (toggleExpanded).
  const { expanded } = useSnapshot(store, { sync: true });
  const { cutter, unit, autoRotate } = useSnapshot(store);
  const { ready, mesh } = cutter;
  const preview = useRef<PreviewHandle>(null);

  // Hook worker, link in the hash, counter and scroll lock up to the store.
  useEffect(connectStore, []);

  const lang = i18n.resolvedLanguage ?? "en";

  return (
    // What sticks out (sun sticker, large cookies) does not make the page
    // larger. The background cookies lie behind everything else.
    <div className="mx-auto flex min-h-dvh max-w-360 flex-col gap-6 overflow-clip px-10 pt-7 pb-5 max-sm:gap-5 max-sm:px-4 max-sm:pt-5 max-sm:pb-4">
      <CookieBackground />
      <Masthead />

      {/* Desktop: shape and cutter side by side, at window height – the row
          fills exactly the height left beside header and footer; the fan and
          footer follow below. The drawing area follows the height; its card
          is only as wide as it needs (--shape-w, set by draw/use-area-fit.ts), the
          cutter card takes the rest. Enlarged: drawing across the full width,
          the preview below. Narrow: stacked, areas as wide as possible –
          scrolling is fine here. */}
      <main
        className="relative z-1 grid grid-cols-[minmax(0,var(--shape-w,1fr))_minmax(0,1fr)] items-stretch gap-6 [--stage-size:min(100%,max(24rem,calc(100dvh-23rem)))] data-expanded:grid-cols-1 md:not-data-expanded:min-h-[calc(100dvh-8.5rem)] md:not-data-expanded:flex-1 md:not-data-expanded:grid-rows-[minmax(0,1fr)] md:data-expanded:[--stage-size:min(100%,60rem)] max-md:grid-cols-1 max-md:[--stage-size:100%]"
        data-expanded={expanded || undefined}
      >
        {/* Its head is a row of the drawing area's grid (draw/draw-canvas.tsx). */}
        <Card className="[view-transition-name:shape-card]">
          <DrawCanvas />
          <ErrorPopup />
        </Card>

        <Card className="[view-transition-name:cutter-card] in-data-expanded:animate-none">
          <CardHead>
            <CardTitle>{t("steps.cutter")}</CardTitle>
            <div className="flex items-center gap-6">
              {mesh && (
                <span className="inline-flex animate-[fade_0.3s_var(--ease-soft)] items-center gap-1.5 text-body font-bold text-muted tabular-nums">
                  <CookieIcon
                    className={cookieInLine}
                    icing="#2a44ff"
                    icon={Ruler}
                    roll={35}
                    size={46}
                  />
                  {mesh.dimensions
                    .map((d) =>
                      formatLength(d, unit, lang, unit === "in" ? 2 : 0)
                    )
                    .join(" × ")}
                </span>
              )}
              <Button
                aria-label={t("preview.rotate")}
                aria-pressed={autoRotate}
                kind="icon"
                onClick={toggleAutoRotate}
                title={t("preview.rotate")}
                type="button"
              >
                <CookieIcon
                  className={cn(cookieInIconButton, cookieToggle)}
                  icon={Rotate3d}
                  roll={12}
                  size={52}
                />
              </Button>
            </div>
          </CardHead>

          {/* The slot takes the height left next to the sliders (at least
              20rem); the view in it stays roughly square – between 4:5 and
              7:5 – instead of stretching. Narrow and enlarged it is as wide
              as it can be (enlarged at most 44rem). */}
          <div className="grid min-h-80 flex-1 place-items-center @container-size max-md:min-h-0 max-md:flex-none max-md:@container in-data-expanded:min-h-0 in-data-expanded:flex-none in-data-expanded:@container">
            <div
              className={cn(
                stage,
                "h-[min(100cqh,125cqw)] w-[min(100cqw,140cqh)] max-md:not-in-data-expanded:aspect-square max-md:not-in-data-expanded:h-auto max-md:not-in-data-expanded:w-full in-data-expanded:aspect-5/4 in-data-expanded:h-auto in-data-expanded:w-[min(100%,44rem)]"
              )}
            >
              <Preview3d ref={preview} />
              {!mesh && (
                <div
                  className={cn(
                    stageHint,
                    "animate-[breathe_2.4s_ease-in-out_infinite]"
                  )}
                >
                  <CookieIcon
                    className={cookieInStageHint}
                    kind="star"
                    size={120}
                    spin={!ready}
                  />
                  <span>
                    {ready ? t("preview.empty") : t("preview.loading")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <ParameterPanel />

          <div className="flex flex-col gap-4">
            <PrintHints />
            <ExportButtons />
          </div>
        </Card>
      </main>

      {/* The end of the page: the fan of example pictures floats, and right
          in front of its lower edge the creation is shared – as a picture
          with its link, or as a greeting card. Room to breathe between the
          editor above, the fan and the footer. */}
      <div className="relative z-1 flex flex-col items-center pt-[clamp(2rem,6vw,4.5rem)] pb-[clamp(1.5rem,5vw,3.5rem)] [--fan-card:11rem] max-sm:[--fan-card:7.5rem]">
        <GalleryFan />
        <ShareCreation preview={preview} />
      </div>

      {/* Floats at the bottom while scrolling, stops right above the footer.
          The account is the jar's, on every device – it opens from there. */}
      <CookieBar />
      <AccountDialog />

      <SiteFooter className="relative z-1" />
    </div>
  );
};

export default App;
