"use client";

import { useFormFields } from "@payloadcms/ui";
import type {
  DefaultCellComponentProps,
  UIFieldClientComponent,
} from "payload";
import { DAY_MS, EMPTY_DAYS, endOf, IDLE_DAYS } from "../account/rules";

type Status = "green" | "yellow" | "red";

/** Red within a week, yellow within a month, else green – kept: green. */
const COLORS: Record<Status, string> = {
  green: "#0ca30c",
  yellow: "#fab219",
  red: "#d03b3b",
};

type Row = { lastSeenAt?: unknown; keep?: unknown; cookies?: unknown };

/** When an account goes, how many days that is and how it stands. */
const endState = ({ lastSeenAt, keep, cookies }: Row) => {
  if (typeof lastSeenAt !== "string") return null;
  const end = endOf({
    lastSeenAt,
    keep: Boolean(keep),
    cookies: typeof cookies === "number" ? cookies : 0,
  });
  if (!end) return { end, days: null, status: "green" as Status };
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS));
  const status: Status = days < 7 ? "red" : days < 30 ? "yellow" : "green";
  return { end, days, status };
};

const inDays = (days: number) =>
  days === 0 ? "today" : days === 1 ? "in 1 day" : `in ${days} days`;

const Dot = ({ status }: { status: Status }) => (
  <i
    aria-hidden
    style={{
      flex: "none",
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: COLORS[status],
    }}
  />
);

const Line = ({ status, children }: { status: Status; children: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <Dot status={status} />
    {children}
  </span>
);

/** In the list: when it goes, at a glance – kept forever: never. */
export const AccountEndCell = ({ rowData }: DefaultCellComponentProps) => {
  const state = endState(rowData);
  if (!state) return null;
  return (
    <Line status={state.status}>
      {state.days === null ? "never" : inDays(state.days)}
    </Line>
  );
};

/** On the account: when it goes, the date, and why then. */
export const AccountEndField: UIFieldClientComponent = () => {
  const lastSeenAt = useFormFields(([fields]) => fields.lastSeenAt?.value);
  const keep = useFormFields(([fields]) => fields.keep?.value);
  const cookies = useFormFields(([fields]) => fields.cookies?.value);
  const state = endState({ lastSeenAt, keep, cookies });
  if (!state) return null;
  const online = typeof cookies === "number" && cookies > 0;
  const date =
    state.end &&
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      state.end
    );
  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <span className="field-label">Deleted</span>
      <p style={{ margin: "4px 0 6px", fontWeight: 600 }}>
        <Line status={state.status}>
          {state.days === null
            ? "Never – kept forever"
            : `${inDays(state.days)} – on ${date}`}
        </Line>
      </p>
      <p className="field-description" style={{ margin: 0 }}>
        {state.days === null
          ? "Not deleted automatically while kept."
          : online
            ? `${IDLE_DAYS} days after the last visit. Every visit and login starts it afresh.`
            : `${EMPTY_DAYS} days after the last visit – nothing online (with: ${IDLE_DAYS}). Every visit and login starts it afresh.`}
      </p>
    </div>
  );
};
