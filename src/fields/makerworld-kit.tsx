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
import { cookieSeed } from "../cookie-jar";
import { setCookieColors } from "../cookies/dough";
import { download } from "../export/download";
import {
  type KitCutter,
  makerWorldZip,
  nearestColor,
} from "../export/makerworld";
import { FILAMENTS } from "../filaments";
import { greetingUrl, MAKERWORLD_GREETING } from "../greeting";
import { SITE } from "../seo";
import { shortened } from "../short-shape";
import type { CookieColors } from "../site-defaults";
import { adminShortLink, buildFromLink } from "./short-link-client";
import { SiteColorSwatches } from "./site-colors";

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

type Status =
  | { state: "idle" }
  | { state: "working"; note: string }
  | { state: "done"; file: string; local: string | null }
  | { state: "failed"; error: string };

/**
 * A kit's “Download kit”: its cutters built from their links right here –
 * the site's own code, in this browser – then the zip as the editor's
 * MakerWorld button makes it (export/makerworld.ts), from what is in the
 * form, saved or not. The cookies in the site's colors (Site global). Each
 * cutter's links are short links – the kits' own, kept for good – in this
 * database: on the site, unless the admin runs elsewhere (a local copy),
 * then there – they would lead nowhere on the site.
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
      message: state[`${row}.message`]?.value ?? "",
      links,
    });
  });
  const kit = useMemo(
    () =>
      JSON.parse(fields) as {
        name: string;
        color: string;
        message: string;
        links: string[];
      },
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
      // The kit's own text on the test card – or the usual one.
      const greeting = {
        ...MAKERWORLD_GREETING,
        message: kit.message.trim() || MAKERWORLD_GREETING.message,
        color: nearestColor(cardColors, kit.color),
      };
      // The short links' site: this database's.
      const { origin } = window.location;

      const cutters: KitCutter[] = [];
      for (const [i, link] of links.entries()) {
        setStatus({
          state: "working",
          note: `Building cutter ${i + 1} of ${links.length}…`,
        });
        const { hash, shared, built, name } = await buildFromLink(link).catch(
          (error: Error) => {
            throw new Error(`Link ${i + 1}: ${error.message}`);
          }
        );
        const { mesh, outline, icing, imprint, inlay } = built;
        setStatus({
          state: "working",
          note: `Short link for cutter ${i + 1} of ${links.length}…`,
        });
        // Named after kit and cutter: “Halloween – Pumpkin”.
        const kitName = kit.name.trim();
        const code = await adminShortLink(api, hash, {
          name,
          label: kitName && kitName !== name ? `${kitName} – ${name}` : name,
          mesh,
          color: kit.color,
        });
        cutters.push({
          mesh,
          name,
          size: shared.params.size,
          cookie: {
            dough: outline,
            icing,
            imprint,
            inlay,
            seed: cookieSeed(outline),
          },
          editorUrl: shortened(`${origin}/${hash}`, code),
          cardUrl: shortened(greetingUrl(hash, greeting, "en", origin), code),
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
        message: greeting.message,
        cutters,
      });
      download(zip, `${folder}.zip`);
      setStatus({
        state: "done",
        file: `${folder}.zip`,
        local: origin === SITE ? null : window.location.host,
      });
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
      {status.state === "done" && status.local && (
        <Pill pillStyle="warning" size="small">
          Its short links work on {status.local} only – for MakerWorld, download
          the kit in the site's admin.
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
