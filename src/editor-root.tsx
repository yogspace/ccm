"use client";

import Editor, { type EditorProps } from "./editor";

/**
 * The editor as the page renders it – on the server too: the frame, the
 * tools, the sliders are there with the first paint. What only the browser
 * knows (the link in the hash, the jar, WebGL, the geometry worker) comes
 * once it has taken over (editor.tsx).
 */
const EditorRoot = (props: EditorProps) => <Editor {...props} />;

export default EditorRoot;
