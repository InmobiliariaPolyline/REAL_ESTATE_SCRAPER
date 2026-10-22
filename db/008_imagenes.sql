-- =============================================================================
-- Varias fotos por aviso (galería de la vista previa)
--
-- Requiere: db/001_schema.sql. Es idempotente.
--
--   propiedades.imagenes   direcciones http(s) de las fotos del aviso, en orden (la primera
--                          es también `imagen`, la portada de las tarjetas). Hasta 20.
-- =============================================================================

alter table public.propiedades add column if not exists imagenes text[] not null default '{}';

-- Limpieza de avisos ya guardados (también es idempotente):
-- 1) entidades HTML en los títulos («42 m&sup2;» -> «42 m²»)
update public.propiedades
   set titulo = replace(replace(replace(replace(replace(titulo, '&sup2;', '²'), '&amp;', '&'), '&quot;', '"'), '&#39;', ''''), '&nbsp;', ' ')
 where titulo ~ '&(sup2|amp|quot|#39|nbsp);';

-- 2) fotos de Adondevivir/Urbania en tamaño grande
update public.propiedades
   set imagen = regexp_replace(imagen, '/[0-9]{3,4}x[0-9]{3,4}/', '/720x532/')
 where imagen like '%naventcdn.com%' and imagen !~ '/720x532/';

-- 3) precio en dólares que no cuadra con el publicado (se recalcula con 3.75 soles por dólar)
update public.propiedades
   set precio_usd = case when moneda = 'USD' then precio else round(precio / 3.75, 2) end
 where precio > 0 and precio_usd > 0
   and precio_usd / (case when moneda = 'USD' then precio else precio / 3.75 end) not between 0.7 and 1.45;
