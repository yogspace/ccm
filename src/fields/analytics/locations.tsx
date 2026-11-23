"use client";

import { useState } from "react";
import { TRACKING } from "../../stats/config";
import { atlasKey, countryName, languageName } from "../../stats/country-codes";
import { journeysOf } from "../../stats/journeys";
import { pathLabel } from "../../stats/page-names";
import { tally } from "../../stats/tally";
import type { Visit } from "../../stats/visit-matrix";
import { countryFlag } from "../../stats/visit-name";
import { VisitMatrix } from "../visit-matrix";
import { BarList, barTable, ChartCard } from "./charts";
import { inWindow, rangeWindow, useAnalytics, type ViewRow } from "./data";
import { GeoMap } from "./geo-map";
import { Overlay } from "./journey-overlay";
import { fmt, Loading, MUTED, Note, Switches } from "./parts";
import { VisitBrowser } from "./visit-browser";

/**
 * Where people come from (`TRACKING.origin`): the world shaded by country –
 * regions and cities in the readout when pointing at one – beside the
 * countries as a list; below, the heatmap as a table: places × pages, by
 * country, region or city. With `TRACKING.visits` a click on a country – on
 * the map or in the list – opens its visitors with their paths. In the
 * range from the sidebar, or the hour or day chosen in the chart.
 *
 * The country database (scripts/geoip-download.sh) knows no region or city:
 * the levels without data are left out, and with the country alone there is
 * nothing to switch.
 */

type Level = "country" | "region" | "city";

const LEVELS: { value: Level; label: string; many: string }[] = [
  { value: "country", label: "Countries", many: "countries" },
  { value: "region", label: "Regions", many: "regions" },
  { value: "city", label: "Cities", many: "cities" },
];

/**
 * A view's place at a level – regions and cities with their country (there
 * is a Frankfurt twice), the country alone where the finer one is unknown.
 */
const placeOf = (row: ViewRow, level: Level) => {
  const country = row.country as string;
  const place =
    level === "region" ? row.region : level === "city" ? row.city : null;
  return place ? `${place} (${country})` : countryName(country);
};

const top = (values: (string | null | undefined)[], count = 3) =>
  tally(values.filter(Boolean)).slice(0, count);

/** A country's readout: views and share, then the strongest regions and cities. */
const Readout = ({
  code,
  rows,
  total,
}: {
  code: string;
  rows: ViewRow[];
  total: number;
}) => {
  const line = (label: string, list: [string, number][]) =>
    list.length > 0 && (
      <div style={{ marginTop: 4 }}>
        <span style={{ opacity: 0.7 }}>{label} </span>
        {list.map(([name, count]) => `${name} ${fmt(count)}`).join(" · ")}
      </div>
    );
  return (
    <>
      <strong>{fmt(rows.length)}</strong> page views ·{" "}
      {Math.round((rows.length / total) * 100)} %
      <div style={{ opacity: 0.7 }}>{countryName(code)}</div>
      {line("Regions", top(rows.map((row) => row.region)))}
      {line("Cities", top(rows.map((row) => row.city)))}
      {TRACKING.visits && (
        <div style={{ marginTop: 4, opacity: 0.7 }}>Click for its visitors</div>
      )}
    </>
  );
};

