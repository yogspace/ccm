"use client";

import { FieldDescription, FieldLabel, toast, useField } from "@payloadcms/ui";
import type { TextFieldClientComponent } from "payload";

/**
 * A kept account's passphrase (collections/accounts.ts), read only: a click
 * copies it.
 */
export const PassphraseCopy: TextFieldClientComponent = ({ field, path }) => {
  const { value } = useField<string>({ path });

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Passphrase copied");
    } catch {
      toast.error("Could not copy – select it by hand.");
    }
  };

  return (
    <div className="field-type text" style={{ marginBottom: 24 }}>
      <FieldLabel label={field.label} path={path} />
      {value ? (
        <button
          onClick={copy}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: "var(--style-radius-s)",
            background: "var(--theme-elevation-50)",
            color: "var(--theme-text)",
            font: "inherit",
            fontFamily: "var(--font-mono, monospace)",
            textAlign: "left",
            cursor: "copy",
          }}
          title="Click to copy"
          type="button"
        >
          {value}
        </button>
      ) : (
        <p style={{ color: "var(--theme-elevation-500)", margin: 0 }}>
          None yet.
        </p>
      )}
      <FieldDescription description={field.admin?.description} path={path} />
    </div>
  );
};
