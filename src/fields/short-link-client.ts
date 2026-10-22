import { loadCutter } from "../card/load-cutter";
import { nameBase } from "../export/file-name";
import { shortLinkPreview } from "../export/makerworld";
import { FILAMENTS } from "../filaments";
import type { MeshData } from "../geometry/mesh";
import { GREETING_KEYS } from "../greeting";
import { currentForm } from "../link-keys";
import { readHash } from "../url-state";

/**
 * The admin's short links, in its browser (collections/short-links.ts): a
 * creation's link made whole, the admin's own short link for it, and the
 * picture of its cutter – rendered here, the server has no 3D. For kits
 * (makerworld-kit.tsx), links given above the list (short-links-tools.tsx)
 * and the Seeds page (admin/previews-runner.tsx).
 */

/** The default name, as on the site. */
export const FALLBACK_NAME = "Cookie Cutter";

/** A short link's picture without a kit: the kits' usual color. */
export const PREVIEW_COLOR = FILAMENTS[1];

/** A request to the REST API; its first error as the message. */
export const send = async <T>(url: string, init: RequestInit) => {
  const response = await fetch(url, { ...init, credentials: "include" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      body?.errors?.[0]?.message ?? body?.error ?? response.statusText
    );
  }
  return body as T;
};

/** A short link with its creation, whole (collections/short-links.ts). */
export type ShortLinkCreation = {
  id: string;
  code: string;
  creation: string;
  color: string | null;
  preview: boolean;
};

/** Short links with their creations: all, or those of `ids` or `codes`. */
export const creationsOf = async (
  api: string,
  which: { ids?: string[]; codes?: string[] } = {}
) =>
  (
    await send<{ links: ShortLinkCreation[] }>(`${api}/short-links/creations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(which),
    })
  ).links;

/** The name a creation's hash or link carries – empty if none. */
export const nameIn = (link: string | null | undefined) => {
  const hash = link?.trim().replace(/^[^#]*#?/, "") ?? "";
  return new URLSearchParams(hash).get("n")?.trim() ?? "";
};

/**
 * A link's creation as the editor writes it: a short link made whole, a
 * card's greeting left out – what a kit's editor link opens.
 */
export const creationHash = async (link: string) => {
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

/** A link's cutter, built here – its hash, its name and what came out. */
export const buildFromLink = async (link: string) => {
  const hash = await creationHash(link);
  const shared = readHash(hash);
  const built = await loadCutter(shared);
  if (!built) throw new Error("No cutter came out of it.");
  return { hash, shared, built, name: shared.name.trim() || FALLBACK_NAME };
};

/** A cutter's picture as a short link's preview – the old one goes. */
export const savePreview = async (
  api: string,
  link: { id: string; code: string },
  { name, mesh, color }: { name: string; mesh: MeshData; color: string }
) => {
  const picture = await shortLinkPreview(mesh, color);
  if (!picture) throw new Error("The picture could not be made.");
  const form = new FormData();
  form.append(
    "file",
    new File([picture], `${nameBase(name)}-${link.code}.png`, {
      type: "image/png",
    })
  );
  form.append("_payload", "{}");
  const { doc } = await send<{ doc: { id: string } }>(
    `${api}/short-link-previews`,
    { method: "POST", body: form }
  );
  await send(`${api}/short-links/${link.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preview: doc.id }),
  });
};

/**
 * The admin's own short link for a creation (`hash`) – one per model, made
 * the first time, named `label` (a kit's: “Halloween – Pumpkin”), with a
 * picture of the cutter to tell it by – and its code.
 */
export const adminShortLink = async (
  api: string,
  hash: string,
  {
    name,
    label = name,
    mesh,
    color,
  }: { name: string; label?: string; mesh: MeshData; color: string }
) => {
  const link = await send<{ id: string; code: string; preview: boolean }>(
    `${api}/short-links/kit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash, name: label, color }),
    }
  );
  if (!link.preview) await savePreview(api, link, { name, mesh, color });
  return link.code;
};
