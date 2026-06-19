import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/browser-auth.ts", "src/login.ts"],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 55,
        statements: 70,
      },
    },
  },
});
