import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // manifold-3d lädt sein WASM selbst und enthält Node-Zweige, die der
  // Dependency-Prebundler nicht anfassen soll.
  optimizeDeps: { exclude: ["manifold-3d"] },
});
