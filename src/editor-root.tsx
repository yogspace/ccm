"use client";

import dynamic from "next/dynamic";
import type { EditorProps } from "./editor";
import { resolveShortShape } from "./short-shape";

// The editor lives in the browser only: canvas, WebGL, the geometry worker
// and the link in the hash – there is nothing to render on the server. A
// short link's model is fetched first: the editor reads the link as it loads.
const Editor = dynamic(
  () => resolveShortShape().then(() => import("./editor")),
  { ssr: false }
);

const EditorRoot = (props: EditorProps) => <Editor {...props} />;

export default EditorRoot;
