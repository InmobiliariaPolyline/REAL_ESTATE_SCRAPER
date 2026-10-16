import express, { type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import { createNeonDb, type Db } from "../api/db";
import type { ApiEnv } from "../api/env";
import { createApiHandler } from "../api/handler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga `.env` en desarrollo (Node >= 20.12). En producción las variables vienen del hosting.
try {
  process.loadEnvFile();
} catch {
  /* sin archivo .env: se usan las variables del entorno */
}

/** `--api-only`: solo la API (desarrollo; Vite sirve el frontend y reenvía /api a este puerto). */
const API_ONLY = process.argv.includes("--api-only");

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

/** Orígenes adicionales para `connect-src` (p. ej. API en otro dominio), separados por comas. */
const extraConnectSrc = (process.env.CSP_EXTRA_CONNECT_SRC ?? "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

let db: Db | null = null;
const getDb = (): Db => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está configurada");
  return (db ??= createNeonDb(url));
};

const apiHandler = createApiHandler(getDb, process.env as ApiEnv);

const MAX_BODY_BYTES = 1024 * 1024;

/** Adapta una petición de Express al `Request` estándar que espera el handler de la API. */
async function toWebRequest(req: ExpressRequest): Promise<Request> {
  const url = `http://${req.headers.host ?? "localhost"}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }

  let body: Buffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY_BYTES) throw new Error("body_too_large");
      chunks.push(chunk as Buffer);
    }
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method: req.method, headers, body });
}

async function sendWebResponse(res: ExpressResponse, response: Response) {
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(Buffer.from(await response.arrayBuffer()));
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Cabeceras de seguridad (CSP restrictiva). El cliente solo habla con su propio origen
  // (la API); las imágenes de los avisos vienen de CDNs de los portales (https).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", ...extraConnectSrc],
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

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // API (misma lógica que la Netlify Function).
  app.all("/api/*", async (req, res) => {
    try {
      await sendWebResponse(res, await apiHandler(await toWebRequest(req)));
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === "body_too_large";
      res
        .status(tooLarge ? 413 : 500)
        .json({ error: tooLarge ? "too_large" : "internal" });
    }
  });

  if (!API_ONLY) {
    const staticPath = resolveStaticPath();

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
  }

  const port = Number(process.env.PORT) || (API_ONLY ? 3001 : 3000);

  server.listen(port, () => {
    console.log(
      `${API_ONLY ? "API" : "Server"} running on http://localhost:${port}/`
    );
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
