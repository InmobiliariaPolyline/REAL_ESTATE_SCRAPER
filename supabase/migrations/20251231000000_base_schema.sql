-- =============================================================================
-- Esquema base de REAL ESTATE SCRAPER (base de datos desde cero)
--
-- Ecosistema (ver "Informe Técnico: Mantenimiento y Escalabilidad"):
--
--   Portales ──► Scraper (Python, GitHub Actions) ──► PostgreSQL (Supabase) ──► Portal web (React)
--                      │ conexión directa/pooler            ▲       │
--                      │ (rol postgres: omite RLS)          │       └─► Panel admin
--                      └─ SUNAT: tipo de cambio             │
--                                                           └──────── Inmodata (ETL / BI): lectura
--
-- Flujo de uso
--   1. El scraper hace UPSERT masivo en `propiedades` (clave `id`), guardando el precio
--      original (`precio`, `moneda`) y el normalizado a USD (`precio_usd`) con el tipo de
--      cambio de SUNAT. En cada corrida debe refrescar `ultima_vista_en`.
--   2. El administrador crea usuarios y les activa Premium (`suscripciones`).
--   3. Un usuario con suscripción vigente entra al portal y consulta `propiedades`;
--      cada login queda en `historial_accesos`.
--   4. El administrador cura avisos: favoritos, historial de vistos, búsquedas guardadas
--      y enlaces de apoyo por propiedad (`enlaces`).
--   5. Inmodata lee `propiedades` (con una conexión de solo lectura) para limpieza y BI.
--
-- Orden de ejecución:  este archivo  →  20260101000000_secure_auth.sql
-- Es idempotente (`if not exists`): se puede ejecutar sobre una base que ya tenga tablas.
-- Después de ejecutarlo, crea el primer administrador (ver la sección final).
-- =============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ── Usuarios y suscripciones ─────────────────────────────────────────────────

create table if not exists public.usuarios (
  id              bigint generated always as identity primary key,
  usuario         text not null unique,
  password_hash   text not null,                 -- bcrypt (lo gestionan las RPC de la migración de seguridad)
  rol             text not null default 'usuario' check (rol in ('admin', 'usuario')),
  estado          text not null default 'activo'  check (estado in ('activo', 'baneado')),
  creado_en       timestamptz not null default now(),
  ultima_conexion timestamptz
);

create table if not exists public.suscripciones (
  id                       bigint generated always as identity primary key,
  usuario_id               bigint not null references public.usuarios (id) on delete cascade,
  fecha_inicio             date not null default ((now() at time zone 'America/Lima')::date),
  fecha_vencimiento        date not null,
  -- Fecha a partir de la cual los datos del usuario pueden eliminarse (vencimiento + 7 días).
  fecha_limite_eliminacion date not null,
  check (fecha_vencimiento >= fecha_inicio),
  check (fecha_limite_eliminacion >= fecha_vencimiento)
);
create index if not exists suscripciones_usuario_venc_idx
  on public.suscripciones (usuario_id, fecha_vencimiento desc);

create table if not exists public.historial_accesos (
  id           bigint generated always as identity primary key,
  usuario_id   bigint not null references public.usuarios (id) on delete cascade,
  fecha_acceso timestamptz not null default now()
);
create index if not exists historial_accesos_fecha_idx
  on public.historial_accesos (fecha_acceso desc);

-- ── Propiedades (las escribe el scraper) ─────────────────────────────────────

create table if not exists public.propiedades (
  -- Identificador estable del aviso (p. ej. portal + código del aviso, o un hash de la URL).
  -- Es la clave del UPSERT del scraper: evita duplicados entre corridas.
  id              text primary key,
  portal          text not null,                  -- minúsculas: properati, infocasas, babilonia, urbania, adondevivir
  operacion       text,                           -- 'VENTA' | 'ALQUILER'
  inmueble        text,                           -- 'Departamento' | 'Casa' | ...
  titulo          text,
  precio          numeric not null default 0,     -- precio publicado, en `moneda`
  precio_usd      numeric not null default 0,     -- precio normalizado a USD (tipo de cambio SUNAT)
  moneda          text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  distrito        text,
  dormitorios     text,
  banios          text,
  area            text,
  imagen          text,
  url             text,
  creado_en       timestamptz not null default now(),
  -- Última corrida del scraper que vio el aviso. Permite detectar avisos dados de baja.
  ultima_vista_en timestamptz not null default now()
);
create index if not exists propiedades_creado_idx   on public.propiedades (creado_en desc, id desc);
create index if not exists propiedades_portal_idx   on public.propiedades (portal);
create index if not exists propiedades_operacion_idx on public.propiedades (lower(operacion));
create index if not exists propiedades_vista_idx    on public.propiedades (ultima_vista_en);

-- ── Enlaces de apoyo por propiedad ───────────────────────────────────────────

create table if not exists public.enlaces (
  id           bigint generated always as identity primary key,
  propiedad_id text not null references public.propiedades (id) on delete cascade,
  titulo       text not null,
  descripcion  text,
  url          text not null check (url ~* '^https?://'),
  tipo         text not null default 'OTRO'
               check (tipo in ('OTRO', 'INFORMACION_ESTADISTICA', 'INFORMACION_LEGAL', 'DOCUMENTACION')),
  creado_en    timestamptz not null default now()
);
create index if not exists enlaces_propiedad_idx on public.enlaces (propiedad_id);

-- ── Curación del administrador ───────────────────────────────────────────────

create table if not exists public.favoritos (
  id           bigint generated always as identity primary key,
  admin_id     bigint not null references public.usuarios (id) on delete cascade,
  propiedad_id text   not null references public.propiedades (id) on delete cascade,
  creado_en    timestamptz not null default now(),
  unique (admin_id, propiedad_id)
);

-- `unique (admin_id, propiedad_id)` es necesario para el upsert onConflict del cliente.
create table if not exists public.historial (
  id           bigint generated always as identity primary key,
  admin_id     bigint not null references public.usuarios (id) on delete cascade,
  propiedad_id text   not null references public.propiedades (id) on delete cascade,
  visto_en     timestamptz not null default now(),
  unique (admin_id, propiedad_id)
);
create index if not exists historial_admin_visto_idx on public.historial (admin_id, visto_en desc);

create table if not exists public.busquedas_guardadas (
  id         uuid primary key default gen_random_uuid(),
  admin_id   bigint not null references public.usuarios (id) on delete cascade,
  nombre     text not null,
  distrito   text not null default '',
  operacion  text not null default 'todos',
  portal     text not null default 'todos',
  precio_min numeric,                              -- normalizado a USD
  precio_max numeric,                              -- normalizado a USD
  creado_en  timestamptz not null default now()
);
create index if not exists busquedas_admin_idx on public.busquedas_guardadas (admin_id, creado_en desc);

commit;

-- =============================================================================
-- PRIMER ADMINISTRADOR  (ejecútalo UNA vez, con tu propia contraseña, y no lo subas al repo)
--
--   insert into public.usuarios (usuario, password_hash, rol)
--   values ('admin', extensions.crypt('TU_CONTRASEÑA_SEGURA', extensions.gen_salt('bf')), 'admin');
-- =============================================================================
