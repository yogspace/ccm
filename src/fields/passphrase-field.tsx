"use client";

import {
  Button,
  FieldDescription,
  FieldLabel,
  TextInput,
  toast,
  useDocumentInfo,
  useField,
} from "@payloadcms/ui";
import type { TextFieldClientComponent } from "payload";
import { type MouseEvent, useState } from "react";

/**
 * A kept account's passphrase (collections/accounts.ts), like Payload's slug
 * field: locked – set only by “Generate new”, which makes a fresh one on the
 * server (the old one stops working) – and copied with a click.
 */
export const PassphraseField: TextFieldClientComponent = ({ field, path }) => {
  const { id } = useDocumentInfo();
  const { value, setValue } = useField<string>({ path });
  const [busy, setBusy] = useState(false);

  const copy = async (event: MouseEvent) => {
    event.preventDefault();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Passphrase copied");
    } catch {
      toast.error("Could not copy – select it by hand.");
    }
  };

  const generate = async (event: MouseEvent) => {
    event.preventDefault();
    if (!id) return;
    const question = value
      ? "A new passphrase? The old one stops working."
      : "Generate a passphrase for this account?";
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/accounts/${id}/passphrase`, {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.passphrase !== "string") {
        toast.error(
          response.status === 400
            ? "Save it as kept forever first."
            : "That did not work."
        );
        return;
      }
      // Kept on the server already – the form only shows it, unchanged.
      setValue(body.passphrase, true);
      toast.success("New passphrase – the old one no longer works.");
    } finally {
      setBusy(false);
    }
  };

  return (
    // Label and description outside the input, as in the slug field: the
    // buttons sit centred in the input alone.
    <div className="field-type passphrase-field">
      <FieldLabel htmlFor={`field-${path}`} label={field.label} path={path} />
      <TextInput
        AfterInput={
          <div className="passphrase-field__actions">
            {value && (
              <Button buttonStyle="none" onClick={copy}>
                Copy
              </Button>
            )}
            <Button buttonStyle="none" disabled={busy} onClick={generate}>
              {value ? "Generate new" : "Generate"}
            </Button>
          </div>
        }
        path={path}
        readOnly
        value={value ?? ""}
      />
      <FieldDescription description={field.admin?.description} path={path} />
    </div>
  );
};
