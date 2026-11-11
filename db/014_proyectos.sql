-- =============================================================================
-- Proyectos inmobiliarios: rango de precio y tipologías
--
-- Requiere: db/001_schema.sql. Es idempotente.
--
-- Un proyecto (edificio en construcción, condominio) no tiene un solo precio ni un solo tamaño: ofrece varias tipologías
-- («1 dormitorio, 54 m², US$ 108,700» … «3 dormitorios, 66 m², US$ 130,600»). El sistema guarda un aviso por proyecto:
--
--   propiedades.precio          el precio más bajo («Desde»), en la moneda del aviso
--   propiedades.precio_max      el precio más alto («Hasta»), en la misma moneda; vacío si todas cuestan lo mismo
--   propiedades.precio_max_usd  el precio más alto normalizado a dólares
--   propiedades.unidades        la lista de tipologías: [{codigo, dormitorios, banios, area, precio}]
--
-- Sin esta migración todo sigue funcionando: la carga guarda el proyecto con su precio «Desde» y sus rangos de
-- dormitorios, baños y área; solo faltan el precio «Hasta» y el detalle de tipologías.
-- =============================================================================

alter table public.propiedades
  add column if not exists precio_max numeric,
  add column if not exists precio_max_usd numeric,
  add column if not exists unidades jsonb;
