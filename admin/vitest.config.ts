import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    env: {
      CF_ACCOUNT_ID: "test-account",
      ADMIN_TOKEN: "test-token",
      CF_API_TOKEN: "test-cf-token",
      PROVIDER_SLUG: "test-slug",
      DASHSCOPE_API_KEY: "sk-test",
    },
  },
});
