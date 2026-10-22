-- =============================================================================
-- Varias fotos por aviso (galería de la vista previa)
--
-- Requiere: db/001_schema.sql. Es idempotente.
--
--   propiedades.imagenes   direcciones http(s) de las fotos del aviso, en orden (la primera
--                          es también `imagen`, la portada de las tarjetas). Hasta 20.
-- =============================================================================

alter table public.propiedades add column if not exists imagenes text[] not null default '{}';
