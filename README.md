# REAL ESTATE SCRAPER

SaaS por suscripción de inteligencia inmobiliaria para Perú. Un scraper recolecta avisos de
varios portales (Properati, Infocasas, Babilonia, Urbania, Adondevivir) y los guarda en
PostgreSQL; los suscriptores los consultan en un portal con filtros, y el administrador gestiona
usuarios, suscripciones, propiedades y enlaces desde un panel.

**Sitio en producción:** https://realestatescrapeer.netlify.app/ · Estado de la API: https://realestatescrapeer.netlify.app/api/health

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
db/                   001..007: esquema, auth, cuenta, historial de precios, sesiones/auditoría, inactividad y carga
netlify/functions/    Función que publica la API en Netlify
server/index.ts       Servidor Express opcional (API + estáticos + CSP)
shared/               Código compartido cliente/API (constantes, filtros, validación)
netlify.toml          Build, rutas, función y cabeceras de seguridad
```

## Puesta en marcha

### 1. Base de datos (Neon)

1. Crea el proyecto en Neon (región AWS US East 2, solo el servicio Postgres).
2. Aplica el esquema (`db/001` a `db/005`), con `pnpm db:migrate` (lee `DATABASE_URL` del entorno o de `.env`;
   `pnpm db:migrate --check` solo lista tablas) o pegando en el **SQL Editor**, en orden,
   los archivos `db/001_*.sql` a `db/007_*.sql`.
3. Crea el primer administrador con el `insert` comentado al final de `001_schema.sql`, con tu
   propia contraseña. No lo subas al repositorio.
4. Copia la connection string (Dashboard → *Connect*). Es el valor de `DATABASE_URL`.

Los scripts son idempotentes y se probaron en un Postgres real (PGlite) como parte de la suite.

### 2. Desarrollo local

```bash
pnpm install
cp .env.example .env     # completa DATABASE_URL
pnpm dev:api             # API en http://localhost:3001
pnpm dev                 # frontend en http://localhost:3000 (reenvía /api a la API)
pnpm check               # tipos
pnpm test                # API contra Postgres real, filtros, precios y componentes (jsdom)
```

### 3. Producción en Netlify

`netlify.toml` ya define build, función y cabeceras. En *Site settings → Environment variables*:

| Variable | Obligatoria | Uso |
| -------- | ----------- | --- |
| `DATABASE_URL` | Sí | Conexión a Neon (marcar *Contains secret values*). Solo servidor |
| `USD_TO_PEN_RATE`, `VITE_USD_TO_PEN_RATE` | No | Tipo de cambio (3.75 por defecto); deben coincidir |
| `VITE_ADMIN_WHATSAPP` | No | WhatsApp de contacto (solo dígitos) |
| `APIFY_TOKEN`, `APIFY_WEBHOOK_SECRET` | No | Carga automática de avisos (Adondevivir y Urbania) con Apify (ver [`docs/CARGA_APIFY.md`](docs/CARGA_APIFY.md)); ambas secretas; opcionales `APIFY_CREDIT_USD` (5), `APIFY_COST_PER_1000` (3) y `APIFY_ACTOR_RESPALDO` |
| `ALERT_WEBHOOK_URL`, `ALERT_STALE_HOURS` | No | Alertas del watchdog: webhook (Slack, Discord o compatible) y horas sin actividad (24 por defecto) |
| `CRON_SECRET` | No | Permite a un planificador externo llamar a `POST /api/internal/watchdog` (cabecera `x-cron-secret`) |

Tras desplegar, comprueba `https://TU-SITIO/api/health` (debe responder `{"status":"ok"}`).

Alternativa sin Netlify: `pnpm build && pnpm start` (Express en `$PORT`, por defecto 3000)
con las mismas variables.

## Interfaz

Sistema de diseño propio en `client/src/index.css`: superficies grafito con tarjetas redondeadas,
acento dorado de la marca y tipografías Cormorant Garamond (títulos), DM Sans (interfaz) y
JetBrains Mono (cifras). Los tokens (`--surface-*`, `--gold`, `--line`…) y las clases base
(`.card`, `.btn-*`, `.field`, `.badge-*`, `.segmented`, `.table-modern`) se reutilizan en todas las
pantallas; los iconos son de lucide (sin emojis). Componentes comunes en `components/common/`
(`StatCard`, `PageHeader`, `ConfirmModal`, `Toast`, `Avatar`, `EmptyState`, `Logo`).

**Tema claro/oscuro:** el botón de la barra lateral (admin) y de la cabecera (portal) alterna el tema;
la preferencia se guarda en el navegador y `client/public/theme-init.js` la aplica antes del primer
pintado. Los colores del tema claro se definen en `:root.light` (el dorado se oscurece para mantener
contraste de texto).

**Accesibilidad:** enlace «Saltar al contenido», modales con foco atrapado y devuelto al cerrar
(`lib/focusTrap.ts`), cierre con Escape y etiquetas en los botones de solo icono.

**Rendimiento:** las pantallas, las pestañas del admin y los modales pesados se cargan bajo demanda;
los gráficos (recharts) solo se descargan al abrir el Dashboard o el detalle de una propiedad.

**Integración continua:** `.github/workflows/ci.yml` ejecuta tipos, pruebas y build en cada push y
pull request, y una auditoría informativa de dependencias.

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

## Portal de clientes

