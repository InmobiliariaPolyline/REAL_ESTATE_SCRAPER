import express from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carpeta con el build del cliente: `dist/public`.
 * - Producción (esbuild deja `dist/index.js`): `public` está junto al servidor.
 * - Desarrollo (`tsx server/index.ts`): se busca en `../dist/public`.
 */
function resolveStaticPath(): string {
  const next = path.resolve(__dirname, "public");
  return fs.existsSync(next)
    ? next
    : path.resolve(__dirname, "..", "dist", "public");
}

/** Orígenes adicionales para `connect-src` (p. ej. dominio propio de Supabase), separados por comas. */
const extraConnectSrc = (process.env.CSP_EXTRA_CONNECT_SRC ?? "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Cabeceras de seguridad (CSP restrictiva). El cliente solo habla con su propio origen
  // y con Supabase; las imágenes de los avisos vienen de CDNs de los portales (https).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          connectSrc: [
            "'self'",
            "https://*.supabase.co",
            "wss://*.supabase.co",
            ...extraConnectSrc,
          ],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          // React usa estilos en línea (atributos style).
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      strictTransportSecurity: {
        maxAge: 31536000, // 1 año
        includeSubDomains: true,
        preload: true,
      },
      xFrameOptions: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );

  const staticPath = resolveStaticPath();

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Los assets de Vite llevan hash en el nombre: se pueden cachear mucho tiempo.
  app.use(
    "/assets",
    express.static(path.join(staticPath, "assets"), {
      immutable: true,
      maxAge: "1y",
    })
  );
  app.use(express.static(staticPath, { maxAge: "1h", index: false }));

  // Enrutamiento del lado del cliente: cualquier ruta sin extensión devuelve index.html.
  // Los archivos que no existen (con extensión) responden 404 en vez de index.html.
  app.get("*", (req, res) => {
    if (path.extname(req.path)) {
      res.status(404).send("Not found");
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = Number(process.env.PORT) || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
