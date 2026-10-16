-- =============================================================================
-- Sesiones visibles y registro de auditoría
--
-- Requiere: db/001_schema.sql y db/002_auth.sql. Es idempotente.
--
--   app_sessions   gana: sid (id público, nunca se expone el token), user_agent, ip, ultimo_uso
--   validar_sesion actualiza `ultimo_uso` como máximo cada 5 minutos
--   auditoria      quién hizo qué en el panel (altas, bajas, renovaciones, borrados...)
-- =============================================================================

begin;

alter table public.app_sessions add column if not exists sid bigint generated always as identity;
alter table public.app_sessions add column if not exists user_agent text;
alter table public.app_sessions add column if not exists ip text;
alter table public.app_sessions add column if not exists ultimo_uso timestamptz not null default now();

create unique index if not exists app_sessions_sid_idx on public.app_sessions (sid);

-- Igual que antes, pero ahora marca el último uso de la sesión (con un margen de 5 minutos
-- para no escribir en cada petición). Deja de ser STABLE porque puede hacer un UPDATE.
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
    and u.estado = 'activo';

  if v_id is null then
    return json_build_object('ok', false, 'error', 'invalid');
  end if;

  update public.app_sessions
     set ultimo_uso = now()
   where token = p_token and ultimo_uso < now() - interval '5 minutes';

  return (public.app_access_payload(v_id)::jsonb || jsonb_build_object('ok', true))::json;
end;
$$;

-- Auditoría. Sin clave foránea a `usuarios`: el registro debe sobrevivir si se borra la cuenta.
create table if not exists public.auditoria (
  id         bigint generated always as identity primary key,
  usuario_id bigint,
  usuario    text not null,
  accion     text not null,
  objetivo   text,
  detalle    jsonb,
  ip         text,
  creado_en  timestamptz not null default now()
);
create index if not exists auditoria_creado_idx on public.auditoria (creado_en desc);
create index if not exists auditoria_accion_idx on public.auditoria (accion, creado_en desc);

commit;
