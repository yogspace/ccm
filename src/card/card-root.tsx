"use client";

import dynamic from "next/dynamic";
import type { Texts } from "../translations/defaults";

// The card lives in the hash, which never reaches the server – so it is
// rendered in the browser only.
const CardEntry = dynamic(() => import("./card-entry"), { ssr: false });

const CardRoot = ({ texts }: { texts: Texts }) => <CardEntry texts={texts} />;

export default CardRoot;
