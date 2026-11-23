import { geoBounds, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { ImageResponse } from "next/og";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { LOCALE } from "@/stats/config";
import { type Journey, OTHER_PAGE, pathSteps } from "@/stats/journeys";
import { visitShade } from "@/stats/visit-matrix";
import { SCALE, svgPng } from "./chart-image";
import { RAMP } from "./email";

/**
 * The mail's pictures of where visitors come from (`TRACKING.origin`) and
 * how they move (`TRACKING.visits`) – the admin's world map and paths
 * diagram as PNGs: mail programs draw no SVG. Drawn with next/og like the
 * other charts, never with sharp – sharp in a request handler can take a
 * production container down.
 */

// The mail's colors (email.ts) – the ground is the cream card, the data the
// app's blue.
const C = {
  ground: "#fdf8ef",
  land: "#ebe1cd",
  border: "#fdf8ef",
  node: "#f6eedf",
  nodeLine: "#e9dfcb",
  band: "#2a44ff",
  ink: "#0d1033",
  text: "#0d1033",
  muted: "#5c6080",
};

const fmt = (n: number) => n.toLocaleString(LOCALE);

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

// ─── Paths diagram ───────────────────────────────────────────────────────────

/** Width of the paths diagram as shown – and the narrower one for phones. */
export const FLOW_W = 880;
export const FLOW_PHONE_W = 360;

const NODE_H = 42;
const NODE_GAP = 8;
const HEAD = 24;

/** Cut to `max` characters – satori has no reliable ellipsis. */
const cut = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;

/**
 * The paths as steps, as in the admin (stats/journeys.ts `pathSteps`): a
 * column per step with its pages by how many visits had them there, the
 * bands between as wide as the way was taken; “% Ende” is how many ended
 * on that page. Null without a visit of two pages – one column says
 * nothing. Returns the picture and its height.
 */
export const flowPng = async (
  journeys: Journey[],
  { width, steps, perStep }: { width: number; steps: number; perStep: number }
): Promise<{ png: Buffer; height: number } | null> => {
  if (!journeys.some((j) => j.pages.length > 1)) return null;
  const { columns, links } = pathSteps(journeys, steps, perStep);
  if (columns.length < 2) return null;

  const colGap = width < 500 ? 22 : 48;
  const colW = (width - colGap * (columns.length - 1)) / columns.length;
  const rows = Math.max(...columns.map((column) => column.nodes.length));
  const height = HEAD + rows * (NODE_H + NODE_GAP) - NODE_GAP;
  const xOf = (col: number) => col * (colW + colGap);
  const yOf = (col: number, name: string) =>
    HEAD +
    Math.max(
      0,
      columns[col].nodes.findIndex((node) => node.name === name)
    ) *
      (NODE_H + NODE_GAP) +
    NODE_H / 2;
  const maxLink = Math.max(1, ...links.map((link) => link.count));
  const bands = links
    .map((link) => {
      const x1 = xOf(link.col) + colW;
      const x2 = xOf(link.col + 1);
      const y1 = yOf(link.col, link.from);
      const y2 = yOf(link.col + 1, link.to);
      const mid = (x1 + x2) / 2;
      return `<path d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}" fill="none" stroke="${C.band}" stroke-opacity="0.22" stroke-width="${Math.max(1.5, (link.count / maxLink) * 16)}"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * SCALE}" height="${height * SCALE}" viewBox="0 0 ${width} ${height}">${bands}</svg>`;
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const chars = Math.max(6, Math.floor((colW - 18) / 6.6));
  const narrow = colW < 150;
  const s = (n: number) => n * SCALE;

  const response = new ImageResponse(
    <div
      style={{
        background: C.ground,
        display: "flex",
        height: s(height),
        position: "relative",
        width: s(width),
      }}
    >
      <img
        alt=""
        height={s(height)}
        src={src}
        style={{ left: 0, position: "absolute", top: 0 }}
        width={s(width)}
      />
      {columns.map((column, col) => (
        <div
          key={`head-${col.toString()}`}
          style={{
            color: C.muted,
            display: "flex",
            fontSize: s(11),
            left: s(xOf(col)),
            position: "absolute",
            top: 0,
          }}
        >
          {`Schritt ${col + 1} · ${fmt(column.total)}`}
        </div>
      ))}
      {columns.flatMap((column, col) =>
        column.nodes.map((node, i) => (
          <div
            key={`${col.toString()}-${node.name}`}
            style={{
              background: C.node,
              border: `${s(1)}px solid ${C.nodeLine}`,
              borderRadius: s(8),
              display: "flex",
              flexDirection: "column",
              height: s(NODE_H),
              justifyContent: "center",
              left: s(xOf(col)),
              padding: `0 ${s(8)}px`,
              position: "absolute",
              top: s(HEAD + i * (NODE_H + NODE_GAP)),
              width: s(colW),
            }}
          >
            <div style={{ color: C.text, display: "flex", fontSize: s(12) }}>
              {cut(node.name === OTHER_PAGE ? "Andere" : node.name, chars)}
            </div>
            {/* The count on the second line – the name gets the width. */}
            <div style={{ color: C.muted, display: "flex", fontSize: s(10) }}>
              {/* A margin, not a space: satori drops leading spaces. */}
              <span
                style={{ color: C.ink, fontWeight: 700, marginRight: s(4) }}
              >
                {fmt(node.count)}
              </span>
              {[
                // Narrow columns (the phone's) keep one share – “% Ende”
                // beside both would break into a third line.
                ...(narrow && node.ended > 0
                  ? []
                  : [`${Math.round((node.count / column.total) * 100)} %`]),
                ...(node.ended > 0
                  ? [`${Math.round((node.ended / node.count) * 100)} % Ende`]
                  : []),
              ]
                .map((part) => `· ${part}`)
                .join(" ")}
            </div>
          </div>
        ))
      )}
    </div>,
    { width: s(width), height: s(height) }
  );
  return { png: Buffer.from(await response.arrayBuffer()), height };
};
