import { PreviewRenderer } from "./preview-renderer";

/**
 * Where the server's headless browser draws a short link's picture
 * (export/server-preview.ts) – the drawing needs WebGL, the server alone has
 * none. Holds no data: the creation is handed in by the browser's script, so
 * anyone opening it sees an empty page.
 */
const PreviewPage = () => <PreviewRenderer />;

export default PreviewPage;
