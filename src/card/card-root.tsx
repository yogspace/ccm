"use client";

import dynamic from "next/dynamic";
import type { CardProps } from "./card-entry";

// The card lives in the hash, which never reaches the server – so it is
// rendered in the browser only.
const CardEntry = dynamic(() => import("./card-entry"), { ssr: false });

const CardRoot = (props: CardProps) => <CardEntry {...props} />;

export default CardRoot;
