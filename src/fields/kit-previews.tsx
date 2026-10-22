"use client";

import { useConfig, useDocumentEvents } from "@payloadcms/ui";
import { useEffect, useRef, useState } from "react";
import {
  buildFromLink,
  creationsOf,
  PREVIEW_COLOR,
  savePreview,
} from "./short-link-client";

type State =
  | { status: "idle" }
  | { status: "running"; done: number; of: number }
  | { status: "done"; drawn: number; failed: number };

/**
 * Beside the MakerWorld kits' Save: once saved, the server has made each
 * cutter's short link (globals/makerworld.ts) – their pictures are drawn
 * here, in this browser, the server has no 3D: every one of the admin's
 * own short links still without one. Saved again meanwhile, it looks once
 * more when done.
 */
export const KitPreviews = () => {
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const { mostRecentUpdate } = useDocumentEvents();
  const [state, setState] = useState<State>({ status: "idle" });
  const running = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    if (mostRecentUpdate?.entitySlug !== "makerworld") return;
    if (mostRecentUpdate.drawerSlug) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    const draw = async () => {
      let drawn = 0;
      let failed = 0;
      do {
        again.current = false;
        const links = await creationsOf(api, { own: true, missing: true });
        for (const [i, link] of links.entries()) {
          setState({ status: "running", done: i, of: links.length });
          try {
            const { built, name } = await buildFromLink(link.creation);
            await savePreview(api, link, {
              name,
              mesh: built.mesh,
              color: link.color ?? PREVIEW_COLOR,
            });
            drawn++;
          } catch {
            failed++;
          }
        }
      } while (again.current);
      return { drawn, failed };
    };
    draw()
      .then(({ drawn, failed }) =>
        setState(
          drawn + failed > 0
            ? { status: "done", drawn, failed }
            : { status: "idle" }
        )
      )
      .catch(() => setState({ status: "done", drawn: 0, failed: 1 }))
      .finally(() => {
        running.current = false;
      });
  }, [api, mostRecentUpdate]);

  if (state.status === "idle") return null;
  return (
    <span
      style={{
        color:
          state.status === "done" && state.failed > 0
            ? "var(--theme-error-500)"
            : "var(--theme-elevation-500)",
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {state.status === "running"
        ? `Drawing short link pictures ${state.done + 1} of ${state.of}…`
        : state.failed > 0
          ? `${state.drawn} short link pictures drawn, ${state.failed} failed`
          : `${state.drawn} short link ${state.drawn === 1 ? "picture" : "pictures"} drawn`}
    </span>
  );
};
