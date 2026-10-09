"use client";

import { Button, useDocumentInfo } from "@payloadcms/ui";
import { useState } from "react";

/**
 * For an account kept forever – your own: a fresh passphrase, kept with it
 * (collections/accounts.ts). The old one stops working.
 */
export const NewPassphrase = () => {
  const { id } = useDocumentInfo();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  if (!id) return null;

  const renew = async () => {
    if (!window.confirm("A new passphrase? The old one stops working.")) return;
    setState("busy");
    try {
      const response = await fetch(`/api/accounts/${id}/passphrase`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(String(response.status));
      // Shown in its field once the account is loaded again.
      window.location.reload();
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <Button
        buttonStyle="secondary"
        disabled={state === "busy"}
        margin={false}
        onClick={renew}
        type="button"
      >
        New passphrase
      </Button>
      {state === "failed" && (
        <p style={{ color: "var(--theme-error-500)", marginTop: 8 }}>
          That did not work.
        </p>
      )}
    </div>
  );
};
