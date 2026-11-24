"use client";

import { Button, Pill, useConfig } from "@payloadcms/ui";
import { useState } from "react";
import { creationsOf, drawPreview } from "../fields/short-link-client";

type State =
  | { status: "idle" }
  | { status: "running"; all: boolean; done: number; of: number }
  | { status: "done"; summary: string; failed: string[] }
  | { status: "failed"; error: string };

/**
 * The Seeds page's pictures of the short links (collections/short-links.ts):
 * each one drawn on the server (`/:id/preview`, export/server-preview.ts) –
 * the same as a short link's “Render preview again”, so the pictures are
 * the same too – one after another, its old picture replaced. All of them,
 * or only those still without one. A kit's in its color, the others in the
 * usual one.
 */
export const PreviewsRunner = () => {
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const [state, setState] = useState<State>({ status: "idle" });

  const run = async (all: boolean) => {
    setState({ status: "running", all, done: 0, of: 0 });
    try {
      const todo = await creationsOf(api, all ? {} : { missing: true });
      const failed: string[] = [];
      for (const [i, link] of todo.entries()) {
        setState({ status: "running", all, done: i, of: todo.length });
        try {
          // All: drawn anew, the old picture replaced.
          await drawPreview(api, link.id, { force: all });
        } catch (error) {
          failed.push(
            `${link.code}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      const drawn = todo.length - failed.length;
      setState({
        status: "done",
        summary:
          todo.length === 0
            ? "Every short link has its picture."
            : `${drawn} of ${todo.length} drawn.`,
        failed,
      });
    } catch (error) {
      setState({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const running = state.status === "running";
  return (
    <section className="seed">
      <div className="seed-text">
        <h3>Short link previews</h3>
        <p>
          Draws the cutter of every short link – for the list under Short links,
          seen only here. On the server, a few seconds each; keep the page open
          until it is done.
        </p>
        {running && (
          <div>
            <Pill size="small">
              {state.of === 0
                ? "Fetching the short links…"
                : `Drawing ${state.done + 1} of ${state.of}…`}
            </Pill>
          </div>
        )}
        {state.status === "done" && (
          <div>
            <Pill
              pillStyle={state.failed.length > 0 ? "warning" : "success"}
              size="small"
            >
              {state.summary}
            </Pill>
          </div>
        )}
        {state.status === "done" &&
          state.failed.map((line) => (
            <div key={line}>
              <Pill pillStyle="error" size="small">
                {line}
              </Pill>
            </div>
          ))}
        {state.status === "failed" && (
          <div>
            <Pill pillStyle="error" size="small">
              Failed: {state.error}
            </Pill>
          </div>
        )}
      </div>

      <div className="seed-actions">
        <Button
          buttonStyle="secondary"
          disabled={running}
          margin={false}
          onClick={() => run(false)}
          size="medium"
          type="button"
        >
          {running && !state.all ? "Running…" : "Only missing"}
        </Button>
        <Button
          buttonStyle="primary"
          disabled={running}
          margin={false}
          onClick={() => run(true)}
          size="medium"
          type="button"
        >
          {running && state.all ? "Running…" : "Render all"}
        </Button>
      </div>
    </section>
  );
};
