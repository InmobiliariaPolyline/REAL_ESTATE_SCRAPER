import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: [
      "client/src/**/*.test.ts",
      "api/**/*.test.ts",
      "shared/**/*.test.ts",
    ],
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
