"use client";

import { Button } from "@payloadcms/ui";
import { type FormEvent, useState } from "react";

/**
 * Above the accounts: find one by its passphrase – the server computes the
 * key and answers with the account it belongs to (collections/accounts.ts).
 * Nothing is kept; passphrases themselves are never stored.
 */
export const AccountFinder = () => {
  const [phrase, setPhrase] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "none" | "failed">(
    "idle"
  );

  const find = async (event: FormEvent) => {
    event.preventDefault();
    if (!phrase.trim()) return;
    setState("busy");
    try {
      const response = await fetch("/api/accounts/find", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: phrase }),
      });
      if (response.ok) {
        const { id } = (await response.json()) as { id: string };
        window.location.assign(`/admin/collections/accounts/${id}`);
        return;
      }
      setState(response.status === 404 ? "none" : "failed");
    } catch {
      setState("failed");
    }
  };

  return (
    <form
      onSubmit={find}
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 24,
      }}
    >
      <input
        aria-label="Passphrase"
        autoComplete="off"
        onChange={(event) => {
          setPhrase(event.target.value);
          setState("idle");
        }}
        placeholder="Find an account by its passphrase"
        spellCheck={false}
        style={{
          background: "var(--theme-input-bg)",
          border: "1px solid var(--theme-elevation-150)",
          borderRadius: "var(--style-radius-s)",
          color: "var(--theme-elevation-800)",
          flex: "1 1 18rem",
          padding: "8px 12px",
        }}
        value={phrase}
      />
      <Button
        buttonStyle="secondary"
        disabled={state === "busy" || !phrase.trim()}
        margin={false}
        type="submit"
      >
        Find
      </Button>
      {state === "none" && (
        <span style={{ color: "var(--theme-elevation-500)" }}>
          No account has this passphrase.
        </span>
      )}
      {state === "failed" && (
        <span style={{ color: "var(--theme-error-500)" }}>
          That did not work.
        </span>
      )}
    </form>
  );
};
