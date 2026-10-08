"use client";

import { useConfig } from "@payloadcms/ui";
import { type CSSProperties, useEffect, useState } from "react";

export type SiteColor = { color: string; name: string };

/** The card colors from the Site global – what a gallery card may wear. */
export const useSiteColors = () => {
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const [colors, setColors] = useState<SiteColor[]>([]);
  useEffect(() => {
    fetch(`${api}/globals/site?depth=0`, { credentials: "include" })
      .then((response) => response.json())
      .then((site: { cardColors?: SiteColor[] }) =>
        setColors(site.cardColors ?? [])
      )
      .catch(() => setColors([]));
  }, [api]);
  return colors;
};

type Props = {
  colors: SiteColor[];
  /** The chosen one – null: the first, the default. */
  value: string | null;
  onChange: (color: string) => void;
  disabled?: boolean;
};

/** The card colors as round swatches, the chosen one ringed – like the site's. */
export const SiteColorSwatches = ({
  colors,
  value,
  onChange,
  disabled = false,
}: Props) => {
  const chosen = (value ?? colors[0]?.color ?? "").toLowerCase();
  return (
    <div className="site-color-swatches">
      {colors.map((option) => (
        <button
          aria-label={option.name}
          aria-pressed={option.color.toLowerCase() === chosen}
          className="site-color-swatch"
          disabled={disabled}
          key={option.color}
          onClick={() => onChange(option.color)}
          style={{ "--swatch": option.color } as CSSProperties}
          title={option.name}
          type="button"
        />
      ))}
    </div>
  );
};
