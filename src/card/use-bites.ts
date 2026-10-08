import { type MouseEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../analytics";
import {
  type Bite,
  biteAt,
  type CookieShape,
  cookieLeft,
  cookieOutline,
  leftoverCrumbs,
} from "../cookies/models";
import { biteSpot } from "./bite";

type Crumb = { id: number; x: number; y: number };

/**
 * Bites out of the cookie on the back, where it is clicked – behind it the
 * message, more of it with every bite, until the cookie is gone. After each
 * bite the cookie says something (“Mmmh!” – card.yums, another one each
 * time) and crumbs fly where it was clicked. `reset`: a fresh cookie.
 */
export const useBites = (cookie: CookieShape | null) => {
  const { t } = useTranslation();
  const [bites, setBites] = useState<Bite[]>([]);
  const [yum, setYum] = useState("");
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  /**
   * Bites are worked out one after another – quick taps don't race; the
   * latest list lives here, ahead of the next render.
   */
  const biting = useRef(Promise.resolve());
  const bitesNow = useRef<Bite[]>([]);
  const outline = useMemo(
    () => (cookie ? cookieOutline(cookie) : []),
    [cookie]
  );
  const eaten = useMemo(
    () => bites.length > 0 && !cookieLeft(outline, bites),
    [outline, bites]
  );

  // A bite right where it is clicked – instead of turning the card. Next to
  // the cookie, or where it is eaten already, nothing.
  const bite = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (eaten || !cookie) return;
    const hit = biteSpot(
      event.currentTarget,
      event.nativeEvent.offsetX,
      event.nativeEvent.offsetY,
      outline,
      bitesNow.current
    );
    if (!hit) return;
    const yums = t("card.yums")
      .split("|")
      .map((text) => text.trim())
      .filter((text) => text && text !== yum);
    setYum(yums[Math.floor(Math.random() * yums.length)] ?? "");
    const bitten = biteAt(hit.x, hit.y);
    biting.current = biting.current.then(async () => {
      // Bits too small to keep go along with the bite.
      const next = [...bitesNow.current, bitten];
      const left = await leftoverCrumbs(cookie, next).catch(() => []);
      const final = left.length > 0 ? [...next, left] : next;
      bitesNow.current = final;
      setBites(final);
      if (!cookieLeft(outline, final)) trackEvent("card-eaten");
    });
    const crumb = { id: performance.now(), x: event.clientX, y: event.clientY };
    setCrumbs((previous) => [...previous, crumb]);
    setTimeout(
      () => setCrumbs((previous) => previous.filter((c) => c !== crumb)),
      900
    );
  };

  const reset = () => {
    bitesNow.current = [];
    setBites([]);
  };

  return { bites, eaten, yum, crumbs, bite, reset };
};
