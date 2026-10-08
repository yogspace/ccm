import { Maximize2, Minimize2 } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { store, toggleExpanded } from "../store";
import Button from "../components/button";
import { CardHead } from "../components/card";
import CookieIcon from "../components/cookie-icon";
import { cookieInIconButton } from "../components/styles";
import TitleField from "../components/title-field";

/**
 * The drawing card's head: the creation's name, written right here, and
 * enlarging the drawing area. A row of the area's grid (draw-canvas.tsx), so
 * it lines up with the area's edges like the bars below.
 */
const ShapeHead = () => {
  const { t } = useTranslation();
  // Synchronous, so the icon switches with the view transition.
  const { expanded } = useSnapshot(store, { sync: true });

  return (
    <CardHead className="[grid-area:head]">
      <TitleField />
      {/* When narrow the drawing area is full width anyway – enlarging gains
          nothing. */}
      <Button
        aria-label={t(expanded ? "draw.shrink" : "draw.expand")}
        aria-pressed={expanded}
        className="max-md:hidden"
        kind="icon"
        onClick={toggleExpanded}
        title={t(expanded ? "draw.shrink" : "draw.expand")}
        type="button"
      >
        <CookieIcon
          className={cookieInIconButton}
          icing="#2a44ff"
          icon={expanded ? Minimize2 : Maximize2}
          roll={-10}
          size={52}
        />
      </Button>
    </CardHead>
  );
};

export default memo(ShapeHead);
