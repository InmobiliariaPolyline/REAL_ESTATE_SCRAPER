-- =============================================================================
-- Rol de solo lectura para Inmodata / herramientas de BI (opcional)
--
-- Da acceso de LECTURA únicamente a los datos de mercado (propiedades y su historial de
-- precios). No ve usuarios, contraseñas, sesiones, auditoría ni suscripciones.
--
-- ANTES DE EJECUTAR: reemplaza CAMBIAR_ESTA_CLAVE por una contraseña larga y única.
-- No guardes la contraseña real en el repositorio. Es idempotente (se puede repetir; si el rol ya
-- existe, vuelve a fijar sus permisos pero no cambia su contraseña).
-- Cadena de conexión resultante (Neon): usuario inmodata_ro, la misma base y host que la app.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'inmodata_ro') then
    create role inmodata_ro login password 'CAMBIAR_ESTA_CLAVE';
  end if;

  execute format('grant connect on database %I to inmodata_ro', current_database());
end
$$;

grant usage on schema public to inmodata_ro;

-- Solo estas tablas. Cualquier otra tabla (usuarios, app_sessions, auditoria...) queda fuera.
grant select on public.propiedades to inmodata_ro;
grant select on public.propiedades_precios to inmodata_ro;

-- Límites para que una consulta de BI no degrade la aplicación.
alter role inmodata_ro set statement_timeout = '60s';
alter role inmodata_ro set idle_in_transaction_session_timeout = '30s';
alter role inmodata_ro connection limit 5;

-- Comprobación (debe devolver true, false):
--   select has_table_privilege('inmodata_ro', 'public.propiedades', 'select'),
--          has_table_privilege('inmodata_ro', 'public.usuarios', 'select');
