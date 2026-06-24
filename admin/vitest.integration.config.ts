import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@admin": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["test/integration/**/*.test.ts"],
    exclude: [],
    testTimeout: 120_000,
    hookTimeout: 30_000,
    pool: "forks",
  },
});