- **Favoritos:** corazón en cada aviso y filtro "Favoritos" (por usuario).
- **Mis búsquedas:** guarda los filtros actuales con un nombre (hasta 20) y reutilízalos; el servidor
  valida y normaliza los filtros antes de guardarlos.
- **Ordenar:** relevancia, más recientes, precio de menor a mayor y de mayor a menor (por precio
  efectivo en la moneda elegida; los avisos sin precio siempre quedan al final).
- **Comparar:** hasta 3 propiedades lado a lado (precio, precio por m², área, dormitorios, baños…)
  con el mejor valor de cada fila resaltado.
- **Detalle:** precio por m² e historial de cambios de precio. El historial lo registra un trigger
  de la base (`db/004_price_history.sql`) cuando el scraper cambia `precio` o `precio_usd`, así que
  funciona sin modificar el scraper.
- **Exportar CSV:** descarga la búsqueda actual (hasta 5000 avisos, UTF-8 con BOM para Excel y con
  protección contra inyección de fórmulas).
- **Inicio:** avisos nuevos de hoy, bajadas de precio en tus favoritos (`GET /api/inicio`, usa el
  historial de precios), novedades de los últimos 7 días en cada búsqueda guardada y los últimos avisos.
- **Estadísticas:** mediana del precio por m² por distrito y operación (`GET /api/estadisticas`;
  mediana, no promedio, y solo distritos con 3 o más avisos). Pulsar un distrito abre el catálogo filtrado.
- **Calculadora:** cuota de hipoteca (amortización francesa), rentabilidad bruta y neta por alquiler,
  años de recuperación y flujo mensual. Se calcula en el navegador (`client/src/lib/finance.ts`).
- **Buscador global:** `Ctrl+K` (o `⌘K`) salta a cualquier sección o ejecuta acciones; también está en el admin.
- **Admin, Vencimientos:** el Dashboard lista las suscripciones que vencen en 7 días (o vencieron hace
  menos de 7) con un botón que abre WhatsApp con el recordatorio de renovación ya escrito.

## Módulo Sistema

Disponible para el administrador (pestaña **Sistema**) y para los clientes (pestaña **Cuenta**), con una
sub-barra lateral (`client/src/components/sistema/`):

- **Perfil:** antigüedad, accesos, sesiones activas, favoritos y el plan con un anillo de días restantes
  (`GET /api/account/profile`).
- **Seguridad:** estado de protección, cambio de contraseña, sesiones activas y buenas prácticas.
- **Tema y personalización:** tema claro u oscuro, color de acento, tamaño de la interfaz, animaciones
  reducidas y luz ambiental. Se guardan solo en el navegador (`localStorage`, clave `prefs`) y
  `client/public/theme-init.js` las aplica antes del primer pintado.
- **Actividad y Auditoría** (solo administrador): últimos accesos y registro de acciones.
- **Acerca del sistema:** versión, estado en vivo de la API y el historial de implementaciones,
  mejoras, correcciones y seguridad (`client/src/lib/changelog.ts`).

**Versión:** la fija `package.json` y se inyecta en la compilación (`build-info.ts`); una prueba verifica
que coincida con la última entrada de `changelog.ts`. Al publicar una versión nueva, actualiza ambos.

## Seguridad y operación

- **Mi cuenta:** cambiar contraseña y ver/cerrar las sesiones activas (dispositivo, IP, último uso).
- **Auditoría** (pestaña del admin): registro de altas, baneos, Premium, restablecimientos, borrados,
  limpiezas, con filtros por acción y usuario. Es "best effort": si
  falla el registro, la acción no se interrumpe.
- **Respaldos:** `.github/workflows/backup.yml` genera cada día un `pg_dump` cifrado (secrets
  `BACKUP_DATABASE_URL` y `BACKUP_PASSPHRASE`). Restauración, rotación de credenciales y el rol de
  solo lectura para Inmodata (`db/optional/inmodata_readonly.sql`) están en
  [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

## Operación

- **Mi cuenta:** cada usuario cambia su contraseña desde su perfil (barra lateral en el admin,
  nombre en la cabecera del portal). Exige la actual y cierra sus otras sesiones. Los intentos
  fallidos comparten el bloqueo del login (5 en 15 min).
- **Restablecer contraseña:** el admin lo hace desde *Usuarios* (con generador de claves);
  se cierran todas las sesiones del usuario.
- **Limpieza de inactivos** (*Propiedades → Limpieza de inactivos*): vista previa de cuántos avisos
  no vistos en 15/30/60/90 días se eliminarían. Conserva los que tienen enlaces o favoritos y se
  niega a ejecutarse si el scraper no refrescó `ultima_vista_en` en las últimas 72 h.
- **Alertas del scraper:** una función programada de Netlify (`scraper-watchdog`, cada 6 h) avisa
  por webhook cuando no hay actividad en `ALERT_STALE_HOURS` (una alerta cada 24 h por incidente
  y otra inmediata si vuelve a fallar tras recuperarse). Sin Netlify, programa una llamada a
  `POST /api/internal/watchdog` con `x-cron-secret`. El Dashboard muestra además un aviso.
- **Carga automática de avisos:** Sistema → Carga de datos (Apify, con topes de gasto e interruptor de pausa); guía en [`docs/CARGA_APIFY.md`](docs/CARGA_APIFY.md). El contrato de datos está en [`docs/INGESTA.md`](docs/INGESTA.md).
