"use client";

import dynamic from "next/dynamic";
import type { EditorProps } from "./editor";

// The editor lives in the browser only: canvas, WebGL, the geometry worker
// and the link in the hash – there is nothing to render on the server.
const Editor = dynamic(() => import("./editor"), { ssr: false });

const EditorRoot = (props: EditorProps) => <Editor {...props} />;

export default EditorRoot;
