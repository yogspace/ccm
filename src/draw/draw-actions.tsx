import { Check, Redo2, Trash2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../components/button";
import CookieIcon from "../components/cookie-icon";
import { cookieInIconButton } from "../components/styles";

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  /** Nothing drawn – nothing to clear. */
  empty: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  /**
   * A line being drawn or edited: ends it – the way Enter does, for phones.
   * `null`: nothing of the kind, no button.
   */
  onFinish: (() => void) | null;
  /** There is something to finish. */
  finishable: boolean;
};

/**
 * Done (only with the line tool), undo, redo, clear – flush with the right
 * edge (a stretched grid does not push them inwards). Beside the area: below
 * the tools, at the bottom.
 */
const DrawActions = ({
  canUndo,
  canRedo,
  empty,
  onUndo,
  onRedo,
  onClear,
  onFinish,
  finishable,
}: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4 [grid-area:actions] justify-self-end @max-[34rem]/draw:gap-2 beside:flex-col beside:gap-3 beside:[grid-area:tools] beside:self-end beside:justify-self-center">
      {onFinish && (
        <Button
          aria-keyshortcuts="Enter"
          aria-label={t("draw.finish")}
          disabled={!finishable}
          kind="icon"
          onClick={onFinish}
          title={`${t("draw.finish")} (Enter)`}
          type="button"
        >
          <CookieIcon
            className={cookieInIconButton}
            icing="#5fb36b"
            icon={Check}
            roll={-6}
            size={52}
          />
        </Button>
      )}
      <Button
        aria-label={t("draw.undo")}
        disabled={!canUndo}
        kind="icon"
        onClick={onUndo}
        title={t("draw.undo")}
        type="button"
      >
        <CookieIcon
          className={cookieInIconButton}
          icing="#2a44ff"
          icon={Undo2}
          roll={-12}
          size={52}
        />
      </Button>
      <Button
        aria-label={t("draw.redo")}
        disabled={!canRedo}
        kind="icon"
        onClick={onRedo}
        title={t("draw.redo")}
        type="button"
      >
        <CookieIcon
          className={cookieInIconButton}
          icing="#2a44ff"
          icon={Redo2}
          roll={12}
          size={52}
        />
      </Button>
      <Button
        aria-label={t("draw.clear")}
        disabled={empty}
        kind="icon"
        onClick={onClear}
        title={t("draw.clear")}
        type="button"
      >
        <CookieIcon
          className={cookieInIconButton}
          icing="#ff5fa8"
          icon={Trash2}
          roll={9}
          size={52}
        />
      </Button>
    </div>
  );
};

export default DrawActions;
