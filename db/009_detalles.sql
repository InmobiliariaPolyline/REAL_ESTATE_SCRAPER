-- =============================================================================
-- Más datos por aviso para la vista previa (descripción, dirección, cochera…)
--
-- Requiere: db/001_schema.sql. Es idempotente. Sin esta migración todo sigue funcionando:
-- la carga guarda lo de siempre y la vista previa simplemente no muestra estos datos.
--
--   descripcion, direccion, estacionamientos, antiguedad, publicador, latitud, longitud,
--   mantenimiento (cuota mensual de mantenimiento, en la moneda del aviso)
-- =============================================================================

alter table public.propiedades
  add column if not exists descripcion text,
  add column if not exists direccion text,
  add column if not exists estacionamientos text,
  add column if not exists antiguedad text,
  add column if not exists publicador text,
  add column if not exists latitud double precision,
  add column if not exists longitud double precision,
  add column if not exists mantenimiento numeric;
