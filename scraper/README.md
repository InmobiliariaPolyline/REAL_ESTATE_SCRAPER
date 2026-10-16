# Scraper

Estructura para alimentar `public.propiedades`. **Hoy no tiene ningún portal conectado**: la lista
`FUENTES` de `sources/index.ts` está vacía, así que una corrida no descarga nada (y lo dice en el log).

| Archivo | Función |
| ------- | ------- |
| `ingest.ts` | Valida y normaliza avisos (id estable, USD, URLs http/https) y los guarda con el UPSERT de `docs/INGESTA.md` (`creado_en` intacto, `ultima_vista_en` refrescada). Probado en `ingest.test.ts`. |
| `run.ts` | Ejecuta las fuentes, reintenta la conexión a Neon y guarda. Falla (exit 1) solo si **todas** las fuentes fallan. |
| `sources/index.ts` | Lista de fuentes activas. |
| `../.github/workflows/scraper.yml` | Workflow que lanza `pnpm scraper`: a mano, o con el botón «Forzar scraper» del panel. |

## Añadir un portal

1. Crea `sources/urbania.ts` exportando una `Fuente`:

   ```ts
   import type { Fuente } from "./index"

   export const urbania: Fuente = {
     nombre: "urbania",
     async obtener() {
       // descargar y devolver Aviso[] (portal, codigo, operacion, inmueble, precio, moneda, url...)
       return []
     },
   }
   ```

2. Añádela a `FUENTES` en `sources/index.ts`.
3. Respeta los términos de uso y el `robots.txt` del portal, y limita la frecuencia de las peticiones.

## Probar

```bash
pnpm test scraper     # normalización y UPSERT contra Postgres (PGlite)
pnpm scraper          # corrida real; necesita DATABASE_URL en .env
```

## Configuración en GitHub y Netlify

- Secret del repositorio `DATABASE_URL` (Settings → Secrets and variables → Actions): la cadena de Neon.
- Para el botón «Forzar scraper»: variables de Netlify `GITHUB_PAT`, `GITHUB_REPO=InmobiliariaPolyline/REAL_ESTATE_SCRAPER`
  y `GITHUB_WORKFLOW=scraper.yml`.
- Para programarlo, descomenta `schedule` en el workflow cuando haya fuentes reales.
