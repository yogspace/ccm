"use client";

import { useBlockComponentContext } from "@payloadcms/richtext-lexical/client";
import {
  $getNearestNodeFromDOMNode,
  getNearestEditorFromDOMNode,
} from "@payloadcms/richtext-lexical/lexical";
import { useEffect, useRef, useState } from "react";
import type { SiteAddress, SiteLinks } from "../site-defaults";

/**
 * The legal text's blocks in the admin's editor (legal/blocks.ts) – showing
 * what the dialog will show instead of an empty box: the address from the
 * “Site” global, the form, the linked words.
 */

type Site = { links?: Partial<SiteLinks>; address?: Partial<SiteAddress> };

let siteRequest: Promise<Site> | null = null;
/** The “Site” global, loaded once for all blocks on the page. */
const loadSite = () => {
  siteRequest ??= fetch("/api/globals/site?depth=0", {
    credentials: "include",
  })
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));
  return siteRequest;
};

const useSite = () => {
  const [site, setSite] = useState<Site | null>(null);
  useEffect(() => {
    loadSite().then(setSite);
  }, []);
  return site;
};

const hint = {
  color: "var(--theme-elevation-500)",
  fontSize: 12,
  margin: "10px 0 0",
} as const;

/** “Address”: the address as the dialog shows it, and where to change it. */
export const AddressBlockPreview = () => {
  const { BlockCollapsible } = useBlockComponentContext();
  const site = useSite();
  const address = site?.address;
  return (
    <BlockCollapsible>
      <address className="legal-preview">
        {address ? (
          <>
            {address.name}
            <br />
            {address.street}
            <br />
            {address.city}
            <br />
            {address.country}
          </>
        ) : (
          "…"
        )}
      </address>
      <p style={hint}>
        From <a href="/admin/globals/site">Site → Address</a> – the same in
        every place.
      </p>
    </BlockCollapsible>
  );
};

/** “Contact form”: a sketch of the form the dialog shows here. */
export const ContactFormBlockPreview = () => {
  const { BlockCollapsible } = useBlockComponentContext();
  return (
    <BlockCollapsible>
      <div aria-hidden className="legal-preview legal-preview-form">
        <span>Name</span>
        <span>Email</span>
        <span className="legal-preview-message">Message</span>
        <span className="legal-preview-send">Send</span>
      </div>
      <p style={hint}>
        The contact form – its texts are under{" "}
        <a href="/admin/globals/translations">Translations → contact</a>, the
        messages go to MAIL_CONTACT_RECIPIENT.
      </p>
    </BlockCollapsible>
  );
};

/**
 * The fields of the inline block a label sits in. The label component gets
 * none and is rendered outside the block's context, so it asks Lexical: the
 * nearest node to its own DOM element – and again after every edit.
 */
const useInlineFields = <T,>() => {
  const ref = useRef<HTMLSpanElement>(null);
  const [fields, setFields] = useState<Partial<T>>({});
  useEffect(() => {
    const dom = ref.current;
    const editor = dom && getNearestEditorFromDOMNode(dom);
    if (!(dom && editor)) return;
    const read = () =>
      editor.read(() => {
        const node = $getNearestNodeFromDOMNode(dom) as {
          getFields?: () => Partial<T>;
        } | null;
        setFields(node?.getFields?.() ?? {});
      });
    read();
    return editor.registerUpdateListener(read);
  }, []);
  return [ref, fields] as const;
};

/** A site link inside a sentence: the linked words, with a little arrow. */
export const SiteLinkLabel = () => {
  const [ref, { label, link }] = useInlineFields<{
    label: string;
    link: keyof SiteLinks;
  }>();
  const site = useSite();
  return (
    <span
      className="legal-preview-link"
      ref={ref}
      title={link && site?.links?.[link]}
    >
      {label || "Site link"} ↗
    </span>
  );
};

/** “Last updated”: the date fills in by itself. */
export const UpdatedLabel = () => (
  <span className="legal-preview-link" title="Filled in when the text is shown">
    📅 last saved
  </span>
);
