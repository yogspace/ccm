"use client";

import { Button, Pill, useConfig } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "../glaze.css";
import { loadCutter } from "../card/load-cutter";
import {
  paintSharePicture,
  SHARE_CARD,
  SHARE_PICTURE_COLORS,
} from "../components/card-image";
import type { MeshData } from "../geometry/mesh";
import { resolveColors } from "../glaze";
import { renderMeshTop } from "../render-top";
import { isEmptyDrawing, readHash } from "../url-state";
import { SiteColorSwatches, useSiteColors } from "./site-colors";

type Built = { link: string; mesh: MeshData };

type Status =
  | { state: "idle" }
  | { state: "building" }
  | { state: "saving" }
  | { state: "saved"; name: string }
  | { state: "failed"; error: string };

/** The default name on a card, as on the share picture. */
const FALLBACK_NAME = "Cookie Cutter";

/** The color's shades as plain colors – read from glaze.css. */
const shadesOf = (color: string) => {
  const probe = document.createElement("span");
  probe.className = "glaze";
  probe.style.setProperty("--glaze", color);
  probe.hidden = true;
  document.body.append(probe);
  try {
    return resolveColors(probe, SHARE_PICTURE_COLORS);
  } finally {
    probe.remove();
  }
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Above the gallery's list: a card from a creation's link. The link's
 * drawing becomes its cutter right here – the site's own code, in this
 * browser – rendered from above in the chosen card color; the preview is
 * the share picture as the site paints it. Added, the rendering is the
 * picture, with the link, the name and the color beside it; the site lays it
 * on the card (gallery-fan.tsx).
 */
export const GalleryBuilder = () => {
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const router = useRouter();
  const [text, setText] = useState("");
  const colors = useSiteColors();
  const [color, setColor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [built, setBuilt] = useState<Built | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  /** The cutter from above in the chosen color – the picture to upload. */
  const [view, setView] = useState<HTMLCanvasElement | null>(null);
  const chosen = color ?? colors[0]?.color ?? "#2a44ff";

  // Rendered anew for another color …
  useEffect(() => {
    setView(
      built
        ? renderMeshTop(built.mesh, chosen, SHARE_CARD.w, SHARE_CARD.h)
        : null
    );
  }, [built, chosen]);

  // … and the preview painted anew for it, or for another name.
  useEffect(() => {
    if (!view) return;
    let current = true;
    paintSharePicture(view, name.trim() || FALLBACK_NAME, shadesOf(chosen))
      .then((blob) => {
        if (current && blob) setPreview(URL.createObjectURL(blob));
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [view, name, chosen]);

  // The previous preview's memory goes once the next one is there.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const build = async () => {
    let shared: ReturnType<typeof readHash>;
    let link: string;
    try {
      const url = new URL(text.trim());
      link = url.href;
      shared = readHash(url.hash);
    } catch {
      setStatus({ state: "failed", error: "That is not a link." });
      return;
    }
    if (shared.rings.length === 0 && isEmptyDrawing(shared.drawing)) {
      setStatus({ state: "failed", error: "This link has no drawing." });
      return;
    }
    setStatus({ state: "building" });
    setBuilt(null);
    setPreview(null);
    try {
      const result = await loadCutter(shared);
      if (!result) {
        setStatus({
          state: "failed",
          error: "No cutter came out of this drawing.",
        });
        return;
      }
      setName(shared.name.trim());
      setBuilt({ link, mesh: result.mesh });
      setStatus({ state: "idle" });
    } catch (error) {
      setStatus({
        state: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const add = async () => {
    if (!(built && view)) return;
    setStatus({ state: "saving" });
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        view.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("The picture could not be made.");
      const title = name.trim();
      const form = new FormData();
      form.append(
        "file",
        new File([blob], `${slug(title) || "cookie-cutter"}.png`, {
          type: "image/png",
        })
      );
      form.append(
        "_payload",
        JSON.stringify({ name: title, color: chosen, link: built.link })
      );
      const response = await fetch(`${api}/gallery`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.errors?.[0]?.message ?? response.statusText);
      }
      setStatus({ state: "saved", name: title || FALLBACK_NAME });
      setText("");
      setBuilt(null);
      setPreview(null);
      router.refresh();
    } catch (error) {
      setStatus({
        state: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const busy = status.state === "building" || status.state === "saving";

  return (
    <section className="gallery-builder">
      <div className="gallery-builder-form">
        <h3>Build a card from a link</h3>
        <p>
          Paste a creation's link – from “Share creation” or the address bar.
          Its cutter is built here and laid on the card, like the share picture.
        </p>
        <form
          className="gallery-builder-row"
          onSubmit={(event) => {
            event.preventDefault();
            build();
          }}
        >
          <input
            aria-label="The creation's link"
            className="gallery-builder-input"
            onChange={(event) => setText(event.target.value)}
            placeholder="https://ccm.mxwr.de/#…"
            type="url"
            value={text}
          />
          <Button
            buttonStyle="secondary"
            disabled={busy || !text.trim()}
            margin={false}
            size="medium"
            type="submit"
          >
            {status.state === "building" ? "Building…" : "Build"}
          </Button>
        </form>

        {built && (
          <>
            <label className="gallery-builder-label">
              Name
              <input
                className="gallery-builder-input"
                onChange={(event) => setName(event.target.value)}
                placeholder={FALLBACK_NAME}
                value={name}
              />
            </label>
            {colors.length > 0 && (
              <div className="gallery-builder-label">
                Color
                <SiteColorSwatches
                  colors={colors}
                  onChange={setColor}
                  value={chosen}
                />
              </div>
            )}
            <div>
              <Button
                buttonStyle="primary"
                disabled={busy || !preview}
                margin={false}
                onClick={add}
                size="medium"
                type="button"
              >
                {status.state === "saving" ? "Adding…" : "Add to gallery"}
              </Button>
            </div>
          </>
        )}

        {status.state === "saved" && (
          <div>
            <Pill pillStyle="success" size="small">
              “{status.name}” is in the gallery.
            </Pill>
          </div>
        )}
        {status.state === "failed" && (
          <div>
            <Pill pillStyle="error" size="small">
              {status.error}
            </Pill>
          </div>
        )}
      </div>

      {(preview || status.state === "building") && (
        <div className="gallery-builder-preview">
          {preview ? (
            <img alt="The card as the gallery shows it" src={preview} />
          ) : (
            <span>Building the cutter…</span>
          )}
        </div>
      )}
    </section>
  );
};
