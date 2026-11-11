<div align="center">

<img src="docs/assets/hero.svg" alt="REAL ESTATE SCRAPER: inteligencia inmobiliaria para Perú" width="100%" />

<br />

[![Sitio en producción](https://img.shields.io/badge/sitio-en%20producci%C3%B3n-8b5cf6?style=for-the-badge&logo=netlify&logoColor=white&labelColor=171b22)](https://realestatescrapeer.netlify.app/)
[![CI](https://img.shields.io/github/actions/workflow/status/InmobiliariaPolyline/REAL_ESTATE_SCRAPER/ci.yml?branch=main&style=for-the-badge&label=CI&labelColor=171b22)](https://github.com/InmobiliariaPolyline/REAL_ESTATE_SCRAPER/actions/workflows/ci.yml)
[![Estado de la API](https://img.shields.io/badge/API-health-4ade80?style=for-the-badge&labelColor=171b22)](https://realestatescrapeer.netlify.app/api/health)

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white&labelColor=171b22)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white&labelColor=171b22)
![Vite](https://img.shields.io/badge/Vite-7-a78bfa?style=flat-square&logo=vite&logoColor=white&labelColor=171b22)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white&labelColor=171b22)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4fd1b5?style=flat-square&logo=postgresql&logoColor=white&labelColor=171b22)
![Netlify](https://img.shields.io/badge/Netlify-Functions-00c7b7?style=flat-square&logo=netlify&logoColor=white&labelColor=171b22)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-scraper%20y%20respaldos-2088ff?style=flat-square&logo=githubactions&logoColor=white&labelColor=171b22)

</div>

## ¿Qué es?

SaaS por suscripción de **inteligencia inmobiliaria para Perú**. Reúne los avisos de **InfoCasas, Urbania, Adondevivir y
Properati** en un solo catálogo con precios normalizados a soles y dólares, y los suscriptores los consultan en un portal
con filtros, comparación, estadísticas por distrito, calculadora y vista previa con fotos. El administrador gestiona
usuarios, suscripciones, propiedades, enlaces y la carga de datos desde un panel.

**Estado actual de las fuentes de datos**

| Fuente | Cómo se carga | Costo | Notas |
| ------ | ------------- | ----- | ----- |
| **InfoCasas** | **Scraper propio** (`scraper/`), en GitHub Actions lunes y jueves o con un botón del panel | Gratis | La lectura más exacta: trae proyectos con su rango de precios y sus tipologías |
| **Urbania**, **Adondevivir**, **Properati** | **Apify** (actores de terceros), con topes de gasto | Crédito gratuito de Apify | Bloquean (403) las lecturas automáticas directas; este sistema **no** intenta esquivar bloqueos |

La ampliación del scraping se dio por cerrada: no hay planes de pago adicionales ni acuerdos con los portales. Las mejoras
siguen por funciones, interfaz y análisis. Más en [`docs/ENTREGA.md`](docs/ENTREGA.md).

<table>
  <tr>
    <td width="33%"><img src="docs/assets/card-portales.svg" alt="Cuatro portales, un catálogo" width="100%" /></td>
    <td width="33%"><img src="docs/assets/card-filtros.svg" alt="Filtros por secciones" width="100%" /></td>
    <td width="33%"><img src="docs/assets/card-detalle.svg" alt="Vista previa con tipologías de proyectos" width="100%" /></td>
  </tr>
  <tr>
    <td width="33%"><img src="docs/assets/card-carga.svg" alt="Carga de datos con topes" width="100%" /></td>
    <td width="33%"><img src="docs/assets/card-seguridad.svg" alt="Seguridad de primera" width="100%" /></td>
    <td width="33%"><img src="docs/assets/card-diseno.svg" alt="Diseño 2D claro y ordenado" width="100%" /></td>
  </tr>
</table>

**Sitio en producción:** https://realestatescrapeer.netlify.app/ · Estado de la API: https://realestatescrapeer.netlify.app/api/health

## Documentación

| Guía | Para qué sirve |
| ---- | -------------- |
| [`docs/ENTREGA.md`](docs/ENTREGA.md) | **Empieza aquí si recibes el sistema**: qué hay, qué configurar, rutina de mantenimiento y qué hacer si algo falla |
| [`docs/SCRAPER_PROPIO.md`](docs/SCRAPER_PROPIO.md) | El scraper de InfoCasas, el contrato `POST /api/ingesta`, los proyectos y cómo programarlo |
| [`docs/CARGA_APIFY.md`](docs/CARGA_APIFY.md) | Carga automática con Apify (Urbania, Adondevivir, Properati e InfoCasas): costos, topes y fallas |
| [`docs/INGESTA.md`](docs/INGESTA.md) | Modelo de datos de `propiedades` y reglas para quien escriba avisos |
| [`docs/URLS_BUSQUEDA.md`](docs/URLS_BUSQUEDA.md) | Direcciones de búsqueda de cada portal |
| [`docs/FOTOS_CLOUDINARY.md`](docs/FOTOS_CLOUDINARY.md) | Copia de portadas a Cloudinary |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | Seguridad, credenciales, respaldos y su restauración |

## Arquitectura

```
InfoCasas ─► Scraper propio (GitHub Actions) ─┐
                                              ├─► POST /api/ingesta ─► PostgreSQL (Neon) ◄─ API (api/) ◄─ Portal web (React)
Urbania · Adondevivir · Properati ─► Apify ───┘   (webhook)                  ▲                  ▲
                                                                             │                  └── Netlify Function  ó  Express
Cloudinary ◄─ copiar-portadas (cada hora) ───────────────────────────────────┤
Inmodata (ETL / BI): solo lectura ───────────────────────────────────────────┘
```

- **El navegador nunca toca la base.** Habla con la API (`/api/*`); la cadena de conexión vive solo en el servidor.
- **La API** (`api/`) es un handler Web estándar (`Request → Response`) que se publica de dos formas con el mismo código:
  Netlify Function (`netlify/functions/api.ts`) o servidor Express (`server/index.ts`). Autoriza cada petición (público /
  sesión / suscriptor vigente / admin) y usa SQL parametrizado y las funciones de `db/002_auth.sql`.
- **Un solo camino de entrada de avisos.** Tanto el scraper propio (`POST /api/ingesta`, con `INGESTA_TOKEN`) como Apify
  (webhook) pasan por `api/ingest.ts`: normaliza, corrige la ubicación y el tipo, descarta datos absurdos y hace UPSERT por
  `id` (portal + código), sin duplicar.
- **Seguridad:** contraseñas con bcrypt (pgcrypto), bloqueo tras 5 fallos en 15 min, sesión con token opaco de 12 h
  validado en el servidor en cada petición, cierre por inactividad, cuentas baneadas cortadas al instante, CSP estricta y
  URLs de avisos filtradas a http(s).

## Estructura

```
api/                    API: handler, router, auth, consultas SQL y rutas (+ pruebas de integración contra Postgres real)
  routes/               auth · portal (propiedades, facetas y enlaces) · favoritos · insights (inicio y estadísticas)
                        · admin · carga (Apify y scraper propio) · ingesta
  ingest.ts             Normalización y guardado de avisos (lo usan el scraper propio y Apify)
  carga.ts              Carga con Apify: fuentes, topes, actores y lectura de sus datos
  scraperPropio.ts      Lanzar el scraper desde el panel (GitHub Actions)
  imagenes.ts           Copia de portadas a Cloudinary
client/src/             React 19
  pages/                Login · Portal · Admin · Vencido
  components/           admin · portal · properties · filters · sistema · common · ui
  lib/ · hooks/         Utilidades, llamadas a la API, precios, filtros, preferencias
shared/                 Código común del cliente y la API: ubicación, tipos de inmueble, proyectos, filtros, validación
db/                     001 … 014: migraciones SQL idempotentes (ver la tabla de abajo) + optional/ (rol de solo lectura)
scraper/                Scraper propio de InfoCasas (Node), enviador PHP y programador de Windows
netlify/functions/      api (la API) · carga-semanal · copiar-portadas · scraper-watchdog (tareas programadas)
server/index.ts         Servidor Express opcional (API + estáticos + CSP)
scripts/migrate.mjs     Aplica db/*.sql en orden (pnpm db:migrate)
.github/workflows/      ci.yml · scraper.yml · backup.yml
docs/                   Guías (ver la tabla de documentación) y docs/assets (ilustraciones de este README)
netlify.toml            Build, rutas, función y cabeceras de seguridad
```

## Puesta en marcha

### 1. Base de datos (Neon)

1. Crea el proyecto en Neon (región AWS US East 2, solo el servicio Postgres).
2. Aplica **todas** las migraciones de `db/` en orden, con `pnpm db:migrate` (lee `DATABASE_URL` del entorno o de `.env`;
   `pnpm db:migrate --check` solo lista tablas) o pegando cada archivo en el **SQL Editor**. Son idempotentes: se pueden
   repetir sin riesgo.
3. Crea el primer administrador con el `insert` comentado al final de `db/001_schema.sql`, con tu propia contraseña.
   No lo subas al repositorio.
4. Copia la connection string (Dashboard → *Connect*). Es el valor de `DATABASE_URL`.

| Migración | Qué agrega | ¿Obligatoria? |
| --------- | ---------- | ------------- |
| `001_schema.sql` | Tablas base: propiedades, usuarios, suscripciones, enlaces, favoritos, historial y búsquedas guardadas | Sí |
| `002_auth.sql` | Autenticación y administración en la base (bcrypt, bloqueo de intentos, sesiones, Premium) | Sí |
| `003_account_ops.sql` | Cambio y restablecimiento de contraseña, alertas del watchdog | Sí |
| `004_price_history.sql` | Historial de precios (trigger) y filtros completos en búsquedas guardadas | Sí |
| `005_sessions_audit.sql` | Sesiones visibles (dispositivo, IP) y auditoría | Sí |
| `006_idle_timeout.sql` | Cierre de sesión por inactividad en el servidor | Sí |
| `007_carga.sql` | Carga con Apify: configuración (empieza pausada) e historial de corridas | Para usar Apify |
| `008_imagenes.sql` | Galería de fotos por aviso | Recomendada |
| `009_detalles.sql` | Descripción, dirección, cocheras, antigüedad, anunciante, coordenadas, mantenimiento | Recomendada |
| `010_fuentes.sql` | Topes propios de InfoCasas y Properati | Para usar Apify |
| `011_ubicacion.sql` | Departamento y provincia (filtros de ubicación) | Recomendada |
| `012_tipos.sql` | Unifica los nombres de tipo de inmueble de los avisos ya guardados | Opcional |
| `013_geografia.sql` | Corrige ubicaciones contradictorias ya guardadas (p. ej. el Callao dentro de «Lima») | Opcional (los filtros funcionan sin ella) |
| `014_proyectos.sql` | Proyectos: precio «Hasta» y lista de tipologías | Opcional (sin ella se guarda el «Desde» y los rangos) |
| `optional/inmodata_readonly.sql` | Rol de solo lectura para un ETL o herramienta de BI | Opcional |

Todo se prueba en un Postgres real (PGlite) como parte de la suite; el sistema sigue funcionando si falta una migración
recomendada u opcional (solo faltan esas funciones).

### 2. Desarrollo local

```bash
pnpm install
cp .env.example .env     # completa DATABASE_URL
pnpm dev:api             # API en http://localhost:3001
pnpm dev                 # frontend en http://localhost:3000 (reenvía /api a la API)
pnpm check               # tipos
pnpm test                # toda la suite (API contra Postgres real, scraper, filtros, precios y componentes)
pnpm build               # compilación de producción
```

Requiere Node 22 y pnpm (la versión exacta está en `package.json`).

### 3. Producción en Netlify

`netlify.toml` ya define build, función y cabeceras. En *Site settings → Environment variables*:

| Variable | Obligatoria | Uso |
| -------- | ----------- | --- |
| `DATABASE_URL` | Sí | Conexión a Neon (marcar *Contains secret values*). Solo servidor |
| `USD_TO_PEN_RATE`, `VITE_USD_TO_PEN_RATE` | No | Tipo de cambio (3.75 por defecto); deben coincidir |
| `VITE_ADMIN_WHATSAPP` | No | WhatsApp de contacto (solo dígitos) |
| `INGESTA_TOKEN` | Para el scraper propio | Clave (24 caracteres o más) con la que el scraper envía avisos a `POST /api/ingesta`. El **mismo valor** va como secreto de GitHub (ver abajo). Guía: [`docs/SCRAPER_PROPIO.md`](docs/SCRAPER_PROPIO.md) |
| `GITHUB_TOKEN`, `GITHUB_REPO` | Para el botón «Ejecutar scraper propio» | Token fino de GitHub (solo este repositorio, permiso **Actions: Read and write**) y `usuario/repositorio`. Sin ellos el botón avisa qué falta |
| `CLOUDINARY_URL` | No | `cloudinary://CLAVE:SECRETO@NOMBRE`: copia las portadas a Cloudinary. Ver [`docs/FOTOS_CLOUDINARY.md`](docs/FOTOS_CLOUDINARY.md) |
| `APIFY_TOKEN`, `APIFY_WEBHOOK_SECRET` | Para la carga con Apify | Ambas secretas. Guía: [`docs/CARGA_APIFY.md`](docs/CARGA_APIFY.md) |
| `APIFY_ACTOR`, `APIFY_ACTOR_URBANIA`, `APIFY_ACTOR_INFOCASAS`, `APIFY_ACTOR_PROPERATI`, `APIFY_ACTOR_RESPALDO` | No | Otro actor para cada fuente (`usuario~nombre`) |
| `CARGA_URLS`, `CARGA_URLS_URBANIA`, `CARGA_URLS_INFOCASAS`, `CARGA_URLS_PROPERATI` | No | Búsquedas a rotar de cada fuente (ver [`docs/URLS_BUSQUEDA.md`](docs/URLS_BUSQUEDA.md)) |
| `APIFY_CREDIT_USD`, `APIFY_COST_PER_1000` | No | Crédito mensual de Apify (5) y costo por 1 000 avisos (3), para calcular los topes |
| `ALERT_WEBHOOK_URL`, `ALERT_STALE_HOURS` | No | Alertas del watchdog: webhook (Slack, Discord o compatible) y horas sin actividad (24 por defecto) |
| `CRON_SECRET` | No | Permite a un planificador externo llamar a `POST /api/internal/watchdog` (cabecera `x-cron-secret`) |
| `VITE_API_URL` | No | Solo si la API vive en otro dominio (por defecto, el mismo origen) |

Con el servidor Express (sin Netlify) también existen `PORT` (3000 por defecto) y `CSP_EXTRA_CONNECT_SRC`. El archivo
[`.env.example`](.env.example) lista todas con su explicación.

**Secretos de GitHub Actions** (*Settings → Secrets and variables → Actions*):

| Secreto | Lo usa | Para qué |
| ------- | ------ | -------- |
| `INGESTA_TOKEN` | `scraper.yml` | El mismo valor que en Netlify: autoriza al scraper a enviar avisos |
| `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` | `backup.yml` | Respaldo diario cifrado de la base (ver [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md)) |

**Tareas programadas** (todas en hora de Lima):

| Tarea | Dónde | Cuándo | Qué hace |
| ----- | ----- | ------ | -------- |
| Scraper propio de InfoCasas | `.github/workflows/scraper.yml` | Lunes y jueves 09:00 (y a mano) | Lee InfoCasas y envía los avisos a `/api/ingesta` |
| Carga con Apify | `netlify/functions/carga-semanal.ts` | Lunes y jueves 09:00 | Pide una tanda de cada fuente de Apify, dentro de su tope (solo si está activada) |
| Copia de portadas | `netlify/functions/copiar-portadas.ts` | Cada hora, minuto 15 | Copia hasta 24 portadas a Cloudinary (solo si hay `CLOUDINARY_URL`) |
| Vigilante del scraper | `netlify/functions/scraper-watchdog.ts` | Cada 6 horas | Avisa por webhook si no entran avisos nuevos |
| Respaldo de la base | `.github/workflows/backup.yml` | Todos los días 02:30 | `pg_dump` cifrado como artefacto de GitHub |
| Verificación | `.github/workflows/ci.yml` | En cada push y pull request | Tipos, pruebas y compilación |

Tras desplegar, comprueba `https://TU-SITIO/api/health` (debe responder `{"status":"ok"}`).

Alternativa sin Netlify: `pnpm build && pnpm start` (Express en `$PORT`) con las mismas variables; las tareas programadas
de Netlify tendrían que llamarse con un planificador externo.

## Datos de los avisos

- **Un aviso** = una fila de `propiedades`, con `id` = `portal:código`. El mismo aviso siempre se actualiza, no se duplica.
- **Precios como se publicaron:** `precio` está en la moneda del aviso (`moneda`) y `precio_usd` es su normalización. La
  interfaz muestra el precio publicado y, aparte, una conversión aproximada («≈»).
- **Tipos de inmueble** unificados (Departamento, Casa, Terreno, Oficina, Local comercial, Proyecto…); se corrigen por el
  título cuando el portal los publica mal.
- **Ubicación coherente:** departamento → provincia → distrito. Un distrito de Lima o del Callao manda sobre lo que diga el
  portal (varios publican el Callao como «Lima»).
- **Proyectos** (edificios en construcción, condominios): se guardan **una vez** (`portal:proyecto-<nombre>`) con el precio
  «Desde» y «Hasta», los dormitorios y baños que ofrecen, el área como rango y la lista de tipologías.
  Detalle en [`docs/SCRAPER_PROPIO.md`](docs/SCRAPER_PROPIO.md).
- **Datos absurdos se descartan:** precios con error de tipeo, áreas imposibles y coordenadas fuera del Perú se guardan
  vacíos para no distorsionar medianas ni comparaciones.

Modelo completo y reglas para quien escriba avisos: [`docs/INGESTA.md`](docs/INGESTA.md).

## Interfaz

Sistema de diseño propio en `client/src/index.css`: interfaz **2D** clara y ordenada, con barra lateral izquierda,
tarjetas redondeadas y un acento de color **violeta** por defecto con cian de apoyo. El acento se puede cambiar
(violeta, dorado, turquesa, azul, verde, ámbar) en *Sistema → Tema y personalización*, junto con el tema claro u oscuro, el
tamaño de la interfaz y el movimiento reducido. Tipografías: Plus Jakarta Sans (interfaz) y JetBrains Mono (cifras).

Los tokens (`--surface-*`, `--gold`…, `--line`; la familia `--gold` es la variable del acento, aunque hoy sea violeta) y las
clases base (`.card`, `.btn-*`, `.field`, `.badge-*`, `.segmented`, `.table-modern`) se reutilizan en todas las pantallas.
Los iconos son de lucide (sin emojis). Piezas comunes en `client/src/components/common/`: `StatCard`, `PageHeader`,
`ConfirmModal`, `Toast`, `Avatar`, `EmptyState`, `Logo` e **`Insignia`**, la insignia partida (etiqueta oscura cuadrada a la
izquierda y valor en color a la derecha) que se usa para precios, tipo, operación y fichas. Los precios son siempre verdes.

**Tema claro/oscuro:** la preferencia se guarda en el navegador y `client/public/theme-init.js` la aplica antes del primer
pintado. Los colores del tema claro se definen en `:root.light`.

**Celular:** todas las pantallas se adaptan; las cuadrículas sin columnas definidas ocupan el ancho disponible (regla base
en `index.css`) y las tablas anchas se muestran como lista cuando falta espacio (p. ej. la Auditoría).

**Accesibilidad:** enlace «Saltar al contenido», modales con foco atrapado y devuelto al cerrar (`lib/focusTrap.ts`),
cierre con Escape, etiquetas en los botones de solo icono y errores de formulario enfocados en el campo a corregir.

**Rendimiento:** las pantallas, las pestañas del admin y los modales pesados se cargan bajo demanda; los gráficos
(recharts) solo se descargan al abrir el Dashboard o el detalle de una propiedad.

## Flujo de uso

1. **Carga de avisos:** el scraper propio (InfoCasas) y Apify (los demás) guardan los avisos con el tipo de cambio vigente.
   Cada corrida refresca `ultima_vista_en`, que usan la limpieza de inactivos y el vigilante.
2. **Administrador:** crea usuarios y activa Premium (30 días, renovable).
3. **Usuario:** con suscripción vigente entra al portal y filtra avisos; cada login queda en `historial_accesos`. Sin
   suscripción ve la pantalla «Vencido» (distingue «vencida» de «sin suscripción»).
4. **Admin cura avisos:** favoritos, historial, búsquedas guardadas y enlaces de apoyo.
5. **Inmodata** puede leer `propiedades` (ETL / BI) con un rol de solo lectura (`db/optional/inmodata_readonly.sql`).

## Reglas de negocio

- Un usuario con rol `usuario` entra al portal solo si tiene una suscripción con `fecha_vencimiento >= hoy` (fecha de Lima).
- Activar o renovar Premium suma 30 días: si ya hay una suscripción vigente se extiende desde su vencimiento y se reutiliza
  la misma fila. `fecha_limite_eliminacion` = vencimiento + 7.
- Los días restantes se cuentan por fecha de calendario en Lima; la barra lateral y el Perfil muestran el mismo número.
- La sesión se revalida contra el servidor al abrir la app y al volver a la pestaña (detecta baneos y vencimientos).
- El portal ordena de forma global y estable: avisos con precio primero (más recientes antes) y sin precio al final, también
  entre páginas. Un aviso con solo una moneda entra en los rangos de la otra moneda convertido con el tipo de cambio.
- No se puede banear a un administrador (evita bloquear el panel).

## Portal de clientes

Secciones: **Inicio**, **Catálogo**, **Estadísticas**, **Calculadora** y **Cuenta**.

- **Catálogo y filtros:** la ventana de filtros es **desglosable** (cada bloque se despliega o recoge y muestra un resumen de
  lo elegido). Las opciones de ubicación, tipo y anunciante se calculan sobre los filtros activos: si eliges un portal, solo
  se ofrece lo que ese portal tiene, con su cantidad («Solo con avisos» / «Ver todo»). La ubicación es jerárquica
  (departamento → provincia → distrito) y cada opción ofrecida con N avisos devuelve exactamente N al buscarla.
- **Tarjetas y detalle:** insignias partidas con precio, tipo, operación, estado y fichas; fotos con galería. Los
  **proyectos** muestran «Desde» y «Hasta» y, en el detalle, la tabla de tipologías.
- **Favoritos:** corazón en cada aviso y filtro «Favoritos» (por usuario).
- **Mis búsquedas:** guarda los filtros actuales con un nombre (hasta 20) y reutilízalos; el servidor valida y normaliza los
  filtros antes de guardarlos.
- **Ordenar:** relevancia, más recientes, precio de menor a mayor y de mayor a menor (por precio efectivo en la moneda
  elegida; los avisos sin precio siempre quedan al final).
- **Comparar:** hasta 3 propiedades lado a lado (precio, precio por m², área, dormitorios, baños…) con el mejor valor de cada
  fila resaltado.
- **Detalle:** precio por m² e historial de cambios de precio, que registra un trigger de la base
  (`db/004_price_history.sql`) cuando cambia `precio` o `precio_usd`, así que funciona con cualquier fuente.
- **Exportar CSV:** descarga la búsqueda actual (hasta 5000 avisos, UTF-8 con BOM para Excel y con protección contra
  inyección de fórmulas).
- **Inicio:** avisos nuevos de hoy, bajadas de precio en tus favoritos (`GET /api/inicio`), novedades de los últimos 7 días
  en cada búsqueda guardada y los últimos avisos.
- **Estadísticas:** mediana del precio por m² por distrito y operación (`GET /api/estadisticas`; mediana, no promedio, y solo
  distritos con 3 o más avisos). Pulsar un distrito abre el catálogo filtrado.
- **Calculadora:** cuota de hipoteca (amortización francesa), rentabilidad bruta y neta por alquiler, años de recuperación y
  flujo mensual. Se calcula en el navegador (`client/src/lib/finance.ts`).
- **Buscador global:** `Ctrl+K` (o `⌘K`) salta a cualquier sección o ejecuta acciones; también está en el admin.

## Panel de administración

**Dashboard** (cifras, avisos nuevos, propiedades por portal y suscripciones por vencer con un botón que abre WhatsApp con el
recordatorio ya escrito), **Propiedades** (los mismos filtros desglosables del portal, favoritos, historial, búsquedas
guardadas y limpieza de inactivos), **Enlaces** (enlaces de apoyo por propiedad), **Usuarios** (altas, Premium, baneos,
restablecer contraseña y cerrar sesiones) y **Sistema**.

## Módulo Sistema

Disponible para el administrador (pestaña **Sistema**) y, con menos secciones, para los clientes (pestaña **Cuenta**), con
un submenú lateral (`client/src/components/sistema/`):

- **Perfil:** antigüedad, accesos, sesiones activas, favoritos y el plan con un anillo de días restantes
  (`GET /api/account/profile`).
- **Seguridad:** estado de protección, cambio de contraseña, sesiones activas y buenas prácticas.
- **Tema y personalización:** tema, color de acento, tamaño de la interfaz, animaciones reducidas y luz ambiental. Se guardan
  solo en el navegador (`localStorage`, clave `prefs`).
- **Actividad y Auditoría** (solo administrador): últimos accesos y registro de acciones administrativas.
- **Carga de datos** (solo administrador): la carga con Apify (interruptor de pausa, topes por fuente, gasto real y
  corridas) y la tarjeta **Scraper propio**, que ejecuta el scraper de InfoCasas en GitHub Actions con un clic y muestra
  sus últimas ejecuciones.
- **Acerca del sistema:** versión, estado en vivo de la API y el historial de implementaciones, mejoras, correcciones y
  seguridad (`client/src/lib/changelog.ts`).

**Versión:** la fija `package.json` y se inyecta en la compilación (`build-info.ts`); una prueba verifica que coincida con la
última entrada de `changelog.ts`. **Al publicar una versión nueva, actualiza ambos.**

## Seguridad y operación

- **Mi cuenta:** cada usuario cambia su contraseña (exige la actual y cierra sus otras sesiones) y ve o cierra sus sesiones
  activas (dispositivo, IP, último uso). Los intentos fallidos comparten el bloqueo del login (5 en 15 min).
- **Restablecer contraseña:** el admin lo hace desde *Usuarios* (con generador de claves); se cierran todas las sesiones del
  usuario.
- **Auditoría:** registro de altas, baneos, Premium, restablecimientos, borrados y limpiezas, con filtros por acción y
  usuario. Es «best effort»: si falla el registro, la acción no se interrumpe.
- **Limpieza de inactivos** (*Propiedades → Limpieza de inactivos*): vista previa de cuántos avisos no vistos en 15/30/60/90
  días se eliminarían. Conserva los que tienen enlaces o favoritos y se niega a ejecutarse si no se refrescó
  `ultima_vista_en` en las últimas 72 h.
- **Alertas:** el vigilante (`scraper-watchdog`, cada 6 h) avisa por webhook cuando no hay actividad en `ALERT_STALE_HOURS`
  (una alerta cada 24 h por incidente y otra inmediata si vuelve a fallar tras recuperarse). Sin Netlify, programa una llamada
  a `POST /api/internal/watchdog` con `x-cron-secret`. El Dashboard muestra además un aviso.
- **Respaldos:** `.github/workflows/backup.yml` genera cada día un `pg_dump` cifrado. Restauración, rotación de credenciales y
  el rol de solo lectura para Inmodata están en [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

## Calidad

`pnpm test` ejecuta la suite completa en cada push (CI): la API contra un Postgres real (PGlite), el scraper con datos reales
de InfoCasas (listados y proyectos), los filtros y su coherencia con la búsqueda, los precios y los componentes de la
interfaz. Hay además una prueba que verifica que esta documentación no se desactualice (migraciones, variables de entorno,
archivos y enlaces citados).

## Aviso legal

Las fotos y los datos de los avisos pertenecen a los portales y a sus anunciantes. Los scrapers leen solo páginas públicas,
con un ritmo razonable y respetando el `robots.txt`; el sistema no esquiva bloqueos ni protecciones. Antes de comercializar
el sistema conviene revisar los términos de cada portal.
