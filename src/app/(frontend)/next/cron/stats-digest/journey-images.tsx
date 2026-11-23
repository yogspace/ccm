import { geoBounds, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { visitShade } from "@/stats/visit-matrix";
import { SCALE, svgPng } from "./chart-image";
import { RAMP } from "./email";

/**
 * The mail's picture of where visitors come from (`TRACKING.origin`) – the
 * admin's world map as a PNG: mail programs draw no SVG. Drawn with next/og like the
 * other charts, never with sharp – sharp in a request handler can take a
 * production container down.
 */

// The mail's colors (email.ts) – the ground is the cream card, the data the
// app's blue.
const C = {
  ground: "#fdf8ef",
  land: "#ebe1cd",
  border: "#fdf8ef",
  ink: "#0d1033",
};

// ─── World map ───────────────────────────────────────────────────────────────

/** Size of the map as shown in the mail. */
export const MAP_W = 880;
export const MAP_H = 380;

type Country = Feature<Geometry, { name: string }>;

/** Antarctica: nobody visits from there, and it would take a fifth of the map. */
const ANTARCTICA = "010";

// The finer 50m atlas, not the admin's 110m: small countries (Singapore,
// Malta …) are missing in the coarse one – and the mail draws it only once.
const loadWorld = async (): Promise<Country[]> => {
  const module = await import("world-atlas/countries-50m.json");
  const topology = ((module as { default?: unknown }).default ??
    module) as unknown as Topology<{
    countries: GeometryCollection<{ name: string }>;
  }>;
  return (
    feature(topology, topology.objects.countries) as FeatureCollection<
      Geometry,
      { name: string }
    >
  ).features.filter((country) => String(country.id) !== ANTARCTICA);
};

/** A country's key as stats/country-codes.ts names it – its id, or its name. */
const keyOf = (country: Country) =>
  country.id === undefined ? country.properties.name : String(country.id);

/**
 * The world shaded by views per country (keys from `atlasKey`) – zoomed to
 * where the views are (at least 24° × 14°; the whole world across the date
 * line), as the admin's map. Null without a country.
 */
export const mapPng = async (
  countries: Map<string, number>
): Promise<Buffer | null> => {
  if (countries.size === 0) return null;
  const world = await loadWorld();
  const all: FeatureCollection<Geometry, { name: string }> = {
    type: "FeatureCollection",
    features: world,
  };
  const visited = world.filter((c) => countries.has(keyOf(c)));
  if (visited.length === 0) return null;

  const extent: [[number, number], [number, number]] = [
    [12, 12],
    [MAP_W - 12, MAP_H - 12],
  ];
  const projection = geoNaturalEarth1();
  const [[west, south], [east, north]] = geoBounds({
    type: "FeatureCollection",
    features: visited,
  });
  if (east < west) {
    projection.fitExtent(extent, all);
  } else {
    const grow = (from: number, to: number, min: number) => {
      const mid = (from + to) / 2;
      const half = Math.max(min, (to - from) * 1.15) / 2;
      return [mid - half, mid + half];
    };
    const [w, e] = grow(west, east, 24);
    const [s, n] = grow(south, north, 14);
    projection.fitExtent(extent, {
      type: "MultiPoint",
      coordinates: [
        [w, Math.max(-85, s)],
        [e, Math.min(85, n)],
      ],
    });
  }
  const path = geoPath(projection);
  const max = Math.max(1, ...countries.values());
  const shadeOf = (count: number) =>
    RAMP[
      Math.max(
        0,
        Math.min(
          RAMP.length - 1,
          Math.ceil(visitShade(count, max) * RAMP.length) - 1
        )
      )
    ];
  const shapes = world
    .map((country) => {
      const d = path(country);
      if (!d) return "";
      const count = countries.get(keyOf(country)) ?? 0;
      return `<path d="${d}" fill="${count ? shadeOf(count) : C.land}" stroke="${C.border}" stroke-width="0.5"/>`;
    })
    .join("");
  // Small countries with views (Singapore, Malta …) would be a dot of a few
  // pixels – a circle in their tone marks them.
  const markers = visited
    .filter((country) => path.area(country) < 40)
    .map((country) => {
      const [x, y] = path.centroid(country);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
      const count = countries.get(keyOf(country)) ?? 0;
      return `<circle cx="${x}" cy="${y}" r="5" fill="${shadeOf(count)}" stroke="${C.ink}" stroke-width="1"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W * SCALE}" height="${MAP_H * SCALE}" viewBox="0 0 ${MAP_W} ${MAP_H}"><rect width="${MAP_W}" height="${MAP_H}" fill="${C.ground}"/>${shapes}${markers}</svg>`;
  return svgPng(svg, MAP_W, MAP_H);
};
