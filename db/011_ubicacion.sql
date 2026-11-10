-- =============================================================================
-- Ubicación de los avisos: departamento (región) y provincia (ciudad)
--
-- Requiere: db/001_schema.sql. Es idempotente.
--
--   propiedades.departamento   p. ej. «Lima», «Arequipa», «Callao»
--   propiedades.provincia      p. ej. «Lima», «Callao»
--
-- La carga nueva los guarda con lo que entrega cada portal. Para los avisos que ya estaban
-- guardados se deducen del distrito cuando es de Lima Metropolitana o del Callao, y de paso se
-- unifican los nombres de distrito escritos de otra forma («Santiago De Surco», «Surco»).
-- Sin esta migración todo sigue funcionando; solo faltan esos filtros.
-- =============================================================================

alter table public.propiedades
  add column if not exists departamento text,
  add column if not exists provincia text;

create index if not exists propiedades_departamento_idx on public.propiedades (departamento);
create index if not exists propiedades_provincia_idx on public.propiedades (provincia);

with nombres (clave, nombre, departamento, provincia) as (
  values
    ('ancon', 'Ancón', 'Lima', 'Lima'),
    ('ate', 'Ate', 'Lima', 'Lima'),
    ('barranco', 'Barranco', 'Lima', 'Lima'),
    ('brena', 'Breña', 'Lima', 'Lima'),
    ('carabayllo', 'Carabayllo', 'Lima', 'Lima'),
    ('chaclacayo', 'Chaclacayo', 'Lima', 'Lima'),
    ('chorrillos', 'Chorrillos', 'Lima', 'Lima'),
    ('cieneguilla', 'Cieneguilla', 'Lima', 'Lima'),
    ('comas', 'Comas', 'Lima', 'Lima'),
    ('el agustino', 'El Agustino', 'Lima', 'Lima'),
    ('independencia', 'Independencia', 'Lima', 'Lima'),
    ('jesus maria', 'Jesús María', 'Lima', 'Lima'),
    ('la molina', 'La Molina', 'Lima', 'Lima'),
    ('la victoria', 'La Victoria', 'Lima', 'Lima'),
    ('lima', 'Lima', 'Lima', 'Lima'),
    ('lince', 'Lince', 'Lima', 'Lima'),
    ('los olivos', 'Los Olivos', 'Lima', 'Lima'),
    ('lurigancho', 'Lurigancho', 'Lima', 'Lima'),
    ('lurin', 'Lurín', 'Lima', 'Lima'),
    ('magdalena del mar', 'Magdalena del Mar', 'Lima', 'Lima'),
    ('miraflores', 'Miraflores', 'Lima', 'Lima'),
    ('pachacamac', 'Pachacámac', 'Lima', 'Lima'),
    ('pucusana', 'Pucusana', 'Lima', 'Lima'),
    ('pueblo libre', 'Pueblo Libre', 'Lima', 'Lima'),
    ('puente piedra', 'Puente Piedra', 'Lima', 'Lima'),
    ('punta hermosa', 'Punta Hermosa', 'Lima', 'Lima'),
    ('punta negra', 'Punta Negra', 'Lima', 'Lima'),
    ('rimac', 'Rímac', 'Lima', 'Lima'),
    ('san bartolo', 'San Bartolo', 'Lima', 'Lima'),
    ('san borja', 'San Borja', 'Lima', 'Lima'),
    ('san isidro', 'San Isidro', 'Lima', 'Lima'),
    ('san juan de lurigancho', 'San Juan de Lurigancho', 'Lima', 'Lima'),
    ('san juan de miraflores', 'San Juan de Miraflores', 'Lima', 'Lima'),
    ('san luis', 'San Luis', 'Lima', 'Lima'),
    ('san martin de porres', 'San Martín de Porres', 'Lima', 'Lima'),
    ('san miguel', 'San Miguel', 'Lima', 'Lima'),
    ('santa anita', 'Santa Anita', 'Lima', 'Lima'),
    ('santa maria del mar', 'Santa María del Mar', 'Lima', 'Lima'),
    ('santa rosa', 'Santa Rosa', 'Lima', 'Lima'),
    ('santiago de surco', 'Santiago de Surco', 'Lima', 'Lima'),
    ('surquillo', 'Surquillo', 'Lima', 'Lima'),
    ('villa el salvador', 'Villa El Salvador', 'Lima', 'Lima'),
    ('villa maria del triunfo', 'Villa María del Triunfo', 'Lima', 'Lima'),
    ('callao', 'Callao', 'Callao', 'Callao'),
    ('bellavista', 'Bellavista', 'Callao', 'Callao'),
    ('carmen de la legua reynoso', 'Carmen de la Legua Reynoso', 'Callao', 'Callao'),
    ('la perla', 'La Perla', 'Callao', 'Callao'),
    ('la punta', 'La Punta', 'Callao', 'Callao'),
    ('mi peru', 'Mi Perú', 'Callao', 'Callao'),
    ('ventanilla', 'Ventanilla', 'Callao', 'Callao'),
    ('lima cercado', 'Lima', 'Lima', 'Lima'),
    ('cercado de lima', 'Lima', 'Lima', 'Lima'),
    ('magdalena', 'Magdalena del Mar', 'Lima', 'Lima'),
    ('chosica', 'Lurigancho', 'Lima', 'Lima'),
    ('lurigancho chosica', 'Lurigancho', 'Lima', 'Lima'),
    ('ate vitarte', 'Ate', 'Lima', 'Lima'),
    ('carmen de la legua', 'Carmen de la Legua Reynoso', 'Callao', 'Callao'),
    ('villa maria del triunfo', 'Villa María del Triunfo', 'Lima', 'Lima'),
    ('san juan lurigancho', 'San Juan de Lurigancho', 'Lima', 'Lima'),
    ('surco', 'Santiago de Surco', 'Lima', 'Lima')
)
update public.propiedades p
   set distrito = n.nombre,
       departamento = coalesce(p.departamento, n.departamento),
       provincia = coalesce(p.provincia, n.provincia)
  from nombres n
 where p.distrito is not null
   and translate(lower(regexp_replace(trim(p.distrito), '\s+', ' ', 'g')), 'áéíóúüñ', 'aeiouun') = n.clave;
