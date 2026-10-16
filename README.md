# REAL ESTATE SCRAPER

SaaS por suscripción de inteligencia inmobiliaria para Perú. Un scraper recolecta avisos de
varios portales (Properati, Infocasas, Babilonia, Urbania, Adondevivir) y los guarda en
Supabase; los suscriptores los consultan en un portal con filtros, y el administrador gestiona
usuarios, suscripciones, propiedades y enlaces desde un panel.

## Stack

- **Cliente:** React 19 + Vite 7 + Tailwind 4 + shadcn/Radix.
- **Servidor:** Express mínimo que sirve el build con cabeceras de seguridad (Helmet, CSP).
- **Datos:** Supabase (Postgres + RLS + RPC + Edge Functions).

## Estructura

```
client/src
├── components/
│   ├── admin/        Panel de administración (Dashboard, Usuarios, Propiedades, Enlaces, Scraper)
│   │   └── propiedades/  Hook, filtros y modales de la pestaña Propiedades
│   ├── portal/       Cabecera y filtros del portal de clientes
│   ├── properties/   Tarjeta, tabla, paginación y enlaces de una propiedad
│   ├── common/       ConfirmModal, Toast, ErrorBoundary, loaders
│   └── ui/           Componentes shadcn
├── contexts/         Toast y tema
├── hooks/            Hooks genéricos
├── lib/              Lógica sin UI: config, auth, sesión, suscripciones, consultas, fechas, precios…
├── pages/            Login, Portal, Admin, Vencido
└── types/            Tipos compartidos
server/index.ts       Servidor Express opcional (estáticos + CSP)
netlify.toml          Despliegue del frontend en Netlify
supabase/
├── migrations/       Esquema base, auth segura, RPC y RLS
└── functions/        Edge Function `trigger-scraper`
```

## Puesta en marcha

```bash
pnpm install
cp .env.example .env     # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
pnpm dev                 # desarrollo
pnpm check               # tipos
pnpm test                # pruebas unitarias
pnpm build && pnpm start # producción (Express en el puerto 3000 o $PORT)
```

Variables (ver `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_ADMIN_WHATSAPP`, `VITE_USD_TO_PEN_RATE`, y para el servidor `PORT` y
`CSP_EXTRA_CONNECT_SRC`.

## Ecosistema y flujo de uso

```
Portales ─► Scraper (Python, GitHub Actions) ─► PostgreSQL (Supabase) ─► Portal web (React, Netlify)
                 │ conexión directa/pooler            ▲       └─► Panel admin
                 └─ SUNAT: tipo de cambio             └────────── Inmodata (ETL / BI): solo lectura
```

1. **Scraper** (repositorio aparte): hace UPSERT masivo en `propiedades` por `id`, guarda precio
   original + `precio_usd` (tipo de cambio SUNAT) y refresca `ultima_vista_en` en cada corrida.
   Se conecta a Postgres con el rol `postgres`/`service_role`, que **omite RLS**.
2. **Administrador**: crea usuarios y activa Premium (30 días, renovable).
3. **Usuario**: con suscripción vigente entra al portal y filtra avisos; cada login queda en
   `historial_accesos`. Sin suscripción ve la pantalla "Vencido".
4. **Admin cura avisos**: favoritos, historial, búsquedas guardadas y enlaces de apoyo.
5. **Inmodata** lee `propiedades` (idealmente con un rol de solo lectura) para limpieza y BI.

## Base de datos desde cero

Ejecutar en el SQL Editor de Supabase (o `supabase db push`), **en este orden**:

1. `supabase/migrations/20251231000000_base_schema.sql` — tablas, índices y claves.
2. `supabase/migrations/20260101000000_secure_auth.sql` — RPC de login, tokens de sesión y RLS.
3. Crear el primer admin (instrucciones al final del primer archivo).

Ambos scripts se validaron en un Postgres real (PGlite) con 22 comprobaciones: hash de
contraseñas, bloqueo por intentos, RLS por rol/suscripción, renovación de Premium y baneo.

Notas para el scraper: usar la misma forma de `id` en cada corrida (clave del UPSERT), guardar
`portal` en minúsculas y `moneda` como `PEN` o `USD`. Supabase pausa los proyectos gratuitos
tras 7 días sin actividad: mantener el keep-alive programado.

## Despliegue en Netlify

`netlify.toml` define build (`pnpm exec vite build`), carpeta publicada (`dist/public`),
fallback de SPA y cabeceras de seguridad (CSP). Configura `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` en las variables de entorno del sitio. El servidor Express
(`server/index.ts`) es opcional y solo se necesita si no usas Netlify.

## Seguridad: cómo activar la autenticación segura

La aplicación funciona de dos maneras:

| Modo | Cuándo | Qué implica |
| ---- | ------ | ----------- |
| **Seguro** | La migración `supabase/migrations/20260101000000_secure_auth.sql` está aplicada | Contraseñas con bcrypt, login por RPC con bloqueo tras 5 fallos en 15 min, tokens de sesión en servidor y RLS en todas las tablas |
| **Legado** | La migración aún no existe | Comportamiento anterior (contraseñas en texto plano, sin RLS). La consola avisa con `[seguridad]` |

Orden recomendado:

1. Despliega esta versión del cliente (sigue funcionando en modo legado).
2. Aplica la migración en el SQL Editor de Supabase (o `supabase db push`). Convierte las
   contraseñas existentes a bcrypt y activa RLS.
3. Verifica que ya no aparece el aviso `[seguridad]` en la consola del navegador.
4. El scraper debe escribir en `propiedades` con la **service_role key** (omite RLS).
5. Despliega la Edge Function que dispara el scraper y define sus secrets:

   ```bash
   supabase functions deploy trigger-scraper
   supabase secrets set GITHUB_PAT=... GITHUB_REPO=owner/repo GITHUB_WORKFLOW=scraper.yml
   ```

   La función solo responde a administradores con sesión válida.

> La función `limpiar_inactivos` que usa el botón "Ejecutar Limpieza de Inactivos" no está
> incluida: `propiedades.ultima_vista_en` permite definirla (p. ej. borrar avisos no vistos en
> N días), pero solo es seguro una vez que el scraper actualice esa columna en cada corrida.
> Mientras no exista, el botón informa que no está configurada.

## Reglas de negocio relevantes

- Un usuario con rol `usuario` entra al portal solo si tiene una suscripción con
  `fecha_vencimiento >= hoy` (fecha de Lima). Sin ella ve la pantalla "Vencido" (distingue
  "vencida" de "sin suscripción").
- Activar o renovar Premium suma 30 días: si ya hay una suscripción vigente se extiende desde
  su vencimiento y se reutiliza la misma fila. `fecha_limite_eliminacion` = vencimiento + 7.
- La sesión se guarda 12 h y se revalida contra el servidor al abrir la app y al volver a la
  pestaña (detecta baneos y vencimientos).
- El portal ordena de forma global y estable: avisos con precio primero (más recientes antes) y
  sin precio al final, también entre páginas.
