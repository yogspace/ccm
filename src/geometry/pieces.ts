import type { CrossSection, ManifoldToplevel } from "manifold-3d";
import type { Point, Ring } from "./outline";
import { contains, signedArea } from "./rings";

/**
 * A cross-section's connected pieces, each with its holes – what
 * `decompose()` gives. Manifold builds them recursively, about one level for
 * every two contours: offsetting leaves dust along edges that nearly meet,
 * hundreds of specks, and Safari's workers run out of stack on them (“no
 * cutter from this shape”, on every iPhone). Beyond a few, from the contours
 * instead: the same paths, the same pieces.
 */

/** Up to this many contours Manifold's own – the usual case. */
const NATIVE_UP_TO = 100;

export const piecesOf = (
  wasm: ManifoldToplevel,
  section: CrossSection
): CrossSection[] => {
  if (section.numContour() <= NATIVE_UP_TO) return section.decompose();
  const outlines: { ring: Ring; area: number; holes: Ring[] }[] = [];
  const holes: Ring[] = [];
  for (const ring of section.toPolygons() as Ring[]) {
    const area = signedArea(ring);
    if (area > 0) outlines.push({ ring, area, holes: [] });
    else if (area < 0) holes.push(ring);
  }
  // Each hole belongs to the smallest outline around it – tested at the
  // middle of one of its edges: a hole never shares an edge with its outline.
  for (const hole of holes) {
    const [a, b] = hole;
    const probe: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let owner: (typeof outlines)[number] | undefined;
    for (const outline of outlines) {
      if (
        (!owner || outline.area < owner.area) &&
        contains(outline.ring, probe)
      ) {
        owner = outline;
      }
    }
    owner?.holes.push(hole);
  }
  return outlines.map(
    ({ ring, holes: own }) => new wasm.CrossSection([ring, ...own], "Positive")
  );
};
