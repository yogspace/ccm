"use client";

import dynamic from "next/dynamic";
import { resolveShortShape } from "../short-shape";
import type { CardProps } from "./card-entry";

// The card lives in the hash, which never reaches the server – so it is
// rendered in the browser only. A short link's model is fetched first: the
// card reads its link as it loads.
const CardEntry = dynamic(
  () => resolveShortShape().then(() => import("./card-entry")),
  { ssr: false }
);

const CardRoot = (props: CardProps) => <CardEntry {...props} />;

export default CardRoot;
