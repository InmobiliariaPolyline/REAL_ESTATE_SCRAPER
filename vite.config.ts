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
    // Sin `manualChunks`: forzar cajones de vendor creó ciclos entre chunks (pantalla en blanco
    // en producción). La carga diferida de pantallas y modales ya reduce lo que se descarga.
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
