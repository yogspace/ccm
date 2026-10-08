"use client";

import {
  Button,
  ConfirmationModal,
  Pill,
  useConfig,
  useModal,
} from "@payloadcms/ui";
import { useState } from "react";
import {
  SEED_TEXTS,
  SEEDS,
  type SeedKey,
  type SeedResponse,
  seedCanReplace,
} from "../seeds/definitions";

type SeedState =
  | { status: "idle" }
  | { status: "running"; replace: boolean }
  | { status: "done"; summary: string }
  | { status: "failed"; error: string };

const replaceModalSlug = (key: SeedKey) => `seed-replace-${key}`;

/**
 * One block per seed: “Fill” adds what is missing, “Replace…” – where a seed
 * offers it – sets it back to the code's version after a confirmation. The
 * result stays beside it as a summary (seeds/endpoint.ts).
 */
export const SeedsRunner = () => {
  const { openModal } = useModal();
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const [states, setStates] = useState<Partial<Record<SeedKey, SeedState>>>({});

  const run = async (key: SeedKey, replace: boolean) => {
    setStates((prev) => ({ ...prev, [key]: { status: "running", replace } }));
    try {
      const response = await fetch(
        `${api}/seeds/${key}${replace ? "?mode=replace" : ""}`,
        { method: "POST", credentials: "include" }
      );
      const body = (await response.json()) as SeedResponse;
      setStates((prev) => ({
        ...prev,
        [key]:
          response.ok && body.summary
            ? { status: "done", summary: body.summary }
            : { status: "failed", error: body.error ?? response.statusText },
      }));
    } catch (error) {
      setStates((prev) => ({
        ...prev,
        [key]: {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  };

  const anyRunning = Object.values(states).some(
    (state) => state?.status === "running"
  );

  return (
    <div className="seeds-list">
      {SEEDS.map((key) => {
        const { title, description, replaceWarning } = SEED_TEXTS[key];
        const state = states[key] ?? { status: "idle" };
        const running = state.status === "running";

        return (
          <section className="seed" key={key}>
            <div className="seed-text">
              <h3>{title}</h3>
              <p>{description}</p>
              {state.status === "done" && (
                <div>
                  <Pill pillStyle="success" size="small">
                    {state.summary}
                  </Pill>
                </div>
              )}
              {state.status === "failed" && (
                <div>
                  <Pill pillStyle="error" size="small">
                    Failed: {state.error}
                  </Pill>
                </div>
              )}
            </div>

            <div className="seed-actions">
              {seedCanReplace[key] && (
                <Button
                  buttonStyle="secondary"
                  disabled={anyRunning}
                  margin={false}
                  onClick={() => openModal(replaceModalSlug(key))}
                  size="medium"
                  type="button"
                >
                  {running && state.replace ? "Running…" : "Replace…"}
                </Button>
              )}
              <Button
                buttonStyle="primary"
                disabled={anyRunning}
                margin={false}
                onClick={() => run(key, false)}
                size="medium"
                type="button"
              >
                {running && !state.replace ? "Running…" : "Fill"}
              </Button>
            </div>

            {seedCanReplace[key] && (
              <ConfirmationModal
                body={<p>{replaceWarning}</p>}
                confirmingLabel="Running…"
                confirmLabel="Replace"
                heading={`Replace ${title}?`}
                modalSlug={replaceModalSlug(key)}
                onConfirm={() => run(key, true)}
              />
            )}
          </section>
        );
      })}
    </div>
  );
};

export default SeedsRunner;
