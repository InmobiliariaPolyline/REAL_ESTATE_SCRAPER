# Direcciones de búsqueda por portal

Cada portal arma la dirección según la **operación** (venta, alquiler), el **tipo** de inmueble y el **lugar**.
Estas son las familias verificadas; la carga con Apify y el scraper propio ya las usan por defecto.

## Adondevivir
`https://www.adondevivir.com/{tipo}-en-{operacion}-en-{lugar}.html`

- tipo: `departamentos`, `casas`, `terrenos`, `locales-comerciales`, `oficinas`
- operacion: `venta`, `alquiler`
- lugar: `lima` (toda la provincia) o un distrito (`miraflores`, `san-isidro`, `lima-cercado`…)
- Ejemplos: `departamentos-en-venta-en-lima.html`, `casas-en-alquiler-en-miraflores.html`

## Urbania
`https://urbania.pe/buscar/{operacion}-de-{tipo}-en-{lugar}`

- operacion: `venta`, `alquiler`; tipo: `departamentos`, `casas`, `terrenos`, `locales-comerciales`, `oficinas`
- lugar: `lima--lima` o `{distrito}--lima--lima`
- Ejemplo: `https://urbania.pe/buscar/venta-de-departamentos-en-miraflores--lima--lima`

## InfoCasas Perú
`https://www.infocasas.com.pe/{operacion}/{tipo}/{lugar}` (paginación: `/pagina2`, `/pagina3`…)

- Generales: `/venta`, `/alquiler`, `/proyectos` (el listado de proyectos ya forma parte de las búsquedas del scraper propio)
- tipos: `departamentos`, `casas`, `terrenos`, `oficinas`, `locales-comerciales`
- Ejemplo: `venta/terrenos/lima`, `alquiler/oficinas/lima`

## Properati Perú
`https://www.properati.com.pe/s/{tipo}/{operacion}` (también `/s/{lugar}/{tipo}/{operacion}`)

- tipo: `departamento`, `casa`; operacion: `venta`, `alquiler`

## Cómo cambiarlas
- Apify: variables `CARGA_URLS` (Adondevivir), `CARGA_URLS_URBANIA`, `CARGA_URLS_INFOCASAS`
  (formato `operación|tipo|pe:lugar`) y `CARGA_URLS_PROPERATI`, separadas por comas.
- Scraper propio (InfoCasas): `--busqueda venta/terrenos/lima` (repetible; con `--provincias` suma Arequipa, La Libertad, Piura y Lambayeque).
- Cada corrida toma la siguiente búsqueda de la lista (rotación), por eso conviene que las listas sean largas.
