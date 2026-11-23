"use client";

import {
  Button,
  useConfig,
  useDocumentInfo,
  useFormFields,
} from "@payloadcms/ui";
import { useState } from "react";

/**
 * A short link's picture, drawn on the server (collections/short-links.ts
 * `/:id/preview`, export/server-preview.ts): “Create preview” without one,
 * “Render preview again” to replace it – the old one goes. Reloads the
 * document to show it.
 */
export const ShortLinkPreviewButton = () => {
  const { id } = useDocumentInfo();
  const preview = useFormFields(([fields]) => fields.preview?.value);
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const [state, setState] = useState<"idle" | "busy" | string>("idle");

  if (!id) return null;
  const again = Boolean(preview);

  const create = async () => {
    setState("busy");
    try {
      const response = await fetch(`${api}/short-links/${id}/preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: again }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? response.statusText);
      // The form keeps its first state – a reload shows the picture.
      window.location.reload();
    } catch (error) {
      setState(error instanceof Error ? error.message : "Failed");
    }
  };

  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <Button
        buttonStyle="secondary"
        disabled={state === "busy"}
        margin={false}
        onClick={create}
        size="small"
      >
        {state === "busy"
          ? "Drawing preview…"
          : again
            ? "Render preview again"
            : "Create preview"}
      </Button>
      {state !== "idle" && state !== "busy" && (
        <p style={{ color: "var(--theme-error-500)", marginTop: 8 }}>{state}</p>
      )}
    </div>
  );
};
