import { GREETING_KEYS } from "./greeting";

/**
 * A greeting card's favorite color (`--glaze`, from the CMS) on its page:
 * the whole page in its scheme (index.css, card.css). The card lives in the
 * hash, which never reaches the server – so a small script in the page sets
 * the color before the first paint, and the page keeps it (card-page.tsx).
 * The script's element marks the card page for the styles, too.
 */
export const GLAZE_SCRIPT_ID = "card-glaze";

/** Where the color is set: a style element in the head (`--card-color`). */
const STYLE_ID = "card-color";

/**
 * The script for the page: picks the color by its number in the hash (as
 * readGreeting does) – an unknown one is the first.
 */
export const glazeScript = (colors: string[]) => {
  // Hex colors (the CMS checks them) – kept from closing the script anyway.
  const list = JSON.stringify(colors).replaceAll("<", "\\u003c");
  return `(function(){var c=${list},n=Math.floor(Number(new URLSearchParams(location.hash.slice(1)).get(${JSON.stringify(GREETING_KEYS.color)})))||0,s=document.createElement("style");s.id=${JSON.stringify(STYLE_ID)};s.textContent=":root{--card-color:"+(c[n]||c[0])+"}";document.head.appendChild(s)})()`;
};

/** Sets the page's color (as the script did); `null` takes it away. */
export const setPageGlaze = (color: string | null) => {
  let style = document.getElementById(STYLE_ID);
  if (color === null) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = `:root{--card-color:${color}}`;
};

/**
 * Colors as the browser works them out at `within` – the scheme's shades
 * (custom properties) as plain colors, to paint a picture with.
 */
export const resolveColors = <K extends string>(
  within: Element,
  properties: Record<K, string>
) => {
  const probe = document.createElement("i");
  probe.style.display = "none";
  within.append(probe);
  const colors = {} as Record<K, string>;
  for (const key of Object.keys(properties) as K[]) {
    probe.style.color = `var(${properties[key]})`;
    colors[key] = getComputedStyle(probe).color;
  }
  probe.remove();
  return colors;
};
