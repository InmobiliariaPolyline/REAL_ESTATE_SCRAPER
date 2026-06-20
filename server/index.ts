import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Cabeceras de seguridad con Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://*"
          ],
          connectSrc: [
            "'self'",
            "https://*.supabase.co",
            "wss://*.supabase.co",
            "https://*"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://images.unsplash.com",
            "*.naventcdn.com",
            "*.urbania.pe",
            "*.adondevivir.com",
            "*.properati.com.pe",
            "*.properati.com",
            "*.infocasas.com.pe",
            "*.babilonia.pe",
            "static.babilonia.pe",
            "https://*.supabase.co"
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com"
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com"
          ],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      strictTransportSecurity: {
        maxAge: 31536000, // 1 año (HSTS Fuerte)
        includeSubDomains: true,
        preload: true,
      },
      xFrameOptions: { action: "deny" },
    })
  );

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
