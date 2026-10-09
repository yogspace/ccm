import { useTranslation } from "react-i18next";
import type { MeshData } from "../geometry/mesh";
import { shortShapeMissing } from "../short-shape";
import CardCutter from "./card-cutter";
import { hasShape } from "./card-link";
import { CardLabel, Paper, TurnSticker, WaitingNote } from "./card-parts";

type Props = {
  mesh: MeshData | null;
  /** The favorite color – the cutter in it. */
  glaze: string;
  name: string;
  sizeLabel: string;
  failed: boolean;
  /** “Shaping your cutter” still shown (use-cutter.ts). */
  waitShown: boolean;
  flipped: boolean;
};

/**
 * The card's front: the cutter growing up out of it (a note while it is
 * shaped, or why it isn't), below it its name and size like a label.
 */
const CardFront = ({
  mesh,
  glaze,
  name,
  sizeLabel,
  failed,
  waitShown,
  flipped,
}: Props) => {
  const { t } = useTranslation();
  return (
    <Paper className="in-data-flipped:invisible">
      {mesh && (
        <CardCutter
          color={glaze}
          delay={250}
          label={t("card.cutterAlt", { name })}
          mesh={mesh}
          paused={flipped}
        />
      )}
      {(!mesh || waitShown) && (
        <WaitingNote
          className="text-card-ink-muted"
          gone={!!mesh}
          spin={!failed}
        >
          {failed
            ? t(
                hasShape
                  ? "card.failed"
                  : shortShapeMissing()
                    ? "card.gone"
                    : "card.empty"
              )
            : t("card.loading")}
        </WaitingNote>
      )}
      <CardLabel hidden={!hasShape} name={name} note={sizeLabel} />
      {hasShape && <TurnSticker interactive />}
    </Paper>
  );
};

export default CardFront;
