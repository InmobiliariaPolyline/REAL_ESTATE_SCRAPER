-- =============================================================================
-- Carga automática de avisos (Apify) con topes de gasto
--
-- Requiere: db/001_schema.sql. Es idempotente.
--
--   carga_config    una sola fila: interruptor de pausa, topes y el día del mes en que se
--                   reinicia el crédito de Apify (23 por defecto). Empieza PAUSADA: hay que
--                   activarla a propósito desde Sistema → Carga de datos.
--   carga_corridas  cada corrida pedida a Apify. El uso del mes (lo que cuenta contra el tope)
--                   se calcula de aquí: avisos recibidos, o los pedidos si aún no se sabe.
-- =============================================================================

begin;

create table if not exists public.carga_config (
  id                 int primary key default 1 check (id = 1),
  pausada            boolean not null default true,
  tope_mensual       int not null default 1000 check (tope_mensual between 0 and 5000),
  maximo_por_corrida int not null default 200  check (maximo_por_corrida between 1 and 2000),
  dia_reinicio       int not null default 23   check (dia_reinicio between 1 and 28),
  actualizado_en     timestamptz not null default now()
);
-- Para bases que ya tenían la tabla sin esta columna:
alter table public.carga_config add column if not exists dia_reinicio int not null default 23 check (dia_reinicio between 1 and 28);
insert into public.carga_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.carga_corridas (
  id               bigint generated always as identity primary key,
  fuente           text not null,
  run_id           text,
  estado           text not null default 'iniciada' check (estado in ('iniciada', 'completada', 'fallida')),
  origen           text not null default 'manual' check (origen in ('manual', 'programada')),
  iniciada_por     text,
  url_busqueda     text,
  avisos_pedidos   int not null default 0,
  avisos_recibidos int,
  avisos_guardados int,
  detalle          text,
  iniciada_en      timestamptz not null default now(),
  finalizada_en    timestamptz
);
create index if not exists carga_corridas_fecha_idx on public.carga_corridas (iniciada_en desc);
create unique index if not exists carga_corridas_run_idx on public.carga_corridas (run_id) where run_id is not null;
-- Nunca dos corridas activas de la misma fuente a la vez.
create unique index if not exists carga_una_activa_idx on public.carga_corridas (fuente) where estado = 'iniciada';

commit;
