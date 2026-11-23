"use client";

import {
  Button,
  useConfig,
  useDocumentInfo,
  useFormFields,
} from "@payloadcms/ui";
import { useState } from "react";

/**
 * A short link without a picture: “Create preview” draws it on the server
 * (collections/short-links.ts `/:id/preview`, export/server-preview.ts) and
 * reloads the document to show it. Hidden once it has one.
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

  if (!id || preview) return null;

  const create = async () => {
    setState("busy");
    try {
      const response = await fetch(`${api}/short-links/${id}/preview`, {
        method: "POST",
        credentials: "include",
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
        {state === "busy" ? "Drawing preview…" : "Create preview"}
      </Button>
      {state !== "idle" && state !== "busy" && (
        <p style={{ color: "var(--theme-error-500)", marginTop: 8 }}>{state}</p>
      )}
    </div>
  );
};
