import { FILAMENTS } from "../filaments";

/**
 * A short link's picture, drawn by the browser that just put a cookie online
 * (account/client.ts) and sent to next/account/links/preview – the server
 * has no 3D. Before, a visitor's short link got its picture only when the
 * admin opened it.
 *
 * In the background and when the page is idle: the cutter is built once
 * more from the link, painted, sent. The drawing code loads only now, never
 * with the page. It may fail quietly – the admin can still draw it (Seeds).
 */

/** The kits' usual color – as the admin draws pictures without a kit. */
const COLOR = FILAMENTS[1];

const idle = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 4000 });
    } else {
      setTimeout(resolve, 1500);
    }
  });

export const drawPreview = async (hash: string, code: string) => {
  try {
    await idle();
    const [{ readHash }, { loadCutter }, { shortLinkPreview }] =
      await Promise.all([
        import("../url-state"),
        import("../card/load-cutter"),
        import("../export/makerworld"),
      ]);
    const built = await loadCutter(readHash(hash));
    const picture = built ? await shortLinkPreview(built.mesh, COLOR) : null;
    if (!picture) return;
    const form = new FormData();
    form.append("code", code);
    form.append("file", picture, `cookie-${code}.png`);
    await fetch("/next/account/links/preview", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
  } catch {
    // The admin can still draw it – the page goes on.
  }
};