export const AnalyticsLocations = () => {
  const { data, range, focus } = useAnalytics();
  const [zoom, setZoom] = useState<"views" | "world">("views");
  // The level picked – null: the finest one with data.
  const [level, setLevel] = useState<Level | null>(null);
  // The country whose visitors are open – its ISO code (`TRACKING.visits`).
  const [opened, setOpened] = useState<string | null>(null);
  if (!data) return <Loading />;

  const w = rangeWindow(range, data.lastDigestAt);
  const inRange = focus
    ? inWindow(focus.from, focus.to)
    : inWindow(w.from, w.open ? Number.POSITIVE_INFINITY : w.to);
  const views = data.views.filter(inRange);
  const located = views.filter((row) => row.country);

  // By country – the map's keys are world-atlas ids.
  const byCountry = new Map<string, ViewRow[]>();
  for (const row of located) {
    const code = row.country as string;
    const list = byCountry.get(code);
    if (list) list.push(row);
    else byCountry.set(code, [row]);
  }
  const codeOf = new Map<string, string>();
  const shaded = new Map<string, number>();
  for (const [code, rows] of byCountry) {
    const key = atlasKey(code);
    if (!key) continue;
    codeOf.set(key, code);
    shaded.set(key, rows.length);
  }

  const countries = [...byCountry.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([code, rows]) => ({
      name: `${countryFlag(code)} ${countryName(code)}`.trim(),
      value: rows.length,
      title: TRACKING.visits
        ? `${countryName(code)} (${code}) – click for its visitors`
        : `${countryName(code)} (${code})`,
      key: code,
    }));
  const languages = tally(views.map((row) => row.language).filter(Boolean)).map(
    ([code, value]) => ({ name: languageName(code), value, title: code })
  );

  // The opened country's visitors – views with a visit id only, as in
  // Visitors.
  const visitors =
    TRACKING.visits && opened
      ? journeysOf(
          (byCountry.get(opened) ?? []).filter((row) => row.visit),
          pathLabel
        )
      : [];

  // The heatmap: every located view as page × place – the grid of Visitors,
  // the place standing where the device stands there.
  const levels = LEVELS.filter(
    (option) =>
      option.value === "country" ||
      located.some((row) => row[option.value as "region" | "city"])
  );
  const levelInfo =
    levels.find((option) => option.value === level) ??
    levels[levels.length - 1];
  const places: Visit[] = located.map((row) => ({
    page: row.path || "—",
    device: placeOf(row, levelInfo.value),
    at: new Date(row.createdAt).getTime(),
  }));

  const readout = (key: string) => {
    const code = codeOf.get(key) ?? key;
    return (
      <Readout
        code={code}
        rows={byCountry.get(code) ?? []}
        total={located.length}
      />
    );
  };

  return (
    <div className="stats-viz">
      {located.length > 0 && located.length < views.length && (
        <Note>
          {fmt(views.length - located.length)} page views without a country
          <span style={{ color: MUTED }}>
            {" "}
            – from before countries were recorded, or an address the database
            doesn't know
          </span>
        </Note>
      )}
      {located.length === 0 ? (
        <Note>No countries in this time range.</Note>
      ) : (
        <>
          <div className="stats-viz__grid stats-viz__grid--map">
            <ChartCard
              aside={
                <Switches
                  onChange={setZoom}
                  options={[
                    { value: "views", label: "Where the views are" },
                    { value: "world", label: "World" },
                  ]}
                  value={zoom}
                />
              }
              title="Where people come from"
            >
              <GeoMap
                countries={shaded}
                details={readout}
                onPick={
                  TRACKING.visits
                    ? (key) => setOpened(codeOf.get(key) ?? null)
                    : undefined
                }
                unit="page views"
                zoom={zoom}
              />
            </ChartCard>
            <ChartCard table={barTable(countries, "Country")} title="Countries">
              <BarList
                entries={countries}
                limit={10}
                onPick={
                  TRACKING.visits
                    ? (entry) => setOpened(entry.key ?? null)
                    : undefined
                }
              />
            </ChartCard>
          </div>
          <ChartCard
            aside={
              levels.length > 1 ? (
                <Switches
                  onChange={setLevel}
                  options={levels}
                  value={levelInfo.value}
                />
              ) : undefined
            }
            title={`Pages × ${levelInfo.many}`}
          >
            <VisitMatrix
              columnNoun={{ one: "place", many: levelInfo.many }}
              visits={places}
            />
          </ChartCard>
          <ChartCard
            aside="the browser's first"
            table={barTable(languages, "Language")}
            title="Languages"
          >
            <BarList entries={languages} limit={10} />
          </ChartCard>
        </>
      )}
      {opened && (
        <Overlay
          icon={
            <span aria-hidden="true" style={{ fontSize: 34, lineHeight: 1 }}>
              {countryFlag(opened)}
            </span>
          }
          maxWidth={860}
          onClose={() => setOpened(null)}
          subtitle={`${fmt(visitors.length)} ${visitors.length === 1 ? "visitor" : "visitors"} · ${fmt(byCountry.get(opened)?.length ?? 0)} page views`}
          title={countryName(opened)}
        >
          <VisitBrowser
            journeys={visitors}
            key={opened}
            within={countryName(opened)}
          />
        </Overlay>
      )}
      <Note>
        <span style={{ color: MUTED }}>
          Only the country – looked up from the IP, which is never stored.
          {/* The database's attribution, where its licence asks for one –
              DB-IP Lite (CC BY 4.0) as here; MaxMind GeoLite2 names itself;
              CDN headers need none (then drop the sentence). */}{" "}
          IP geolocation by{" "}
          <a href="https://db-ip.com" rel="noreferrer" target="_blank">
            DB-IP
          </a>{" "}
          (CC BY 4.0).
        </span>
      </Note>
    </div>
  );
};
