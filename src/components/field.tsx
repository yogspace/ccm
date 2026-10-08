import type { ReactNode } from "react";

type Props = { htmlFor: string; label: ReactNode; children: ReactNode };

/**
 * A labelled text field – in the card composer and the contact form. The
 * field itself comes as the child, styled with `fieldInput` (styles.ts).
 */
const Field = ({ htmlFor, label, children }: Props) => (
  <label
    className="grid gap-1.25 text-small font-bold text-ink"
    htmlFor={htmlFor}
  >
    <span className="flex justify-between">{label}</span>
    {children}
  </label>
);

export default Field;
