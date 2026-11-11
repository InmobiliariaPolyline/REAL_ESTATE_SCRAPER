# Scraper propio (InfoCasas) y cómo conectar otro programa (PHP con XAMPP, Python o Node)

El repositorio incluye un scraper de **InfoCasas** (carpeta `scraper/`) que corre gratis en GitHub Actions. El sistema, además,
recibe avisos con Apify. Esta guía explica el scraper incluido y sirve para que **cualquier otro programa que recolecte
avisos públicos** (un script en PHP corriendo en XAMPP, uno en Python, uno en Node…) los envíe al mismo sistema, que los
guarda sin duplicarlos y con los mismos filtros, fotos y detalles. Panorama general: [`ENTREGA.md`](ENTREGA.md).

> **Qué es XAMPP.** Es un paquete para Windows que instala Apache, MySQL y PHP en tu computador. **No es un
> scraper**: solo es el entorno donde puede correr un script escrito en PHP. Para esta guía solo necesitas el PHP
> que trae (`C:\xampp\php\php.exe`); no hace falta encender Apache ni MySQL, porque los datos se guardan en Neon
> (PostgreSQL) a través de la API del sistema.

> **Reglas de buen uso.** Recolecta solo avisos públicos, con un ritmo razonable (una petición cada pocos
> segundos), respeta el `robots.txt` y los términos de uso de cada portal, e identifícate con un nombre de
> programa claro. Este sistema no ayuda a esquivar bloqueos ni protecciones: si un portal no deja que tu programa
> lea sus páginas, no se fuerza (para esa fuente se usa Apify u otra vía autorizada).

## 1. Crear el token (una vez)

1. Inventa una clave larga y secreta (mínimo 24 caracteres), por ejemplo con
   `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
2. En **Netlify → Site configuration → Environment variables** crea `INGESTA_TOKEN` con ese valor, marcada como
   **secreta**, y vuelve a desplegar.
3. Guarda la misma clave en el computador donde corre el scraper (variable de entorno `INGESTA_TOKEN` o un archivo
   que **no** subas al repositorio).

Sin `INGESTA_TOKEN` el sistema responde `501` y no recibe nada.

## 2. El contrato: `POST /api/ingesta`

```
POST https://realestatescrapeer.netlify.app/api/ingesta
Authorization: Bearer <INGESTA_TOKEN>
Content-Type: application/json

{ "avisos": [ { ...aviso }, { ...aviso } ] }      // hasta 500 por envío
```

Respuesta: `{ "recibidos": 2, "guardados": 2, "descartados": 0 }`. Un token equivocado da `403`; un envío mal
formado, `400`.

### Campos de cada aviso

| Campo | Obligatorio | Detalle |
| --- | --- | --- |
| `portal` | sí | `adondevivir`, `urbania`, `infocasas`, `properati` o `babilonia` |
| `codigo` | sí | Código del aviso en el portal. Con el portal forma el identificador: el mismo aviso siempre se actualiza, no se duplica |
| `operacion` | sí | `VENTA` o `ALQUILER` |
| `inmueble` | sí | `Departamento`, `Casa`, `Terreno`, `Oficina`, `Local comercial`, `Proyecto`… |
| `titulo` | no | Texto del aviso |
| `precio`, `moneda` | no | Precio publicado y su moneda (`PEN` o `USD`) |
| `precioUsd` | no | Si el portal ya lo da; si no, se calcula |
| `distrito`, `provincia`, `departamento` | no | Si falta el departamento y el distrito es de Lima o del Callao, se deduce |
| `dormitorios`, `banios`, `estacionamientos` | no | Número o texto |
| `area` | no | Texto (`"85 m2"`) o número de m² |
| `antiguedad` | no | `"5 años"`, `"Estreno"` o el número de años |
| `imagen`, `imagenes` | no | Portada y lista de fotos (direcciones `https://`, hasta 20) |
| `url` | no | Dirección del aviso original |
| `descripcion`, `direccion`, `publicador` | no | Texto |
| `latitud`, `longitud`, `mantenimiento` | no | Números |
| `precioMax`, `unidades` | no | Solo proyectos (ver «Proyectos inmobiliarios»): precio más alto y lista de tipologías `[{ codigo, dormitorios, banios, area, precio }]` |

Lo que no se puede identificar (portal desconocido, sin código u operación inválida) se descarta y se cuenta en
`descartados`.

### Avisos retirados (`retirados`)

El envío puede incluir además `"retirados": [ { "portal": "infocasas", "codigo": "proyecto-madre-selva" } ]` (hasta 500): avisos
que el portal **ya no tiene**. El sistema los quita del catálogo para que nadie llegue a un «404» desde «Ver aviso». No se toca
un aviso que tenga favoritos o enlaces (igual que la limpieza de inactivos). La respuesta suma `retirados` con cuántos se
quitaron. Se puede enviar `avisos` vacío si solo hay retirados.

## 3. Probar la conexión sin raspar nada

Con el archivo de ejemplo `scraper/ejemplo-avisos.json`:

