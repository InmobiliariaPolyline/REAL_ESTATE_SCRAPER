# Conectar un scraper propio (PHP con XAMPP, Python o Node)

El sistema ya recibe avisos con Apify. Esta guía sirve para que **cualquier otro programa que recolecte avisos
públicos** (un script en PHP corriendo en XAMPP, uno en Python, uno en Node…) los envíe al mismo sistema, que los
guarda sin duplicarlos y con los mismos filtros, fotos y detalles.

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

Lo que no se puede identificar (portal desconocido, sin código u operación inválida) se descarta y se cuenta en
`descartados`.

## 3. Probar la conexión sin raspar nada

Con el archivo de ejemplo `scraper/ejemplo-avisos.json`:

```bash
curl -X POST https://realestatescrapeer.netlify.app/api/ingesta \
  -H "Authorization: Bearer $INGESTA_TOKEN" \
  -H "Content-Type: application/json" \
  --data @scraper/ejemplo-avisos.json
```

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
