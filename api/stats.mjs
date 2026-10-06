// The “x creations made” counter: logic for the API container (server.mjs) and
// the Vite dev server (vite.config.ts). Only a number is stored, in
// <dataDir>/stats.json – nothing about the visitors.
//
//   GET  /api/stats            → { "creations": 1234 }
//   POST /api/stats/creation   → counts one up, returns the new total

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Against counting up by script: this many creations per IP and hour. */
const LIMIT_PER_HOUR = 30;

export const createStats = (dataDir) => {
  const file = join(dataDir, "stats.json");
  mkdirSync(dataDir, { recursive: true });

  let stats = { creations: 0 };
  try {
    stats = { ...stats, ...JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    // First start or a broken file: start at 0.
  }

  // Writes are batched and atomic (first to a temp file, then renamed).
  let pending = false;
  const flush = () => {
    if (!pending) return;
    pending = false;
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, JSON.stringify(stats));
    renameSync(temporary, file);
  };
  const scheduleSave = () => {
    if (pending) return;
    pending = true;
    setTimeout(flush, 1000).unref();
  };

  // IP addresses only briefly in memory, forgotten every hour.
  let recent = new Map();
  setInterval(() => {
    recent = new Map();
  }, 3_600_000).unref();

  const clientIp = (request) =>
    String(request.headers["x-forwarded-for"] ?? "")
      .split(",")[0]
      .trim() || request.socket.remoteAddress;

  const send = (response, body) => {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(body));
  };

  /** Answers the counter routes; `false` if the request is not one of them. */
  const handle = (request, response) => {
    const path = (request.url ?? "").split("?")[0];
    if (path === "/api/stats" && request.method === "GET") {
      send(response, stats);
      return true;
    }
    if (path === "/api/stats/creation" && request.method === "POST") {
      // The body is not needed – read it anyway so the connection ends cleanly.
      request.resume();
      const ip = clientIp(request);
      const count = recent.get(ip) ?? 0;
      if (count < LIMIT_PER_HOUR) {
        recent.set(ip, count + 1);
        stats.creations += 1;
        scheduleSave();
      }
      send(response, stats);
      return true;
    }
    return false;
  };

  return { handle, flush };
};
