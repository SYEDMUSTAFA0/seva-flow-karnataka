import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/shims/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
  },
});
