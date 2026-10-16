import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Coincidencia por carpeta del paquete: `includes("react")` atrapaba también
          // react-hook-form, @radix-ui/react-*, etc. y hacía un chunk gigante.
          if (/[\\/]node_modules[\\/](\.pnpm[\\/][^\\/]*[\\/]node_modules[\\/])?(react|react-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) {
            return "vendor-charts";
          }
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) {
            return "vendor-ui";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 3000,
    // En desarrollo, /api se reenvía al servidor Express (`pnpm dev:api`).
    proxy: { "/api": "http://localhost:3001" },
    strictPort: false, // Busca el siguiente puerto libre si el 3000 está ocupado
    host: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
