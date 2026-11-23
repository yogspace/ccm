"use client";

import { useFormFields } from "@payloadcms/ui";
import type { DefaultCellComponentProps } from "payload";

/** A short link's address on the site – a kit's with its name and size. */
const hrefOf = (code: unknown, link: unknown) =>
  typeof code !== "string" || !code
    ? null
    : typeof link === "string" && link
      ? `/${link}`
      : `/#k=${code}`;

/**
 * A short link in the admin: its address on the site, to open – a kit's
 * with its name and size, a visitor's the model alone (name and message
 * were only in the shared link).
 */
export const ShortLinkOpen = () => {
  const code = useFormFields(([fields]) => fields.code?.value);
  const link = useFormFields(([fields]) => fields.link?.value);
  const href = hrefOf(code, link);
  if (!href) return null;
  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <a href={href} rel="noopener" target="_blank">
        Open {href}
      </a>
    </div>
  );
};

/**
 * The same in the list: a link to open the creation in a new tab, without
 * opening the short link's page first. The click stays on the link – the
 * row would open the document otherwise.
 */
export const ShortLinkOpenCell = ({ rowData }: DefaultCellComponentProps) => {
  const href = hrefOf(rowData?.code, rowData?.link);
  if (!href) return null;
  return (
    <a
      href={href}
      onClick={(event) => event.stopPropagation()}
      rel="noopener"
      target="_blank"
    >
      Open ↗
    </a>
  );
};
