# Contrato de ingesta del scraper

Guía para conectar el scraper (Python / GitHub Actions) a la base de Neon. El sistema solo
necesita que quien cargue los datos escriba en `public.propiedades` con estas reglas.

## Conexión

- Usa la connection string de Neon (`DATABASE_URL`) como **secret de GitHub Actions**. Nunca en el
  código ni en el repositorio.
- Neon suspende el cómputo por inactividad y lo reactiva solo al conectar; si el primer intento
  falla, reintenta con una pequeña espera (ver ejemplo).
- Para el ETL de solo lectura (Inmodata) crea un rol aparte con `select` (ver README).

## Columnas de `propiedades`

| Columna | Tipo | Regla |
| ------- | ---- | ----- |
| `id` | text (PK) | Identificador **estable** del aviso (p. ej. `portal` + código del aviso, o hash de la URL). Es la clave del UPSERT: el mismo aviso siempre debe producir el mismo `id`. |
| `portal` | text | En **minúsculas**: `properati`, `infocasas`, `babilonia`, `urbania`, `adondevivir`. |
| `operacion` | text | `VENTA` o `ALQUILER` (mayúsculas). |
| `inmueble` | text | `Departamento`, `Casa`, ... |
| `titulo`, `distrito`, `dormitorios`, `banios`, `area`, `imagen`, `url` | text | `url` e `imagen` deben ser http(s). |
| `precio` | numeric | Precio publicado, en la moneda de `moneda`. `0` si no tiene. |
| `moneda` | text | `PEN` o `USD`. |
| `precio_usd` | numeric | Precio normalizado a USD con el tipo de cambio de SUNAT. `0` si no tiene. |
| `creado_en` | timestamptz | La primera vez que se vio el aviso. **No se debe sobrescribir** en las corridas siguientes. |
| `ultima_vista_en` | timestamptz | **Debe refrescarse en cada corrida** en que el aviso sigue publicado. |

## Por qué `ultima_vista_en` es obligatoria

- La **limpieza de inactivos** del panel elimina los avisos no vistos en N días. Si el scraper
  no actualiza esta columna, todo parecería inactivo. Por eso la API se niega a limpiar cuando no
  ve refrescos recientes.
- El **watchdog** usa `greatest(max(creado_en), max(ultima_vista_en))` para saber si el scraper
  sigue vivo y alertar si no hay actividad.

## UPSERT recomendado

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

## Ejemplo en Python (psycopg 3)

```python
import os, time
import psycopg

UPSERT = "...la sentencia de arriba..."

def connect(retries=3):
    for attempt in range(retries):
        try:
            return psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=15)
        except psycopg.OperationalError:
            if attempt == retries - 1:
                raise
            time.sleep(3 * (attempt + 1))   # Neon despierta el cómputo al primer intento

def guardar(avisos: list[dict]) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.executemany(UPSERT, avisos)      # un solo lote por corrida
        conn.commit()
```

## Verificación tras la primera corrida

```sql
select portal, count(*), max(ultima_vista_en) from public.propiedades group by portal;
```

En el panel, el Dashboard debe mostrar "Scraper: Activo" y los avisos por portal.
