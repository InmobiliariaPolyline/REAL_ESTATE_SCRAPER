-- =============================================================================
-- Autenticación segura y RLS para REAL ESTATE SCRAPER
--
-- Qué resuelve
--   1. Contraseñas en texto plano  -> se guardan con bcrypt (pgcrypto).
--   2. Login desde el navegador con la anon key leyendo `usuarios` -> login por RPC
--      (`login_usuario`), con límite de intentos fallidos en el servidor.
--   3. Sesión falsificable en localStorage -> el servidor emite un token (tabla
--      `app_sessions`); el cliente lo envía en la cabecera `x-session-token` y las
--      políticas RLS lo validan en cada petición.
--   4. Tablas abiertas -> RLS: solo admin o suscriptores vigentes leen `propiedades`;
--      `usuarios` / `suscripciones` / `historial_accesos` solo para admin (o el propio
--      usuario en su suscripción).
--
-- Orden de despliegue (IMPORTANTE)
--   1. Despliega primero la versión nueva del cliente (funciona en "modo legado"
--      mientras estas funciones no existan).
--   2. Aplica esta migración (SQL Editor de Supabase o `supabase db push`).
--   3. A partir de ese momento el cliente usa las RPC automáticamente.
--
-- Requisitos del esquema (los que usa la aplicación)
--   usuarios(id, usuario, password_hash, rol, estado, creado_en, ultima_conexion)
--   suscripciones(id, usuario_id, fecha_inicio, fecha_vencimiento, fecha_limite_eliminacion)
--   historial_accesos(usuario_id, fecha_acceso)
--   propiedades, enlaces
--   favoritos / historial / busquedas_guardadas (columna admin_id)
--
-- El scraper debe escribir en `propiedades` con la service_role key (omite RLS).
-- =============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ── Tablas de apoyo ──────────────────────────────────────────────────────────

create table if not exists public.app_sessions (
  token       uuid primary key default gen_random_uuid(),
  usuario_id  bigint not null references public.usuarios (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '12 hours')
);
create index if not exists app_sessions_usuario_idx on public.app_sessions (usuario_id);
create index if not exists app_sessions_expires_idx on public.app_sessions (expires_at);

create table if not exists public.login_intentos (
  id           bigint generated always as identity primary key,
  usuario      text not null,
  exitoso      boolean not null,
  intentado_en timestamptz not null default now()
);
create index if not exists login_intentos_usuario_idx
  on public.login_intentos (usuario, intentado_en desc);

alter table public.app_sessions   enable row level security;
alter table public.login_intentos enable row level security;
-- Sin políticas: solo las funciones SECURITY DEFINER pueden tocarlas.
revoke all on public.app_sessions, public.login_intentos from anon, authenticated;

-- ── Funciones auxiliares (leen la sesión de la cabecera x-session-token) ─────

create or replace function public.app_session_token()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  raw text;
begin
  begin
    raw := nullif(current_setting('request.headers', true)::json ->> 'x-session-token', '');
  exception when others then
    return null;
  end;
  if raw is null then
    return null;
  end if;
  begin
    return raw::uuid;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.app_user_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select s.usuario_id
  from public.app_sessions s
  join public.usuarios u on u.id = s.usuario_id
  where s.token = public.app_session_token()
    and s.expires_at > now()
    and u.estado = 'activo'
  limit 1
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = public.app_user_id() and u.rol = 'admin'
  )
$$;

create or replace function public.app_has_active_sub()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.suscripciones s
    where s.usuario_id = public.app_user_id()
      and s.fecha_vencimiento >= (now() at time zone 'America/Lima')::date
  )
$$;

-- Datos de acceso que necesita el cliente (usuario + suscripción vigente).
create or replace function public.app_access_payload(p_usuario_id bigint)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'usuario', json_build_object(
      'id', u.id, 'usuario', u.usuario, 'rol', u.rol, 'estado', u.estado
    ),
    'suscripcion', (
      select json_build_object(
        'id', s.id,
        'usuario_id', s.usuario_id,
        'fecha_inicio', s.fecha_inicio,
        'fecha_vencimiento', s.fecha_vencimiento,
        'fecha_limite_eliminacion', s.fecha_limite_eliminacion
      )
      from public.suscripciones s
      where s.usuario_id = u.id
        and s.fecha_vencimiento >= (now() at time zone 'America/Lima')::date
      order by s.fecha_vencimiento desc
      limit 1
    ),
    'tuvo_suscripcion', exists (
      select 1 from public.suscripciones s2 where s2.usuario_id = u.id
    )
  )
  from public.usuarios u
  where u.id = p_usuario_id
