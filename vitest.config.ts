import path from "node:path";
import { defineConfig } from "vitest/config";
import { buildInfo } from "./build-info";

export default defineConfig({
  define: buildInfo(import.meta.dirname),
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: [
      "client/src/**/*.test.ts",
      "client/src/**/*.test.tsx",
      "api/**/*.test.ts",
      "shared/**/*.test.ts",
    ],
    environment: "node",
    // Las pruebas de componentes declaran `// @vitest-environment jsdom` en su cabecera.
    setupFiles: ["client/src/test/setup.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
