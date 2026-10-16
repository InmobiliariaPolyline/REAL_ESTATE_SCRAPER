# REAL ESTATE SCRAPER

SaaS por suscripción de inteligencia inmobiliaria para Perú. Un scraper recolecta avisos de
varios portales (Properati, Infocasas, Babilonia, Urbania, Adondevivir) y los guarda en
PostgreSQL; los suscriptores los consultan en un portal con filtros, y el administrador gestiona
usuarios, suscripciones, propiedades y enlaces desde un panel.

## Arquitectura

```
Portales ─► Scraper (Python, GitHub Actions) ─► PostgreSQL (Neon) ◄─ API (api/) ◄─ Portal web (React)
                 │ conexión directa (DATABASE_URL)       ▲              ▲
                 └─ SUNAT: tipo de cambio                │              └── Netlify Function  ó  Express
                                                         └── Inmodata (ETL / BI): solo lectura
```

- **El navegador nunca toca la base.** Habla con la API (`/api/*`); la cadena de conexión vive
  solo en el servidor.
- **La API** (`api/`) es un handler Web estándar (`Request → Response`) que se publica de dos
  formas con el mismo código: Netlify Function (`netlify/functions/api.ts`) o servidor Express
  (`server/index.ts`). Autoriza cada petición (público / sesión / suscriptor vigente / admin) y
  llama a SQL parametrizado y a las funciones de `db/002_auth.sql`.
- **Seguridad:** contraseñas con bcrypt (pgcrypto), bloqueo tras 5 fallos en 15 min, sesión con
  token opaco de 12 h validado en el servidor en cada petición, cuentas baneadas cortadas al
  instante, CSP estricta y URLs de avisos filtradas a http(s).

## Estructura

```
api/                  API (handler, router, auth, consultas y rutas) + pruebas de integración
  routes/             auth · portal (propiedades y enlaces) · admin
client/src            React: pages/, components/{admin,portal,properties,common,ui}, lib/, types/
db/                   001_schema.sql (tablas) y 002_auth.sql (login, sesiones, administración)
netlify/functions/    Función que publica la API en Netlify
server/index.ts       Servidor Express opcional (API + estáticos + CSP)
shared/               Código compartido cliente/API (constantes, filtros, validación)
netlify.toml          Build, rutas, función y cabeceras de seguridad
```

## Puesta en marcha

### 1. Base de datos (Neon)

1. Crea el proyecto en Neon (región AWS US East 2, solo el servicio Postgres).
2. Aplica el esquema, con `pnpm db:migrate` (lee `DATABASE_URL` del entorno o de `.env`;
   `pnpm db:migrate --check` solo lista tablas) o pegando en el **SQL Editor**, en orden,
   `db/001_schema.sql` y `db/002_auth.sql`.
3. Crea el primer administrador con el `insert` comentado al final de `001_schema.sql`, con tu
   propia contraseña. No lo subas al repositorio.
3. Copia la connection string (Dashboard → *Connect*). Es el valor de `DATABASE_URL`.

Los scripts son idempotentes y se probaron en un Postgres real (PGlite) como parte de la suite.

### 2. Desarrollo local

```bash
pnpm install
cp .env.example .env     # completa DATABASE_URL
pnpm dev:api             # API en http://localhost:3001
pnpm dev                 # frontend en http://localhost:3000 (reenvía /api a la API)
pnpm check               # tipos
pnpm test                # 50 pruebas (API contra Postgres real, filtros, fechas, precios…)
```

### 3. Producción en Netlify

`netlify.toml` ya define build, función y cabeceras. En *Site settings → Environment variables*:

| Variable | Obligatoria | Uso |
| -------- | ----------- | --- |
| `DATABASE_URL` | Sí | Conexión a Neon (marcar *Contains secret values*). Solo servidor |
| `USD_TO_PEN_RATE`, `VITE_USD_TO_PEN_RATE` | No | Tipo de cambio (3.75 por defecto); deben coincidir |
| `VITE_ADMIN_WHATSAPP` | No | WhatsApp de contacto (solo dígitos) |
| `GITHUB_PAT`, `GITHUB_REPO`, `GITHUB_WORKFLOW`, `GITHUB_REF` | No | Botón "Forzar scraper" (el workflow necesita `workflow_dispatch`) |

Tras desplegar, comprueba `https://TU-SITIO/api/health` (debe responder `{"status":"ok"}`).

Alternativa sin Netlify: `pnpm build && pnpm start` (Express en `$PORT`, por defecto 3000)
con las mismas variables.

## Flujo de uso

1. **Scraper** (repositorio aparte): hace UPSERT masivo en `propiedades` por `id` y guarda el
   precio original + `precio_usd` (tipo de cambio SUNAT). Debe refrescar `ultima_vista_en` en
   cada corrida. Se conecta con la connection string de Neon (rol propietario).
2. **Administrador**: crea usuarios y activa Premium (30 días, renovable).
3. **Usuario**: con suscripción vigente entra al portal y filtra avisos; cada login queda en
   `historial_accesos`. Sin suscripción ve la pantalla "Vencido" (distingue "vencida" de "sin
   suscripción").
4. **Admin cura avisos**: favoritos, historial, búsquedas guardadas y enlaces de apoyo.
5. **Inmodata** lee `propiedades` (ETL / BI) con un rol de solo lectura, por ejemplo:

   ```sql
   create role inmodata_ro login password 'CAMBIAR';
   grant select on public.propiedades to inmodata_ro;
   ```

Notas para el scraper: usar siempre la misma forma de `id` (clave del UPSERT), `portal` en
minúsculas y `moneda` como `PEN` o `USD`.

## Reglas de negocio

- Un usuario con rol `usuario` entra al portal solo si tiene una suscripción con
  `fecha_vencimiento >= hoy` (fecha de Lima).
- Activar o renovar Premium suma 30 días: si ya hay una suscripción vigente se extiende desde
  su vencimiento y se reutiliza la misma fila. `fecha_limite_eliminacion` = vencimiento + 7.
- La sesión se revalida contra el servidor al abrir la app y al volver a la pestaña (detecta
  baneos y vencimientos).
- El portal ordena de forma global y estable: avisos con precio primero (más recientes antes) y
  sin precio al final, también entre páginas. Un aviso con solo una moneda entra en los
  rangos de la otra moneda convertido con el tipo de cambio.
- No se puede banear a un administrador (evita bloquear el panel).

## Pendiente de definir

- **"Ejecutar Limpieza de Inactivos"**: `propiedades.ultima_vista_en` permite definirla (p. ej.
  borrar avisos no vistos en N días), pero solo es seguro cuando el scraper actualiza esa columna
  en cada corrida. Mientras tanto la API responde 501 y el botón lo indica.
