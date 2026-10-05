// Zähler „x Kreationen erstellt“: Logik für den API-Container (server.mjs) und
// den Vite-Dev-Server (vite.config.ts). Gespeichert wird nur eine Zahl in
// <dataDir>/stats.json, nichts über die Besucher.
//
//   GET  /api/stats            → { "creations": 1234 }
//   POST /api/stats/creation   → zählt eins hoch, liefert die neue Summe

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gegen Hochzählen per Skript: so viele Kreationen je IP und Stunde. */
const LIMIT_PER_HOUR = 30;

export const createStats = (dataDir) => {
  const file = join(dataDir, "stats.json");
  mkdirSync(dataDir, { recursive: true });

  let stats = { creations: 0 };
  try {
    stats = { ...stats, ...JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    // Erster Start oder kaputte Datei: bei 0 anfangen.
  }

  // Schreiben gebündelt und atomar (erst temporär, dann umbenennen).
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

  // IP-Adressen nur kurz im Arbeitsspeicher, stündlich vergessen.
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

  /** Beantwortet die Zähler-Routen; `false`, wenn die Anfrage nicht dazugehört. */
  const handle = (request, response) => {
    const path = (request.url ?? "").split("?")[0];
    if (path === "/api/stats" && request.method === "GET") {
      send(response, stats);
      return true;
    }
    if (path === "/api/stats/creation" && request.method === "POST") {
      // Den Body braucht es nicht – trotzdem lesen, damit die Verbindung sauber endet.
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
