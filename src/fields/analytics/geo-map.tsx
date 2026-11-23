"use client";

import { geoBounds, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { visitShade } from "../../stats/visit-matrix";
import { Tip, useWidth } from "./charts";
import { fmt, MUTED } from "./parts";

/**
 * Where people come from, as a map – plain SVG like the other charts: the
 * countries shaded by their views in the `.stats-viz` blue ramp. Pointing
 * at a country – or the arrow keys, from the strongest on – shows its
 * numbers, regions and cities (`details`). Zoomed to where the views are, or
 * the whole world. The countries (world-atlas, 110m) load only when the map
 * is shown – they would weigh down every other admin page.
 */

type Country = Feature<Geometry, { name: string }>;

/** Antarctica: nobody visits from there, and it would take a fifth of the map. */
const ANTARCTICA = "010";

let atlas: Promise<Country[]> | null = null;

const loadAtlas = () => {
  atlas ??= import("world-atlas/countries-110m.json").then((module) => {
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
  });
  return atlas;
};

/** A country's key as stats/country-codes.ts names it – its id, or its name. */
export const countryKey = (country: Country) =>
  country.id === undefined ? country.properties.name : String(country.id);

export const GeoMap = ({
  countries,
  zoom,
  unit,
  details,
  onPick,
}: {
  /** Views per country, by countryKey. */
  countries: Map<string, number>;
  /** To where the views are – or the whole world. */
  zoom: "views" | "world";
  unit: string;
  /** The readout for a country with views, by countryKey. */
  details: (key: string) => ReactNode;
  /** A click (or Enter) on a country with views – e.g. its visitors. */
  onPick?: (key: string) => void;
}) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [world, setWorld] = useState<Country[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let on = true;
    loadAtlas()
      .then((loaded) => on && setWorld(loaded))
      .catch(() => on && setFailed(true));
    return () => {
      on = false;
    };
  }, []);

  const height = Math.round(Math.min(440, Math.max(220, width * 0.5)));

  const projection = useMemo(() => {
    if (!world || width === 0) return null;
    const pad = 12;
    const extent: [[number, number], [number, number]] = [
      [pad, pad],
      [width - pad, height - pad],
    ];
    const all: FeatureCollection<Geometry, { name: string }> = {
      type: "FeatureCollection",
      features: world,
    };
    const visited = world.filter((c) => countries.has(countryKey(c)));
    const projected = geoNaturalEarth1();
    if (zoom === "world" || visited.length === 0) {
      return projected.fitExtent(extent, all);
    }
    // The views' countries, at least 24° × 14° – one small country alone
    // would fill the map. Across the date line (Fiji, Russia's east): the
    // world.
    const [[west, south], [east, north]] = geoBounds({
      type: "FeatureCollection",
      features: visited,
    });
    if (east < west) return projected.fitExtent(extent, all);
    const grow = (from: number, to: number, min: number) => {
      const mid = (from + to) / 2;
      const half = Math.max(min, to - from) / 2;
      return [mid - half, mid + half];
    };
    const [w, e] = grow(west, east, 24);
    const [s, n] = grow(south, north, 14);
    return projected.fitExtent(extent, {
      type: "MultiPoint",
      coordinates: [
        [w, Math.max(-85, s)],
        [e, Math.min(85, n)],
      ],
    });
  }, [world, width, height, countries, zoom]);

  const path = projection ? geoPath(projection) : null;
  const maxCountry = Math.max(1, ...countries.values());

  // The countries with views, strongest first – what the arrow keys walk.
  const ranked = [...countries.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
  const byKey = new Map(
    world?.map((country) => [countryKey(country), country])
  );

  const show = (key: string | undefined, at?: { x: number; y: number }) => {
    const country = key ? byKey.get(key) : undefined;
    if (!(key && country && path)) return setHover(null);
    const [x, y] = at ? [at.x, at.y] : path.centroid(country);
    setHover({ key, x, y });
  };

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const key = (event.target as Element).getAttribute?.("data-key");
    if (!(key && countries.has(key))) return setHover(null);
    const box = event.currentTarget.getBoundingClientRect();
    show(key, { x: event.clientX - box.left, y: event.clientY - box.top });
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && hover && onPick) {
      event.preventDefault();
      onPick(hover.key);
      return;
    }
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step || ranked.length === 0) return;
    event.preventDefault();
    const at = hover ? ranked.indexOf(hover.key) : -1;
    show(ranked[(at + step + ranked.length) % ranked.length]);
  };

  if (failed) {
    return (
      <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
        The map could not be loaded.
      </p>
    );
  }

  const total = [...countries.values()].reduce((a, b) => a + b, 0);
  const current = hover ? byKey.get(hover.key) : undefined;

  return (
    <div
      aria-label={`Map: ${fmt(total)} ${unit} from ${countries.size} countries – arrow keys move through them`}
      aria-valuemax={Math.max(0, ranked.length - 1)}
      aria-valuemin={0}
      aria-valuenow={hover ? Math.max(0, ranked.indexOf(hover.key)) : 0}
      aria-valuetext={
        hover && current
          ? `${current.properties.name}: ${fmt(countries.get(hover.key) ?? 0)} ${unit}`
          : undefined
      }
      className="stats-viz__focusable"
      onBlur={() => setHover(null)}
      onClick={(event) => {
        const key = (event.target as Element).getAttribute?.("data-key");
        if (key && countries.has(key)) onPick?.(key);
      }}
      onKeyDown={onKey}
      onPointerLeave={() => setHover(null)}
      onPointerMove={onPointer}
      ref={ref}
      role="slider"
      style={{ position: "relative", touchAction: "pan-y" }}
      tabIndex={0}
    >
      {!path || !world ? (
        <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>Loading …</p>
      ) : (
        <>
          <svg
            aria-hidden="true"
            height={height}
            style={{ display: "block" }}
            width={width}
          >
            {world.map((country) => {
              const key = countryKey(country);
              const count = countries.get(key) ?? 0;
              const step =
                count > 0
                  ? Math.max(1, Math.ceil(visitShade(count, maxCountry) * 7))
                  : 0;
              return (
                <path
                  d={path(country) ?? ""}
                  data-key={key}
                  fill={
                    step
                      ? `var(--viz-seq-${step})`
                      : "var(--theme-elevation-100)"
                  }
                  key={key}
                  stroke={
                    hover?.key === key
                      ? "var(--theme-elevation-1000)"
                      : "var(--theme-elevation-0)"
                  }
                  strokeWidth={hover?.key === key ? 1.2 : 0.5}
                  style={{
                    cursor: onPick && count > 0 ? "pointer" : undefined,
                  }}
                />
              );
            })}
          </svg>
          {hover && countries.has(hover.key) && (
            <Tip width={width} x={hover.x} y={hover.y}>
              {details(hover.key)}
            </Tip>
          )}
        </>
      )}
    </div>
  );
};

