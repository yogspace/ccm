import { defineConfig } from "vitest/config";

// Geometry tests in Node – without the app's Vite plugins.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
