import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/server/**/*.ts", "src/shared/**/*.ts"],
      exclude: [
        "src/server/index.ts",
        "src/server/openaiClients.ts",
        "src/server/database.ts",
        "src/server/sql.ts",
        "src/server/analysis.ts",
        "src/shared/types.ts"
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      }
    }
  }
});
