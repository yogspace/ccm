"use client";

import {
  Button,
  FieldDescription,
  FieldLabel,
  Pill,
  useConfig,
  useField,
  useFormFields,
  useRowLabel,
} from "@payloadcms/ui";
import type { TextFieldClientComponent, UIFieldClientComponent } from "payload";
import { useMemo, useState } from "react";
import { loadCutter } from "../card/load-cutter";
import { cookieSeed } from "../cookie-jar";
import { setCookieColors } from "../cookies/dough";
import { download } from "../export/download";
import {
  type KitCutter,
  MAKERWORLD_GREETING,
  makerWorldZip,
  nearestColor,
} from "../export/makerworld";
import { FILAMENTS } from "../filaments";
import { GREETING_KEYS, greetingUrl } from "../greeting";
import { currentForm } from "../link-keys";
import { SITE } from "../seo";
import type { CookieColors } from "../site-defaults";
import { readHash } from "../url-state";
import { SiteColorSwatches } from "./site-colors";

/** The default name, as on the site. */
const FALLBACK_NAME = "Cookie Cutter";

/** The 3D views' filaments, by name (filaments.ts). */
const FILAMENT_NAMES = [
  "Blue",
  "Orange",
  "Pink",
  "Green",
  "Clay",
  "Yellow",
  "Teal",
];
const FILAMENT_COLORS = FILAMENTS.map((color, i) => ({
  color,
  name: FILAMENT_NAMES[i] ?? color,
}));

