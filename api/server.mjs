// Mini API of the Cookie Cutter Maker in the `ccm-api` container (see
// docker-compose.yml). Deliberately without dependencies: `node api/server.mjs`.
// The logic lives in stats.mjs; in the dev server vite.config.ts mounts it.

import { createServer } from "node:http";
import { createStats } from "./stats.mjs";

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR =
  process.env.DATA_DIR ?? new URL("./.data/", import.meta.url).pathname;

const stats = createStats(DATA_DIR);

const server = createServer((request, response) => {
  if (stats.handle(request, response)) return;
  response.writeHead(404, { "Content-Type": "application/json" });
  response.end('{"error":"not found"}');
});

const shutdown = () => {
  stats.flush();
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, () => {
  console.info(`ccm-api auf :${PORT}, Daten in ${DATA_DIR}`);
});
