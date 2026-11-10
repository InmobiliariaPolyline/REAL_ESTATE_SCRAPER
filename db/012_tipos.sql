-- =============================================================================
-- Unifica los nombres de tipo de inmueble («Local Comercial» -> «Local comercial», etc.)
--
-- Requiere: db/001_schema.sql. Es idempotente y opcional: la carga nueva ya guarda los nombres oficiales;
-- esto solo corrige los avisos guardados antes, para que el filtro «Tipo» no muestre el mismo tipo dos veces.
-- =============================================================================

update public.propiedades set inmueble = 'Local comercial'  where lower(inmueble) in ('local comercial', 'locales comerciales', 'local', 'locales') and inmueble <> 'Local comercial';
update public.propiedades set inmueble = 'Local industrial' where lower(inmueble) in ('local industrial o galpón', 'local industrial o galpon', 'galpón', 'galpon') and inmueble <> 'Local industrial';
update public.propiedades set inmueble = 'Habitación'       where lower(inmueble) in ('habitaciones', 'habitacion', 'habitación') and inmueble <> 'Habitación';
update public.propiedades set inmueble = 'Otros'            where lower(inmueble) in ('otro', 'otros') and inmueble <> 'Otros';
update public.propiedades set inmueble = initcap(inmueble)  where lower(inmueble) in ('departamento', 'casa', 'terreno', 'oficina', 'proyecto', 'edificio', 'cochera', 'hotel') and inmueble <> initcap(inmueble);