```bash
curl -X POST https://realestatescrapeer.netlify.app/api/ingesta \
  -H "Authorization: Bearer $INGESTA_TOKEN" \
  -H "Content-Type: application/json" \
  --data @scraper/ejemplo-avisos.json
```

## 3b. El scraper incluido (InfoCasas Perú)

La carpeta `scraper/` trae un scraper listo, escrito en Node (no necesita XAMPP, aunque puede convivir con él), que
lee los listados públicos de **InfoCasas Perú** y los envía a `POST /api/ingesta`. Cada página trae 21 avisos con
precio, fotos, descripción, dirección, coordenadas, anunciante y ubicación.

```bash
# 1) Probar sin enviar nada: muestra lo que leería
node scraper/scraper.mjs --probar --portal infocasas --paginas 1

# 2) Leer y enviar (5 páginas de cada búsqueda por defecto: departamentos, casas, terrenos, oficinas y locales, venta y alquiler en Lima)
$env:INGESTA_TOKEN = "tu-clave-larga"            # PowerShell
node scraper/scraper.mjs --portal infocasas --paginas 5

# Un distrito concreto (la ruta sale de la dirección de InfoCasas)
node scraper/scraper.mjs --busqueda venta/departamentos/lima/miraflores --paginas 10
```

Opciones: `--provincias` (suma Arequipa, La Libertad, Piura y Lambayeque), `--paginas N` (hasta 25 por búsqueda), `--busqueda RUTA` (se puede repetir), `--max N` (tope de avisos,
2000 por defecto), `--pausa S` (segundos entre peticiones, 5 por defecto, mínimo 3) y `--probar`.

**Cómo se porta:** un solo hilo, 5 segundos o más entre peticiones, se identifica como `ScraperPropio/1.0`, consulta
el `robots.txt` del portal antes de pedir cada página, y **se detiene** si el portal responde 403, 429 o un error del
servidor (no reintenta ni intenta esquivar nada). Cada página se envía apenas se lee.

Las direcciones de búsqueda de cada portal están en `docs/URLS_BUSQUEDA.md`.

### Proyectos inmobiliarios (edificios en construcción, condominios)

Un proyecto **no tiene un solo precio ni un solo tamaño**: ofrece varias tipologías («1 dormitorio, 54 m², US$ 108,700»
… «3 dormitorios, 66 m², US$ 130,600»). InfoCasas lo muestra como «Desde US$ 108,700 / Hasta US$ 130,600». El sistema
guarda **un aviso por proyecto**:

| Campo guardado | Qué es |
| --- | --- |
| `inmueble` | siempre `Proyecto` |
| `precio` | el precio más bajo («Desde») |
| `precio_max` | el precio más alto («Hasta»); vacío si todas cuestan lo mismo |
| `dormitorios`, `banios` | las cantidades que ofrece el proyecto: `1, 2, 3` |
| `area` | el rango: `54 – 66 m2` |
| `unidades` | la lista de tipologías (dormitorios, baños, área y precio de cada una) |

**Cómo llega InfoCasas.** El mismo proyecto aparece de dos formas, según el listado: como el proyecto mismo (`isProject`,
enlace `proyectos/b34`, con los datos de su tipología más pequeña) y como **una de sus tipologías** (enlace
`/b34/187068547`, con los datos de esa tipología solamente). Antes eso producía avisos de «Departamento» con el precio y el
tamaño de una sola tipología (el B34 salía a US$ 130,600 y 66 m², cuando el portal dice desde 108,700 hasta 130,600 y de
54 a 66 m²). Las dos formas traen `commercial_units` con **todas** las tipologías: el scraper las lee y guarda el
proyecto con el código `proyecto-<nombre>` (p. ej. `infocasas:proyecto-b34`), de modo que da igual por qué listado llegue.
Al guardar un proyecto se eliminan las copias antiguas que lo representaban por tipología (salvo las que tengan
favoritos o enlaces).

**Enlace del proyecto.** El botón «Ver aviso» abre la dirección del **proyecto tal como la publica el portal**
(`project.link`: `/proyectos/b34`, `/proyectos/grancentralcolonial`, `/proyectos/eco-park/3767`). No se arma con el nombre de una
tipología ni se recorta: el nombre de la tipología no siempre es el del proyecto y las direcciones armadas así daban «Oops! error
404» o una página genérica. Con Apify, que solo entrega el enlace de una tipología, se guarda ese enlace tal cual (el portal lo
redirige al proyecto).

**Proyectos con la página caída.** El portal puede seguir mostrando en sus listados un proyecto cuya propia página ya no existe
(«Oops! error 404»; en una lectura real, 12 de los 21 proyectos del listado general estaban así). Antes de enviar un proyecto, el
scraper comprueba su página (una petición por proyecto, con la misma pausa y respetando el `robots.txt`); si da 404, o redirige a la
página general de proyectos, no lo envía y lo reporta como retirado. Un 403, 429 o 5xx detiene el portal, como siempre.

**Precios ocultos.** Si el anunciante oculta el precio de una tipología, esa tipología no cuenta para el «Desde/Hasta»
(sigue en la lista, como «Consultar»). Si todas están ocultas, el proyecto queda sin precio, como en el portal.

