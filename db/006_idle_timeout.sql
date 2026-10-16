-- =============================================================================
-- Cierre de sesión por inactividad (servidor)
--
-- Requiere: db/005_sessions_audit.sql. Es idempotente.
--
-- Una sesión sin ninguna petición durante 30 minutos deja de ser válida (aunque el token
-- siga dentro de sus 12 h). `ultimo_uso` se actualiza como máximo una vez por minuto.
-- Para cambiar el plazo, edita el intervalo '30 minutes' y vuelve a ejecutar este archivo.
-- =============================================================================

begin;

create or replace function public.validar_sesion(p_token uuid)
returns json
language plpgsql
as $$
declare
  v_id bigint;
begin
  select s.usuario_id into v_id
  from public.app_sessions s
  join public.usuarios u on u.id = s.usuario_id
  where s.token = p_token
    and s.expires_at > now()
    and s.ultimo_uso > now() - interval '30 minutes'
    and u.estado = 'activo';

  if v_id is null then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;

  update public.app_sessions
     set ultimo_uso = now()
   where token = p_token and ultimo_uso < now() - interval '1 minute';

  return (public.app_access_payload(v_id)::jsonb || jsonb_build_object('ok', true))::json;
end;
$$;

commit;
