import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@admin": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["test/integration/**"],
    env: {
      CF_ACCOUNT_ID: "test-account",
      ADMIN_TOKEN: "test-token",
      CF_API_TOKEN: "test-cf-token",
      DASHSCOPE_API_KEY: "sk-test",
    },
  },
});
