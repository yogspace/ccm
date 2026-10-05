import type { IncomingMessage, ServerResponse } from "node:http";

export type Stats = {
  /** Beantwortet die Zähler-Routen; `false`, wenn die Anfrage nicht dazugehört. */
  handle: (request: IncomingMessage, response: ServerResponse) => boolean;
  /** Schreibt einen noch ausstehenden Stand sofort. */
  flush: () => void;
};

export function createStats(dataDir: string): Stats;
