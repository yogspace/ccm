import { FlaskConical } from "lucide-react";
import { useSnapshot } from "valtio";
import { defaultParams } from "../geometry/cutter";
import { store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import { cookieInButton } from "./styles";

/** Five decimals: about 1/100 mm at 200 mm – and far smaller files. */
const round = (value: number) => Math.round(value * 1e5) / 1e5;

const save = async () => {
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
  const response = await fetch("/next/fixture", {
    method: "POST",
    body: JSON.stringify({ name, ...params, rings }),
  });
  window.alert(
    response.ok
      ? `Saved as test/fixtures/${await response.text()}.json`
      : "Could not save the test case."
  );
};

/**
 * Dev server only (editor.tsx): a button in the corner, beside Next's own,
 * that saves the drawing on screen as a geometry test case – contours and
 * every dimension that differs from the defaults – in
 * test/fixtures/<name>.json. `pnpm test` then checks it like the others.
 */
const DevFixture = () => {
  const { rings } = useSnapshot(store);
  return (
    <Button
      className="fixed bottom-4 left-16 z-50 bg-neon text-on-neon shadow-[0_0.5rem_1.2rem_rgb(4_8_60/0.35)] hover:enabled:bg-[color-mix(in_oklab,var(--color-neon)_86%,#000)]"
      disabled={rings.length === 0}
      onClick={save}
      title="Save the drawing as a geometry test case (test/fixtures/)"
      type="button"
    >
      <CookieIcon
        className={cookieInButton}
        icon={FlaskConical}
        roll={-10}
        size={48}
      />
      Test case
    </Button>
  );
};

export default DevFixture;
