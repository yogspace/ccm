"use client";

import { TextField, useField, useRowLabel } from "@payloadcms/ui";
import type { TextFieldClientComponent } from "payload";
import type { CSSProperties } from "react";
import "../glaze.css";

const HEX = /^#[0-9a-f]{6}$/i;
const BLUE = "#2a44ff";

/** The shades a color gives (glaze.css), named for where the card shows them. */
const SHADES = [
  ["--glaze", "Page, icing, cutter"],
  ["--on-glaze", "Words on the page"],
  ["--card-sheet", "Card"],
  ["--card-ink", "Words on the card"],
  ["--card-back", "The card's back"],
  ["--card-back-ink", "Message behind the cookie"],
  ["--card-deep", "“Eat me”"],
] as const;

/** A star cutter's outline, as on the card's front. */
const STAR =
  "M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";

/** The greeting card in small, in a color's shades – as the site has it. */
const CardColorPreview = ({ color }: { color: string }) => (
  <div
    aria-hidden
    className="glaze card-color-preview"
    style={{ "--glaze": color } as CSSProperties}
  >
    <div className="ccp-page">
      <strong className="ccp-for">For Carla</strong>
      <div className="ccp-cards">
        <div className="ccp-card ccp-front">
          <svg aria-hidden="true" className="ccp-cutter" viewBox="0 0 24 24">
            <path d={STAR} />
          </svg>
          <span className="ccp-name">
            Cookie Cutter <small>71 mm</small>
          </span>
        </div>
        <div className="ccp-card ccp-back">
          <span className="ccp-message">Merry Christmas!</span>
          <small className="ccp-eat">Eat me</small>
        </div>
      </div>
      <span className="ccp-from">from Max</span>
    </div>
    <ul className="ccp-shades">
      {SHADES.map(([property, label]) => (
        <li key={property}>
          <i style={{ background: `var(${property})` }} />
          {label}
        </li>
      ))}
    </ul>
  </div>
);

/**
 * A card color in the admin (Site → Card colors): the hex field with a
 * color picker beside it, and below the card in the color's shades – the
 * page, the card, its back and their words.
 */
export const CardColorField: TextFieldClientComponent = (props) => {
  const { value, setValue } = useField<string>({ path: props.path });
  const color = typeof value === "string" && HEX.test(value) ? value : BLUE;
  return (
    <div className="card-color-field">
      <div className="card-color-input">
        <input
          aria-label="Pick the color"
          className="card-color-picker"
          onChange={(event) => setValue(event.target.value)}
          type="color"
          value={color.toLowerCase()}
        />
        <TextField {...props} />
      </div>
      <CardColorPreview color={color} />
    </div>
  );
};

/**
 * A color's row, closed: its swatch, its number in card links and its
 * name – the first is the default.
 */
export const CardColorRowLabel = () => {
  const { data, rowNumber = 0 } = useRowLabel<{
    color?: string;
    name?: string;
  }>();
  const color = data?.color && HEX.test(data.color) ? data.color : undefined;
  return (
    <span className="card-color-row">
      <i style={{ background: color ?? "transparent" }} />
      <span>
        {rowNumber} · {data?.name || "Color"}
        {rowNumber === 0 && <small> – the default</small>}
      </span>
    </span>
  );
};
