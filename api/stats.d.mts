import type { IncomingMessage, ServerResponse } from "node:http";

export type Stats = {
  /** Answers the counter routes; `false` if the request is not one of them. */
  handle: (request: IncomingMessage, response: ServerResponse) => boolean;
  /** Writes a pending count right away. */
  flush: () => void;
};

export function createStats(dataDir: string): Stats;
