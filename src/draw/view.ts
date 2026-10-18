/**
 * Zooming into the drawing area and moving about in it – for fine details.
 * The view says how far in (`s`: 1 is the whole area, never less, at most
 * MAX_ZOOM) and where: the area's top left corner (`x`, `y`) in widths of
 * the stage, 0 to 1 − s – the area always fills the stage.
 *
 * Plain numbers: the hook that zooms with the wheel and the trackpad is
 * use-zoom.ts, the fingers' pinch use-stage-pointer.ts.
 */
export type View = { s: number; x: number; y: number };

export const WHOLE: View = { s: 1, x: 0, y: 0 };

/** How far in it goes. */
export const MAX_ZOOM = 6;

/** A view kept on the area: no less than all of it, no further in than MAX_ZOOM, never beside it. */
export const keptView = ({ s, x, y }: View): View => {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, s));
  return {
    s: zoom,
    x: Math.min(0, Math.max(1 - zoom, x)),
    y: Math.min(0, Math.max(1 - zoom, y)),
  };
};

/**
 * The view zoomed by `factor` about a point of the stage (0–1 each way) –
 * what is under it stays under it.
 */
export const zoomedAbout = (
  view: View,
  factor: number,
  px: number,
  py: number
): View => {
  const s = Math.min(MAX_ZOOM, Math.max(1, view.s * factor));
  const k = s / view.s;
  return keptView({ s, x: px - (px - view.x) * k, y: py - (py - view.y) * k });
};

/** The view moved by (dx, dy) – shares of the stage. */
export const movedBy = (view: View, dx: number, dy: number): View =>
  keptView({ ...view, x: view.x + dx, y: view.y + dy });

type Spot = readonly [number, number];

/**
 * Two fingers from where they were (a0, b0, with the view then) to where
 * they are: zoomed by how much further apart, moved along with their middle.
 */
export const pinched = (
  from: View,
  [a0, b0]: readonly [Spot, Spot],
  [a1, b1]: readonly [Spot, Spot]
): View => {
  const d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1e-6;
  const d1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]);
  const m0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2];
  const m1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
  const s = Math.min(MAX_ZOOM, Math.max(1, (from.s * d1) / d0));
  // The area's point under the first middle goes under the new one.
  const u = (m0[0] - from.x) / from.s;
  const v = (m0[1] - from.y) / from.s;
  return keptView({ s, x: m1[0] - u * s, y: m1[1] - v * s });
};

/** A point of the stage (0–1 each way) as a point of the area (0–1). */
export const toArea = (view: View, bx: number, by: number) =>
  [(bx - view.x) / view.s, (by - view.y) / view.s] as const;

/** A point of the area (0–1) as one of the stage (0–1). */
export const toStage = (view: View, ax: number, ay: number) =>
  [view.x + ax * view.s, view.y + ay * view.s] as const;
