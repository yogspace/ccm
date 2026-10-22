"use client";

import { useFormFields } from "@payloadcms/ui";

/**
 * A short link in the admin: its address on the site, to open – a kit's
 * with its name and size, a visitor's the model alone (name and message
 * were only in the shared link).
 */
export const ShortLinkOpen = () => {
  const code = useFormFields(([fields]) => fields.code?.value);
  const link = useFormFields(([fields]) => fields.link?.value);
  if (typeof code !== "string" || !code) return null;
  const href = typeof link === "string" && link ? `/${link}` : `/#k=${code}`;
  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <a href={href} rel="noopener" target="_blank">
        Open {href}
      </a>
    </div>
  );
};
