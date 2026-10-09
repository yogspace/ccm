"use client";

import { useFormFields } from "@payloadcms/ui";

/**
 * A short link in the admin: its address on the site, to open – the model
 * alone, no name or message (those were only in the shared link).
 */
export const ShortLinkOpen = () => {
  const code = useFormFields(([fields]) => fields.code?.value);
  if (typeof code !== "string" || !code) return null;
  const href = `/#k=${code}`;
  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <a href={href} rel="noopener" target="_blank">
        Open {href}
      </a>
    </div>
  );
};
