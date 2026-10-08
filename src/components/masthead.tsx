import { Ruler } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { languages } from "../i18n";
import { setUnit, store } from "../store";
import { units } from "../units";
import CookieIcon from "./cookie-icon";
import Segmented from "./segmented";
import SharePanel from "./share-panel";
import { cookieInLine } from "./styles";

const unitOptions = units.map((option) => ({ value: option, label: option }));
const languageOptions = languages.map((lng) => ({
  value: lng,
  label: lng.toUpperCase(),
}));

/**
 * Header with logo, title – sharing the page right behind it – and the
 * switches for unit and language. Memoised:
 * the gliding markers measure the layout on every render – that should not
 * happen on every slider move.
 */
const Masthead = () => {
  const { t, i18n } = useTranslation();
  const { unit } = useSnapshot(store);

  return (
    // Phone: logo and title on top, the switches on their own row below.
    <header className="group/masthead relative z-1 flex animate-rise items-center gap-4.5 max-sm:flex-wrap max-sm:gap-x-3.25 max-sm:gap-y-3.5 max-sm:[--cookie-scale:0.7]">
      {/* On hover over the header the logo turns towards it. */}
      <CookieIcon
        className="-my-4 -mr-2.5 -ml-3.5 transition-[rotate,scale] duration-600 ease-spring group-hover/masthead:-rotate-25 group-hover/masthead:scale-110 max-sm:-my-2.5 max-sm:-mr-1.5 max-sm:-ml-2.5"
        kind="bite"
        roll={-18}
        size={100}
      />
      <div className="min-w-0 flex-1">
        {/* The title and, right behind it, sharing the page. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* Pally stops at 700 – the outline makes the headline even bolder. */}
          <h1 className="text-display leading-none font-bold tracking-title embolden-35 max-sm:text-[1.85rem]">
            Cookie Cutter Maker
          </h1>
          <SharePanel />
        </div>
        <p className="text-body text-on-page-muted max-sm:mt-0.75 max-sm:text-small max-sm:leading-[1.35]">
          {t("tagline")}
        </p>
      </div>
      <div className="flex gap-3 max-sm:w-full max-sm:justify-between">
        {/* The unit also has the ruler in front. */}
        <Segmented
          className="gap-0.5 pl-2.5"
          label={t("unit")}
          onChange={setUnit}
          options={unitOptions}
          tone="page"
          value={unit}
        >
          <CookieIcon
            className={cookieInLine}
            icing="#2a44ff"
            icon={Ruler}
            roll={35}
            size={44}
          />
        </Segmented>
        <Segmented
          label={t("language")}
          onChange={(lng) => i18n.changeLanguage(lng)}
          options={languageOptions}
          tone="page"
          value={i18n.resolvedLanguage ?? "en"}
        />
      </div>
    </header>
  );
};

export default memo(Masthead);
