/** Left and right edge (px) of an empty column beside the card. */
export type Column = [number, number];

/**
 * The layout the cookies lie in – measured on resize only, so walls, floor
 * and card never shove them mid-frame.
 */
export type Scene = {
  width: number;
  floor: number;
  /** What the cookies land on besides the floor: card, buttons, sun. */
  boxes: DOMRect[];
  columns: Column[];
};

/**
 * The cookies' canvas (px) – always full size: where the columns are too
 * narrow for it, no cookies at all rather than small ones.
 */
export const SIZE = 200;
/** How far beside the card the rain falls – on wide screens not far off. */
const REACH = 440;

/** The parts of the page the cookies keep to. */
export const PARTS = {
  stage: '[data-part="stage"]',
  card: '[data-part="card"]',
  actions: '[data-part="actions"]',
  cta: '[data-part="cta"]',
  footer: "[data-greeting] > footer",
  sun: "[data-greeting] [data-donate]",
};

/**
 * Where an element lies in the layer – by its place in the layout, not as
 * drawn: rising in and the card leaning to the pointer don't count.
 */
const place = (selector: string, layer: HTMLElement) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = element;
  while (node && node !== layer.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return new DOMRect(x, y, element.offsetWidth, element.offsetHeight);
};

/**
 * Floor, boxes and columns from the layout – null without room. The floor
 * is the footer's line; the cookies fall beside the card and the buttons and
 * land on the floor, on the buttons or on the sun.
 */
export const measure = (layer: HTMLElement): Scene | null => {
  const [stage, card, actions, cta, footer, sun] = Object.values(PARTS).map(
    (part) => place(part, layer)
  );
  if (!(stage && footer)) return null;
  const width = layer.clientWidth;
  const middle = [stage, actions, cta].filter((box) => box !== null);
  const left = Math.min(...middle.map((box) => box.left));
  const right = Math.max(...middle.map((box) => box.right));
  const narrowest = Math.min(left, width - right);
  if (narrowest < SIZE * 0.85) return null;
  return {
    width,
    floor: footer.top,
    boxes: [card, actions, cta, sun].filter((box) => box !== null),
    columns: [
      [Math.max(0, left - REACH), left],
      [right, Math.min(width, right + REACH)],
    ],
  };
};
