"use client";

import { Button, Pill, useConfig, useSelection } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { isCode } from "../account/rules";
import { SITE } from "../seo";
import { shortened } from "../short-shape";
import {
  adminShortLink,
  buildFromLink,
  PREVIEW_COLOR,
  send,
} from "./short-link-client";

type Made =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "done"; url: string }
  | { state: "failed"; error: string };

/**
 * Above the short links: one made from a creation's link – or from a short
 * link's code, a visitor's too, then as their online cookie has it – kept
 * for good, with its picture (short-link-client.ts); and the ticked ones as
 * a new MakerWorld kit – several a set, one a single cutter – then on to
 * the kits, where it is first (collections/short-links.ts).
 */
export const ShortLinksTools = () => {
  const {
    config: {
      routes: { admin, api },
    },
  } = useConfig();
  const router = useRouter();
  const { count, getSelectedIds } = useSelection();
  const [input, setInput] = useState("");
  const [made, setMade] = useState<Made>({ state: "idle" });
  const [kit, setKit] = useState<"idle" | "busy" | "failed">("idle");

  /** What was typed: a link, a hash, a code (`k=` or bare) – as a link. */
  const linkOf = async (text: string) => {
    const code = text.replace(/^#?k=/, "");
    if (isCode(code)) {
      const { links } = await send<{ links: { creation: string }[] }>(
        `${api}/short-links/previews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes: [code] }),
        }
      );
      return links[0]?.creation ?? `${SITE}/#k=${code}`;
    }
    if (/^https?:\/\//.test(text)) return text;
    return `${SITE}/#${text.replace(/^#/, "")}`;
  };

  const make = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMade({ state: "busy" });
    try {
      const { hash, built, name } = await buildFromLink(await linkOf(text));
      const code = await adminShortLink(api, hash, {
        name,
        mesh: built.mesh,
        color: PREVIEW_COLOR,
      });
      setMade({
        state: "done",
        url: shortened(`${window.location.origin}/${hash}`, code),
      });
      setInput("");
      router.refresh();
    } catch (error) {
      setMade({
        state: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const makeKit = async () => {
    setKit("busy");
    try {
      await send(`${api}/short-links/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: getSelectedIds().map(String) }),
      });
      window.location.assign(`${admin}/globals/makerworld`);
    } catch {
      setKit("failed");
    }
  };

  const row = {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  } as const;

  return (
    <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
      <form onSubmit={make} style={row}>
        <input
          aria-label="A creation's link or a short link's code"
          autoComplete="off"
          onChange={(event) => {
            setInput(event.target.value);
            if (made.state === "failed") setMade({ state: "idle" });
          }}
          placeholder="A creation's link or a short link's code"
          spellCheck={false}
          style={{
            background: "var(--theme-input-bg)",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: "var(--style-radius-s)",
            color: "var(--theme-elevation-800)",
            flex: "1 1 18rem",
            padding: "8px 12px",
          }}
          value={input}
        />
        <Button
          buttonStyle="secondary"
          disabled={made.state === "busy" || !input.trim()}
          margin={false}
          type="submit"
        >
          {made.state === "busy" ? "Working…" : "Make short link"}
        </Button>
        {made.state === "done" && (
          <Pill pillStyle="success" size="small">
            <a href={made.url} rel="noopener" target="_blank">
              {made.url.length > 90 ? `${made.url.slice(0, 90)}…` : made.url}
            </a>
          </Pill>
        )}
        {made.state === "failed" && (
          <Pill pillStyle="error" size="small">
            {made.error}
          </Pill>
        )}
      </form>
      <div style={row}>
        <Button
          buttonStyle="secondary"
          disabled={kit === "busy" || count === 0}
          margin={false}
          onClick={makeKit}
          type="button"
        >
          {count > 1
            ? `Make a MakerWorld set of ${count}`
            : "Make a MakerWorld kit"}
        </Button>
        {count === 0 && (
          <span style={{ color: "var(--theme-elevation-500)" }}>
            Tick the short links for it first.
          </span>
        )}
        {kit === "failed" && (
          <span style={{ color: "var(--theme-error-500)" }}>
            That did not work.
          </span>
        )}
      </div>
    </div>
  );
};
