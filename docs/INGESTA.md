# Modelo de datos de los avisos y contrato de ingesta

Todo lo que entra al sistema termina en la tabla `public.propiedades`. Hay **dos caminos de entrada**, y los dos pasan por
el mismo código (`api/ingest.ts`), que normaliza y guarda sin duplicar:

| Camino | Quién lo usa | Guía |
| ------ | ------------ | ---- |
| `POST /api/ingesta` (con `INGESTA_TOKEN`) | El scraper propio de InfoCasas y cualquier otro programa (PHP, Python, Node…) | [`SCRAPER_PROPIO.md`](SCRAPER_PROPIO.md) |
| Webhook de Apify | La carga automática de Urbania, Adondevivir, Properati e InfoCasas | [`CARGA_APIFY.md`](CARGA_APIFY.md) |

**Recomendado:** enviar los avisos por `POST /api/ingesta`. Escribir directamente en la base (sección final) se saltaría la
normalización y solo conviene a un proceso que ya la haga por su cuenta.

## Qué hace el sistema con cada aviso

Antes de guardarlo, `normalizarAviso` (en `api/ingest.ts`):

- Construye el `id` estable `portal:código`: el mismo aviso siempre se actualiza, no se duplica.
- **Precio:** `precio` queda en la moneda publicada; `precio_usd` se calcula con el tipo de cambio si la fuente no lo trae
  (o si el que trae no cuadra con el publicado). Un precio claramente erróneo (una venta de US$ 145, un alquiler de
  US$ 357 000…) se guarda **sin precio**.
- **Tipo de inmueble:** se unifica (`Local comercial`, `Habitación`…) y se corrige por el título cuando el portal lo publica
  mal («Terreno» dentro de Casas). Los proyectos no se tocan.
- **Ubicación coherente:** departamento → provincia → distrito; un distrito de Lima o del Callao manda sobre lo que diga el
  portal, y una provincia puesta donde va el departamento («Cañete») se corrige.
- **Coordenadas** fuera del Perú (o «0, 0») se guardan vacías. **Fotos:** solo http(s), sin repetir, hasta 20, la portada
  primero. **Textos:** sin etiquetas HTML y con las entidades decodificadas.
- **Proyectos:** ver abajo.

## Columnas de `propiedades`

| Columna | Tipo | Regla |
| ------- | ---- | ----- |
| `id` | text (PK) | `portal:código`. Es la clave del UPSERT. |
| `portal` | text | En **minúsculas**: `properati`, `infocasas`, `babilonia`, `urbania`, `adondevivir`. |
| `operacion` | text | `VENTA` o `ALQUILER` (mayúsculas). |
| `inmueble` | text | `Departamento`, `Casa`, `Terreno`, `Oficina`, `Local comercial`, `Proyecto`… |
| `titulo`, `distrito`, `dormitorios`, `banios`, `area`, `imagen`, `url` | text | `url` e `imagen` deben ser http(s). |
| `departamento`, `provincia` | text | Región («Lima», «Arequipa») y ciudad/provincia para los filtros. Requieren `db/011_ubicacion.sql`. |
| `descripcion`, `direccion`, `estacionamientos`, `antiguedad`, `publicador` | text | Datos extra para la vista previa (requieren `db/009_detalles.sql`). `latitud`/`longitud` son `float8` y `mantenimiento` `numeric`. |
| `imagenes` | text[] | Todas las fotos del aviso (la portada va primero). Requiere `db/008_imagenes.sql`. |
| `precio` | numeric | Precio publicado, en la moneda de `moneda`. `0` si no tiene. En un proyecto, el **más bajo** («Desde»). |
| `moneda` | text | `PEN` o `USD`. |
| `precio_usd` | numeric | Precio normalizado a USD. `0` si no tiene. |
| `precio_max`, `precio_max_usd` | numeric | Solo proyectos: el precio más alto («Hasta»), en la moneda del aviso y en USD. Requieren `db/014_proyectos.sql`. |
| `unidades` | jsonb | Solo proyectos: tipologías `[{ codigo, dormitorios, banios, area, precio }]`. Requiere `db/014_proyectos.sql`. |
| `creado_en` | timestamptz | La primera vez que se vio el aviso. **No se sobrescribe** en las corridas siguientes. |
| `ultima_vista_en` | timestamptz | **Se refresca en cada corrida** en que el aviso sigue publicado. |

Sin las migraciones recomendadas u opcionales, el sistema guarda igual lo que puede y omite las columnas que faltan.

## Proyectos

Un proyecto (edificio en construcción, condominio) ofrece varias tipologías con precios y tamaños distintos, así que se
guarda **un aviso por proyecto** (`portal:proyecto-<nombre>`): `inmueble = 'Proyecto'`, `precio` = el más bajo,
`precio_max` = el más alto, `dormitorios`/`banios` con las cantidades que ofrece (`1, 2, 3`), `area` como rango
(`54 – 66 m2`) y `unidades` con la lista. Si un envío trae `unidades`, el sistema calcula de ellas el precio, el rango y las
cantidades. Las tipologías de dos avisos del mismo proyecto en una misma carga se unen. Detalle y ejemplo real (B34):
[`SCRAPER_PROPIO.md`](SCRAPER_PROPIO.md#proyectos-inmobiliarios-edificios-en-construcción-condominios).

## Por qué `ultima_vista_en` importa

- La **limpieza de inactivos** del panel elimina los avisos no vistos en N días. Si nadie actualiza esta columna, todo
  parecería inactivo; por eso el panel se niega a limpiar cuando no ve refrescos recientes.
- El **vigilante** usa `greatest(max(creado_en), max(ultima_vista_en))` para saber si la carga sigue viva y alertar si no hay
  actividad.

Las dos vías de entrada ya la refrescan solas.

## Escribir directamente en la base (avanzado)

Solo si el proceso ya normaliza precios, tipos y ubicación por su cuenta. Usa la cadena `DATABASE_URL` como secreto, nunca en
el código, y reintenta al conectar (Neon despierta el cómputo al primer intento).

```sql
insert into public.propiedades
  (id, portal, operacion, inmueble, titulo, precio, precio_usd, moneda,
   distrito, dormitorios, banios, area, imagen, url, creado_en, ultima_vista_en)
values
  (%(id)s, %(portal)s, %(operacion)s, %(inmueble)s, %(titulo)s, %(precio)s, %(precio_usd)s, %(moneda)s,
   %(distrito)s, %(dormitorios)s, %(banios)s, %(area)s, %(imagen)s, %(url)s, now(), now())
on conflict (id) do update set
  portal          = excluded.portal,
  operacion       = excluded.operacion,
  inmueble        = excluded.inmueble,
  titulo          = excluded.titulo,
  precio          = excluded.precio,
  precio_usd      = excluded.precio_usd,
  moneda          = excluded.moneda,
  distrito        = excluded.distrito,
  dormitorios     = excluded.dormitorios,
  banios          = excluded.banios,
  area            = excluded.area,
  imagen          = excluded.imagen,
  url             = excluded.url,
  ultima_vista_en = now();   -- creado_en NO se toca
```

## Verificación tras la primera corrida

```sql
select portal, count(*), max(ultima_vista_en) from public.propiedades group by portal;
```

En el panel, el Dashboard debe mostrar los avisos por portal y no el aviso de «sin actividad».
