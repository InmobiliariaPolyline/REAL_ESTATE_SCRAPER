-- =============================================================================
-- Autenticación y administración (lógica en la base de datos)
--
-- Modelo de seguridad
--   - Solo la API (api/) se conecta a Postgres, con la cadena `DATABASE_URL`; el navegador
--     nunca toca la base. La API autoriza cada petición (admin / suscriptor vigente) y
--     llama a estas funciones.
--   - Contraseñas con bcrypt (pgcrypto). Login con bloqueo tras 5 fallos en 15 minutos.
--   - Sesiones: token opaco (uuid) en `app_sessions`, válido 12 h y ligado a un usuario activo.
--
-- Requiere: db/001_schema.sql. Es idempotente.
-- =============================================================================

begin;

create extension if not exists pgcrypto;

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

-- ── Datos de acceso que necesita el cliente (usuario + suscripción vigente) ──

create or replace function public.app_access_payload(p_usuario_id bigint)
returns json
language sql
stable
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

-- ── Login / sesión ───────────────────────────────────────────────────────────

create or replace function public.login_usuario(p_usuario text, p_password text)
returns json
language plpgsql
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
           set password_hash = crypt(p_password, gen_salt('bf', 10))
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

-- Devuelve el usuario dueño del token si la sesión sigue vigente y la cuenta está activa.
create or replace function public.validar_sesion(p_token uuid)
returns json
language plpgsql
stable
as $$
declare
  v_id bigint;
begin
  select s.usuario_id into v_id
  from public.app_sessions s
  join public.usuarios u on u.id = s.usuario_id
  where s.token = p_token
    and s.expires_at > now()
    and u.estado = 'activo';

  if v_id is null then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  return (public.app_access_payload(v_id)::jsonb || jsonb_build_object('ok', true))::json;
end;
$$;

create or replace function public.cerrar_sesion(p_token uuid)
returns void
language sql
as $$
  delete from public.app_sessions where token = p_token
$$;

-- ── Administración (la API verifica que quien llama es admin) ────────────────

create or replace function public.activar_premium(p_usuario_id bigint, p_dias int default 30)
returns void
language plpgsql
as $$
declare
  v_hoy     date := (now() at time zone 'America/Lima')::date;
  v_sub     public.suscripciones%rowtype;
  v_found   boolean;
  v_base    date;
  v_vence   date;
begin
  if p_dias is null or p_dias <= 0 then
    raise exception 'dias_invalidos';
  end if;
  if not exists (select 1 from public.usuarios where id = p_usuario_id) then
    raise exception 'usuario_inexistente';
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
as $$
declare
  v_name text := btrim(coalesce(p_usuario, ''));
  v_id   bigint;
begin
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
  values (v_name, crypt(p_password, gen_salt('bf', 10)), p_rol, p_estado)
  returning id into v_id;

  if p_premium then
    perform public.activar_premium(v_id, 30);
  end if;
  return v_id;
end;
$$;

-- ── Contraseñas existentes: pasar todo a bcrypt ──────────────────────────────

update public.usuarios
   set password_hash = crypt(password_hash, gen_salt('bf', 10))
 where password_hash not like '$2%';

commit;