/**
 * One country on a small, still map – for a visitor's profile. The country in
 * the ramp's blue, its neighbours around it for orientation (at least 40° ×
 * 24°). The map itself is decorative; `label` names the country on it.
 */
export const CountryMap = ({
  countryKey: key,
  height = 150,
  label,
}: {
  /** The country as country-codes' atlasKey names it. */
  countryKey: string;
  height?: number;
  /** The country's name, as a small tag in the map's corner. */
  label?: ReactNode;
}) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [world, setWorld] = useState<Country[] | null>(null);

  useEffect(() => {
    let on = true;
    loadAtlas()
      .then((countries) => on && setWorld(countries))
      .catch(() => on && setWorld([]));
    return () => {
      on = false;
    };
  }, []);

  const path = useMemo(() => {
    const country = world?.find((c) => countryKey(c) === key);
    if (!(world && country) || width === 0) return null;
    const [[west, south], [east, north]] = geoBounds(country);
    // Across the date line (Fiji, Russia's east): centre on its west edge.
    const right = east < west ? west + 30 : east;
    const grow = (from: number, to: number, min: number) => {
      const mid = (from + to) / 2;
      const half = Math.max(min, (to - from) * 1.4) / 2;
      return [mid - half, mid + half];
    };
    const [w, e] = grow(west, right, 40);
    const [s, n] = grow(south, north, 24);
    return geoPath(
      geoNaturalEarth1().fitExtent(
        [
          [4, 4],
          [width - 4, height - 4],
        ],
        {
          type: "MultiPoint",
          coordinates: [
            [w, Math.max(-85, s)],
            [e, Math.min(85, n)],
          ],
        }
      )
    );
  }, [world, key, width, height]);

  // Small countries (Malta, Singapore …) aren't in the 110m atlas – no map
  // then rather than an empty box.
  if (world && !world.some((c) => countryKey(c) === key)) return null;

  return (
    <div
      ref={ref}
      style={{
        background: "var(--theme-elevation-50)",
        borderRadius: "var(--style-radius-m)",
        height,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {label && (
        <span
          style={{
            background: "var(--theme-elevation-0)",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: 999,
            bottom: 8,
            color: "var(--theme-elevation-1000)",
            fontSize: 12,
            fontWeight: 600,
            left: 8,
            padding: "3px 10px",
            position: "absolute",
            zIndex: 1,
          }}
        >
          {label}
        </span>
      )}
      {path && world && (
        <svg
          aria-hidden="true"
          height={height}
          style={{ display: "block" }}
          width={width}
        >
          {world.map((country) => {
            const on = countryKey(country) === key;
            return (
              <path
                d={path(country) ?? ""}
                fill={on ? "var(--viz-seq-5)" : "var(--theme-elevation-150)"}
                key={countryKey(country)}
                stroke="var(--theme-elevation-50)"
                strokeWidth={on ? 1 : 0.5}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
};