**Dónde se ve.** En la tarjeta («Desde» y «Hasta»), en el detalle (precios, rangos y la tabla de tipologías con su precio
por m²) y en el panel de administración. Los filtros usan el «Desde» para el precio y encuentran el proyecto por
cualquiera de sus tipologías (un proyecto de 1 a 3 dormitorios aparece al filtrar por 2).

**Migración:** `db/014_proyectos.sql` agrega `precio_max`, `precio_max_usd` y `unidades`. Sin ejecutarla todo funciona
igual (se guarda el «Desde» y los rangos de dormitorios, baños y área); solo faltan el «Hasta» y la tabla de tipologías.

**Carga con Apify.** El actor de InfoCasas entrega un registro por tipología y no su lista completa: se agrupan por
proyecto dentro de una misma corrida, pero lo más exacto es la lectura del scraper propio (que trae la lista completa y
se corre lunes y jueves). Si se usan ambos, el resultado es el mismo aviso (`proyecto-<nombre>`).

**Pruebas:** `scraper/proyectos.test.ts` (22 proyectos reales de InfoCasas guardados en
`scraper/fixtures/infocasas-proyectos.json`) y `api/proyectos.test.ts` (de punta a punta contra una base real).

**Programarlo en la nube (recomendado, sin computador):** el workflow `.github/workflows/scraper.yml` corre el
scraper solo, lunes y jueves. Solo hay que crear el secreto `INGESTA_TOKEN` en GitHub (Settings → Secrets and
variables → Actions) y probarlo una vez con Actions → «Scraper propio (InfoCasas)» → Run workflow. Si InfoCasas
bloquea las IP de GitHub (403), el scraper se detiene y el workflow sale en rojo: en ese caso se usa el computador.

**Botón en el panel (Sistema → Carga de datos → «Scraper propio»):** ejecuta ese mismo workflow con un clic, muestra
si está en cola, en curso o terminado, y deja constancia en la auditoría. Para activarlo, en Netlify crea dos variables
(la primera, secreta) y vuelve a desplegar:

- `GITHUB_TOKEN`: en GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**. Elige
  solo este repositorio y el permiso **Actions: Read and write**. Ponle vencimiento y renuévalo cuando venza.
- `GITHUB_REPO`: `usuario/repositorio`, por ejemplo `InmobiliariaPolyline/REAL_ESTATE_SCRAPER`.

Sin esas variables el botón avisa qué falta y no ejecuta nada. Solo hay una ejecución a la vez.

**Programarlo en Windows (automático):** `.\scraper\programar-windows.ps1 -Token "tu-clave"` crea la tarea (lunes y jueves 8:00).

**Programarlo en Windows (a mano):** Programador de tareas → Crear tarea básica → acción «Iniciar un programa» con
`node` como programa y `scraper\scraper.mjs --portal infocasas --paginas 5` como argumentos, y «Iniciar en» la carpeta
del proyecto. La variable `INGESTA_TOKEN` debe estar definida para el usuario que ejecuta la tarea.

**Otros portales:** Urbania, Adondevivir y Properati bloquean (403) las peticiones automáticas, y este scraper no
las fuerza. Esas fuentes siguen entrando por Apify (Sistema → Carga de datos). Agregar otro portal que sí lo
permita es escribir su lector en `scraper/lib/portales.mjs` (ver `infocasas` como modelo, con pruebas en
`scraper/scraper.test.ts`).

## 4. Enviar desde PHP (XAMPP)

`scraper/enviar_avisos.php` toma un archivo JSON con avisos y lo envía en lotes. En tu scraper PHP, cuando
termines de leer los avisos de un portal, arma el arreglo y llama a esa función.

```bash
# Windows, con el PHP de XAMPP
set INGESTA_TOKEN=tu-clave-larga
set INGESTA_URL=https://realestatescrapeer.netlify.app/api/ingesta
C:\xampp\php\php.exe scraper\enviar_avisos.php scraper\ejemplo-avisos.json
```

Para dejarlo programado: **Programador de tareas de Windows → Crear tarea básica**, con la acción
«Iniciar un programa» apuntando a `C:\xampp\php\php.exe` y el argumento con la ruta de tu script.

## 5. Enviar desde Node o Python

- Node: `node scraper/enviar_avisos.mjs scraper/ejemplo-avisos.json` (mismas variables de entorno).
- Python: haz un `POST` con `requests.post(url, json={"avisos": lote}, headers={"Authorization": "Bearer " + token})`.

## 6. Entregarlo a otra persona

Para que quien reciba el repositorio lo tenga funcionando:

1. Que cree `INGESTA_TOKEN` en Netlify (paso 1) y lo guarde en el computador del scraper.
2. Que instale PHP (XAMPP o PHP suelto) o Node 20 o superior.
3. Que programe la ejecución (Programador de tareas en Windows o `cron` en Linux).
4. Que revise en **Sistema → Propiedades** que lleguen avisos nuevos (el contador sube) y que los
   portales de origen aparezcan en el filtro «Portales».
