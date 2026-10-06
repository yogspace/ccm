import { defaultParams } from "./geometry/cutter";
import { store } from "./store";

/** Five decimals: about 1/100 mm at 200 mm – and far smaller files. */
const round = (value: number) => Math.round(value * 1e5) / 1e5;

/**
 * Dev server only: Alt+Shift+F saves the drawing on screen as a geometry test
 * case – contours and every dimension that differs from the defaults – in
 * test/fixtures/<name>.json. `pnpm test` then checks it like the others.
 */
export const listenForFixtures = () => {
  window.addEventListener("keydown", async (event) => {
    if (!(event.altKey && event.shiftKey && event.code === "KeyF")) return;
    event.preventDefault();
    const name = window.prompt("Save the drawing as a test case – name:");
    if (!name) return;
    const params = Object.fromEntries(
      Object.entries(store.params).filter(
        ([key, value]) =>
          defaultParams[key as keyof typeof defaultParams] !== value
      )
    );
    const rings = store.rings.map((ring) =>
      ring.map(([x, y]) => [round(x), round(y)])
    );
    const response = await fetch("/__fixture", {
      method: "POST",
      body: JSON.stringify({ name, ...params, rings }),
    });
    window.alert(
      response.ok
        ? `Saved as test/fixtures/${await response.text()}.json`
        : "Could not save the test case."
    );
  });
};
