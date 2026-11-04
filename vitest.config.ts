import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // `server-only` lança fora do runtime do React Server Components.
    alias: { "server-only": new URL("./tests/support/empty.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/domain/**/*.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          exclude: ["**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts", "tests/integration/**/*.int.test.ts"],
          globalSetup: ["tests/support/global-setup.ts"],
          setupFiles: ["tests/support/setup-env.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
