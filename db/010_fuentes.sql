-- =============================================================================
-- Más fuentes de carga: topes propios de InfoCasas y Properati
--
-- Requiere: db/007_carga.sql. Es idempotente.
--
--   tope_infocasas   avisos por ciclo de InfoCasas (100 por defecto)
--   tope_properati   avisos por ciclo de Properati (50 por defecto)
--
-- Sin esta migración la carga funciona igual con esos valores por defecto, pero los
-- topes no se pueden cambiar desde Sistema → Carga de datos.
-- =============================================================================

alter table public.carga_config add column if not exists tope_infocasas int not null default 100 check (tope_infocasas between 0 and 5000);
alter table public.carga_config add column if not exists tope_properati int not null default 50 check (tope_properati between 0 and 5000);
