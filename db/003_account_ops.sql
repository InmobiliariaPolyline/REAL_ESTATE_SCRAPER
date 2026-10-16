-- =============================================================================
-- Cuenta y operación: cambio/restablecimiento de contraseña y estado de alertas
--
-- Requiere: db/001_schema.sql y db/002_auth.sql. Es idempotente.
--
--   cambiar_password      el usuario cambia su propia contraseña (exige la actual)
--   restablecer_password  el admin fija una contraseña nueva a otro usuario
--   app_alerts            evita enviar la misma alerta del watchdog más de una vez al día
--
-- Ambas funciones de contraseña cierran las sesiones abiertas del usuario (salvo, si se
-- indica, la sesión desde la que se hace el cambio).
-- =============================================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.app_alerts (
  clave        text primary key,
  ultimo_envio timestamptz not null default now()
);

-- Cambio de contraseña propio. Devuelve 'ok' | 'invalid' | 'password_corta' | 'bloqueado'.
-- Los intentos fallidos cuentan para el mismo bloqueo del login (5 en 15 minutos).
create or replace function public.cambiar_password(
  p_usuario_id  bigint,
  p_actual      text,
  p_nueva       text,
  p_token_actual uuid default null
)
returns text
language plpgsql
as $$
declare
  u        public.usuarios%rowtype;
  v_ok     boolean;
  v_fails  int;
begin
  if length(coalesce(p_nueva, '')) < 8 then
    return 'password_corta';
  end if;

  select * into u from public.usuarios where id = p_usuario_id;
  if not found then
    return 'invalid';
  end if;

  select count(*) into v_fails
  from public.login_intentos
  where usuario = lower(u.usuario) and not exitoso
    and intentado_en > now() - interval '15 minutes';
  if v_fails >= 5 then
    return 'bloqueado';
  end if;

  -- Acepta también contraseñas heredadas en texto plano.
  if u.password_hash like '$2%' then
    v_ok := (u.password_hash = crypt(coalesce(p_actual, ''), u.password_hash));
  else
    v_ok := (u.password_hash = coalesce(p_actual, ''));
  end if;

  if not v_ok then
    insert into public.login_intentos (usuario, exitoso) values (lower(u.usuario), false);
    return 'invalid';
  end if;

  update public.usuarios
     set password_hash = crypt(p_nueva, gen_salt('bf', 10))
   where id = p_usuario_id;

  -- Cierra el resto de las sesiones del usuario.
  delete from public.app_sessions
   where usuario_id = p_usuario_id
     and (p_token_actual is null or token <> p_token_actual);

  return 'ok';
end;
$$;

-- Restablecimiento por el administrador (la API verifica el rol). Cierra todas las sesiones.
create or replace function public.restablecer_password(p_usuario_id bigint, p_nueva text)
returns text
language plpgsql
as $$
begin
  if length(coalesce(p_nueva, '')) < 8 then
    return 'password_corta';
  end if;

  update public.usuarios
     set password_hash = crypt(p_nueva, gen_salt('bf', 10))
   where id = p_usuario_id;
  if not found then
    return 'inexistente';
  end if;

  delete from public.app_sessions where usuario_id = p_usuario_id;
  delete from public.login_intentos
   where usuario = (select lower(usuario) from public.usuarios where id = p_usuario_id);
  return 'ok';
end;
$$;

commit;