$$;

-- ── RPC: login / sesión ──────────────────────────────────────────────────────

create or replace function public.login_usuario(p_usuario text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u        public.usuarios%rowtype;
  v_ok     boolean := false;
  v_fails  int;
  v_token  uuid;
  v_name   text := btrim(coalesce(p_usuario, ''));
begin
  if v_name = '' or coalesce(p_password, '') = '' then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;

  -- Limpieza oportunista de registros viejos.
  delete from public.login_intentos where intentado_en < now() - interval '1 day';
  delete from public.app_sessions   where expires_at < now();

  -- Bloqueo: 5 fallos en 15 minutos.
  select count(*) into v_fails
  from public.login_intentos
  where usuario = lower(v_name) and not exitoso
    and intentado_en > now() - interval '15 minutes';
  if v_fails >= 5 then
    return json_build_object('ok', false, 'error', 'bloqueado');
  end if;

  select * into u from public.usuarios where usuario = v_name;
  if found then
    if u.password_hash like '$2%' then
      v_ok := (u.password_hash = crypt(p_password, u.password_hash));
    else
      -- Contraseña heredada en texto plano: se valida y se migra a bcrypt al vuelo.
      v_ok := (u.password_hash = p_password);
      if v_ok then
        update public.usuarios
           set password_hash = crypt(p_password, gen_salt('bf'))
         where id = u.id;
      end if;
    end if;
  end if;

  insert into public.login_intentos (usuario, exitoso) values (lower(v_name), v_ok);

  if not v_ok then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if u.estado = 'baneado' then
    return json_build_object('ok', false, 'error', 'baneado');
  end if;

  delete from public.login_intentos where usuario = lower(v_name) and not exitoso;

  insert into public.app_sessions (usuario_id) values (u.id) returning token into v_token;
  insert into public.historial_accesos (usuario_id) values (u.id);
  update public.usuarios set ultima_conexion = now() where id = u.id;

  return (public.app_access_payload(u.id)::jsonb || jsonb_build_object('ok', true, 'token', v_token))::json;
end;
$$;

create or replace function public.validar_sesion()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id bigint := public.app_user_id();
begin
  if v_id is null then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  return (public.app_access_payload(v_id)::jsonb || jsonb_build_object('ok', true))::json;
end;
$$;

create or replace function public.cerrar_sesion()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.app_sessions where token = public.app_session_token()
$$;

-- ── RPC: administración de usuarios y suscripciones (solo admin) ─────────────

create or replace function public.activar_premium(p_usuario_id bigint, p_dias int default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy     date := (now() at time zone 'America/Lima')::date;
  v_sub     public.suscripciones%rowtype;
  v_base    date;
  v_vence   date;
  v_found   boolean;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_dias is null or p_dias <= 0 then
    raise exception 'dias_invalidos';
  end if;

  select * into v_sub
  from public.suscripciones
  where usuario_id = p_usuario_id
  order by fecha_vencimiento desc
  limit 1;
  v_found := found;

  if v_found and v_sub.fecha_vencimiento >= v_hoy then
    v_base := v_sub.fecha_vencimiento;       -- renovación: no se pierden días
  else
    v_base := v_hoy;
  end if;
  v_vence := v_base + p_dias;

  if v_found then
    update public.suscripciones
       set fecha_inicio = case when v_sub.fecha_vencimiento >= v_hoy then fecha_inicio else v_hoy end,
           fecha_vencimiento = v_vence,
           fecha_limite_eliminacion = v_vence + 7
     where id = v_sub.id;
  else
    insert into public.suscripciones
      (usuario_id, fecha_inicio, fecha_vencimiento, fecha_limite_eliminacion)
    values (p_usuario_id, v_hoy, v_vence, v_vence + 7);
  end if;
end;
$$;

create or replace function public.crear_usuario(
  p_usuario  text,
  p_password text,
  p_rol      text default 'usuario',
  p_estado   text default 'activo',
  p_premium  boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := btrim(coalesce(p_usuario, ''));
  v_id   bigint;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'usuario_vacio';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'password_corta';
  end if;
  if p_rol not in ('admin', 'usuario') then
    raise exception 'rol_invalido';
  end if;
  if p_estado not in ('activo', 'baneado') then
    raise exception 'estado_invalido';
  end if;
  if exists (select 1 from public.usuarios where usuario = v_name) then
    raise exception 'usuario_duplicado' using errcode = '23505';
  end if;

  insert into public.usuarios (usuario, password_hash, rol, estado)
  values (v_name, crypt(p_password, gen_salt('bf')), p_rol, p_estado)
  returning id into v_id;

  if p_premium then
    perform public.activar_premium(v_id, 30);
  end if;
  return v_id;
end;
$$;

-- ── Permisos de ejecución ────────────────────────────────────────────────────

revoke all on function
  public.login_usuario(text, text),
  public.validar_sesion(),
  public.cerrar_sesion(),
  public.activar_premium(bigint, int),
  public.crear_usuario(text, text, text, text, boolean)
from public;

grant execute on function
  public.app_session_token(),
  public.app_user_id(),
  public.app_is_admin(),
  public.app_has_active_sub(),
  public.login_usuario(text, text),
  public.validar_sesion(),
  public.cerrar_sesion(),
  public.activar_premium(bigint, int),
  public.crear_usuario(text, text, text, text, boolean)
to anon, authenticated;

-- ── Contraseñas: pasar todo lo existente a bcrypt ────────────────────────────

update public.usuarios
   set password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf'))
 where password_hash not like '$2%';

-- ── Privilegios por columna en `usuarios` (password_hash nunca sale por la API) ──

revoke select, insert, update, delete on public.usuarios from anon, authenticated;
grant select (id, usuario, rol, estado, creado_en, ultima_conexion)
  on public.usuarios to anon, authenticated;
grant update (estado) on public.usuarios to anon, authenticated;

-- ── Row Level Security ───────────────────────────────────────────────────────

-- usuarios: solo admin (el login y la creación van por RPC).
alter table public.usuarios enable row level security;
drop policy if exists usuarios_admin_all on public.usuarios;
create policy usuarios_admin_all on public.usuarios
  for all
  using ((select public.app_is_admin()))
  with check ((select public.app_is_admin()));

-- suscripciones: cada usuario ve la suya; admin ve y modifica todas.
alter table public.suscripciones enable row level security;
drop policy if exists suscripciones_select_own on public.suscripciones;
drop policy if exists suscripciones_admin_all on public.suscripciones;
create policy suscripciones_select_own on public.suscripciones
  for select
  using (usuario_id = (select public.app_user_id()));
create policy suscripciones_admin_all on public.suscripciones
  for all
  using ((select public.app_is_admin()))
  with check ((select public.app_is_admin()));

-- historial_accesos: lectura solo admin (las inserciones las hace `login_usuario`).
alter table public.historial_accesos enable row level security;
drop policy if exists historial_accesos_admin_select on public.historial_accesos;
create policy historial_accesos_admin_select on public.historial_accesos
  for select
  using ((select public.app_is_admin()));

-- propiedades: lectura para admin o suscriptores vigentes; escritura solo admin.
alter table public.propiedades enable row level security;
drop policy if exists propiedades_select on public.propiedades;
drop policy if exists propiedades_admin_write on public.propiedades;
create policy propiedades_select on public.propiedades
  for select
  using ((select public.app_is_admin()) or (select public.app_has_active_sub()));
create policy propiedades_admin_write on public.propiedades
  for all
  using ((select public.app_is_admin()))
  with check ((select public.app_is_admin()));

-- enlaces: admin y suscriptores vigentes pueden verlos y gestionarlos (función del portal).
alter table public.enlaces enable row level security;
drop policy if exists enlaces_member_all on public.enlaces;
create policy enlaces_member_all on public.enlaces
  for all
  using ((select public.app_is_admin()) or (select public.app_has_active_sub()))
  with check ((select public.app_is_admin()) or (select public.app_has_active_sub()));

-- favoritos / historial / busquedas_guardadas: cada quien solo sus filas.
alter table public.favoritos enable row level security;
drop policy if exists favoritos_owner on public.favoritos;
create policy favoritos_owner on public.favoritos
  for all
  using (admin_id = (select public.app_user_id()))
  with check (admin_id = (select public.app_user_id()));

alter table public.historial enable row level security;
drop policy if exists historial_owner on public.historial;
create policy historial_owner on public.historial
  for all
  using (admin_id = (select public.app_user_id()))
  with check (admin_id = (select public.app_user_id()));

alter table public.busquedas_guardadas enable row level security;
drop policy if exists busquedas_guardadas_owner on public.busquedas_guardadas;
create policy busquedas_guardadas_owner on public.busquedas_guardadas
  for all
  using (admin_id = (select public.app_user_id()))
  with check (admin_id = (select public.app_user_id()));

commit;