/** The name a creation's link carries – empty if none. */
const nameOf = (link: string | undefined) => {
  try {
    const hash = new URL(link?.trim() ?? "").hash.replace(/^#/, "");
    return new URLSearchParams(hash).get("n")?.trim() ?? "";
  } catch {
    return "";
  }
};

/**
 * A link's creation as the editor writes it: a short link made whole, a
 * card's greeting left out – what the kit's editor link opens.
 */
const creationHash = async (link: string) => {
  const query = new URLSearchParams(
    new URL(link.trim()).hash.replace(/^#/, "")
  );
  const code = query.get("k");
  if (code && !query.has("s")) {
    const response = await fetch(`/next/shape/${encodeURIComponent(code)}`);
    const { shape } = response.ok ? await response.json() : {};
    if (typeof shape !== "string") {
      throw new Error(`The short link's drawing is gone (${code}).`);
    }
    query.delete("k");
    query.set("s", shape);
  }
  for (const key of [...Object.values(GREETING_KEYS), "to", "from"]) {
    query.delete(key);
  }
  return currentForm(`#${query}`);
};

type Status =
  | { state: "idle" }
  | { state: "working"; note: string }
  | { state: "done"; file: string }
  | { state: "failed"; error: string };

/**
 * A kit's “Download kit”: its cutters built from their links right here –
 * the site's own code, in this browser – then the zip as the editor's
 * MakerWorld button makes it (export/makerworld.ts), from what is in the
 * form, saved or not. The cookies in the site's colors (Site global).
 */
export const KitDownload: UIFieldClientComponent = ({ path }) => {
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const row = path.slice(0, path.lastIndexOf("."));
  // Its fields as one string: the button only renders again when they change.
  const fields = useFormFields(([state]) => {
    const links = Object.entries(state)
      .map(([key, field]) => ({
        at: key.match(/^(.*)\.cutters\.(\d+)\.link$/),
        value: field?.value,
      }))
      .filter(({ at }) => at?.[1] === row)
      .sort((a, b) => Number(a.at?.[2]) - Number(b.at?.[2]))
      .map(({ value }) => (typeof value === "string" ? value : ""));
    return JSON.stringify({
      name: state[`${row}.name`]?.value ?? "",
      color: state[`${row}.color`]?.value ?? FILAMENTS[1],
      links,
    });
  });
  const kit = useMemo(
    () =>
      JSON.parse(fields) as { name: string; color: string; links: string[] },
    [fields]
  );
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const links = kit.links.filter((link) => link.trim());

  const build = async () => {
    try {
      setStatus({ state: "working", note: "Fetching the site's colors…" });
      const site = (await fetch(`${api}/globals/site?depth=0`, {
        credentials: "include",
      }).then((response) => response.json())) as {
        cardColors?: { color: string }[];
        cookies?: CookieColors;
      };
      const cardColors = (site.cardColors ?? []).map(({ color }) => color);
      if (site.cookies) {
        setCookieColors({
          ...site.cookies,
          sprinkles: [...cardColors, "#ffffff"],
        });
      }
      const greeting = {
        ...MAKERWORLD_GREETING,
        color: nearestColor(cardColors, kit.color),
      };

      const cutters: KitCutter[] = [];
      for (const [i, link] of links.entries()) {
        setStatus({
          state: "working",
          note: `Building cutter ${i + 1} of ${links.length}…`,
        });
        const hash = await creationHash(link);
        const shared = readHash(hash);
        const built = await loadCutter(shared);
        if (!built) throw new Error(`No cutter came out of link ${i + 1}.`);
        const { mesh, outline, icing, imprint, inlay } = built;
        cutters.push({
          mesh,
          name: shared.name.trim() || FALLBACK_NAME,
          size: shared.params.size,
          cookie: {
            dough: outline,
            icing,
            imprint,
            inlay,
            seed: cookieSeed(outline),
          },
          editorUrl: `${SITE}/${hash}`,
          cardUrl: greetingUrl(hash, greeting, "en", SITE),
        });
      }

      setStatus({
        state: "working",
        note: "Rendering the pictures and packing the zip…",
      });
      const { zip, folder } = await makerWorldZip({
        name:
          kit.name.trim() ||
          (cutters.length === 1 ? cutters[0].name : "Cookie Cutters"),
        color: kit.color,
        cutters,
      });
      download(zip, `${folder}.zip`);
      setStatus({ state: "done", file: `${folder}.zip` });
    } catch (error) {
      setStatus({
        state: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const working = status.state === "working";
  return (
    <div className="field-type makerworld-kit">
      <Button
        buttonStyle="primary"
        disabled={working || links.length === 0}
        margin={false}
        onClick={build}
        size="medium"
        type="button"
      >
        {working
          ? "Working…"
          : links.length > 1
            ? `Download set kit (${links.length} cutters)`
            : "Download kit"}
      </Button>
      {status.state === "working" && <span>{status.note}</span>}
      {status.state === "done" && (
        <Pill pillStyle="success" size="small">
          {status.file} is in your downloads.
        </Pill>
      )}
      {status.state === "failed" && (
        <Pill pillStyle="error" size="small">
          {status.error}
        </Pill>
      )}
    </div>
  );
};

/** The kit's color: the 3D views' filaments as swatches. */
export const FilamentField: TextFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<string>({ path });
  return (
    <div className="field-type makerworld-filament">
      <FieldLabel label={field.label} path={path} required={field.required} />
      <SiteColorSwatches
        colors={FILAMENT_COLORS}
        onChange={setValue}
        value={value ?? null}
      />
      <FieldDescription description={field.admin?.description} path={path} />
    </div>
  );
};

/** A kit, closed: its name – or its cutters' – and how many. */
export const KitRowLabel = () => {
  const { data, rowNumber = 0 } = useRowLabel<{
    name?: string;
    cutters?: { link?: string }[];
  }>();
  const cutters = data?.cutters ?? [];
  const names = cutters.map(({ link }) => nameOf(link)).filter(Boolean);
  const title =
    data?.name?.trim() || names.join(", ") || `Kit ${rowNumber + 1}`;
  return (
    <span>
      {title}
      {cutters.length > 1 && <small> · set of {cutters.length}</small>}
    </span>
  );
};

/** A cutter, closed: the name its link carries. */
export const CutterRowLabel = () => {
  const { data, rowNumber = 0 } = useRowLabel<{ link?: string }>();
  return <span>{nameOf(data?.link) || `Cutter ${rowNumber + 1}`}</span>;
};
