"use client";

import { Button } from "@payloadcms/ui";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import type { SeedReport } from "../translations/seed";

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--theme-elevation-400)",
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 12,
  color: "var(--theme-elevation-500)",
  maxHeight: 160,
  overflowY: "auto",
};

/**
 * “Add missing keys” above the texts. The code holds the starting texts, this
 * global the valid ones; after a deploy the new keys are the gap between
 * them. The start of the app closes it anyway – this shows it, and closes it
 * from here.
 *
 * First look, then write: opening runs a dry run (GET, changes nothing). The
 * button only appears when there IS something to add. Existing texts are
 * never overwritten – that is up to seedTranslations, not this button.
 */
export const SeedTranslationsButton = () => {
  const [reports, setReports] = useState<SeedReport[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const check = useCallback(async () => {
    try {
      const response = await fetch("/next/seed-translations", {
        credentials: "include",
      });
      if (!response.ok) {
        setIsError(true);
        setMessage(`Check failed (HTTP ${response.status}).`);
        return;
      }
      setReports(
        ((await response.json()) as { reports: SeedReport[] }).reports
      );
    } catch {
      setIsError(true);
      setMessage("Network error.");
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const apply = async () => {
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/next/seed-translations", {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as {
        reports?: SeedReport[];
        error?: string;
      } | null;
      if (!response.ok) {
        setIsError(true);
        setMessage(data?.error ?? `Adding failed (HTTP ${response.status}).`);
        return;
      }
      const written = (data?.reports ?? []).reduce(
        (sum, report) => sum + report.missing.length,
        0
      );
      setReports([]);
      // No automatic reload: the form may hold unsaved changes.
      setMessage(
        written === 0
          ? "Nothing to add – everything was there already."
          : `${written} entries written. Reload the page to see them in the fields.`
      );
    } catch {
      setIsError(true);
      setMessage("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const missing = (reports ?? []).filter((report) => report.missing.length > 0);
  const total = missing.reduce((sum, report) => sum + report.missing.length, 0);

  return (
    <div
      className="field-type"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <p style={hintStyle}>
        New keys from the code are added with the text written there. Existing
        entries stay as they are.
      </p>
      {reports === null && !message ? (
        <p style={hintStyle}>Checking …</p>
      ) : null}
      {reports !== null && total === 0 && !message ? (
        <p style={hintStyle}>All keys are there.</p>
      ) : null}
      {total > 0 ? (
        <>
          <ul style={listStyle}>
            {missing.map((report) => (
              <li key={report.locale}>
                <strong>{report.locale.toUpperCase()}</strong>:{" "}
                {report.missing.join(", ")}
              </li>
            ))}
          </ul>
          <div>
            <Button
              buttonStyle="subtle"
              className="field-btn"
              disabled={busy}
              margin={false}
              onClick={apply}
              size="medium"
              type="button"
            >
              {busy ? "Adding …" : `Add ${total} missing keys`}
            </Button>
          </div>
        </>
      ) : null}
      {message ? (
        <p
          style={{
            ...hintStyle,
            color: isError
              ? "var(--theme-error-500)"
              : "var(--theme-success-500)",
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
};
