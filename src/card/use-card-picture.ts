import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CARD_PICTURE_COLORS,
  paintCardPicture,
} from "../components/card-image";
import { fileBase } from "../export/file-name";
import type { MeshData } from "../geometry/mesh";
import { resolveColors } from "../glaze";
import { renderMeshTop } from "../render-top";
import { greeting, shared } from "./card-link";

/** Pause (ms) before painting the picture – the card lands first. */
const PICTURE_DELAY = 1500;

type Card = {
  mesh: MeshData | null;
  glaze: string;
  heading: string;
  name: string;
  sizeLabel: string;
};

/**
 * The card as a picture to share or save, painted ahead once the cutter is
 * there – after the card has landed: Safari only shares right in the click.
 */
export const useCardPicture = ({
  mesh,
  glaze,
  heading,
  name,
  sizeLabel,
}: Card) => {
  const { t } = useTranslation();
  const [picture, setPicture] = useState<File | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: painted once per cutter
  useEffect(() => {
    if (!mesh) return;
    let current = true;
    const timer = setTimeout(async () => {
      const cutterView = renderMeshTop(mesh, glaze, 900, 788);
      const blob = await paintCardPicture({
        colors: resolveColors(document.body, CARD_PICTURE_COLORS),
        cutter: cutterView,
        heading,
        from: greeting.from ? t("card.fromName", { name: greeting.from }) : "",
        ring: greeting.message || t("card.ring"),
        name,
        size: sizeLabel,
        site: "ccm.mxwr.de",
      });
      if (cutterView) cutterView.width = cutterView.height = 0;
      if (!current || !blob) return;
      const file = `${fileBase(name, shared.params.size)}-${t("card.fileSuffix")}.png`;
      setPicture(new File([blob], file, { type: "image/png" }));
    }, PICTURE_DELAY);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [mesh, t]);

  return picture;
};
