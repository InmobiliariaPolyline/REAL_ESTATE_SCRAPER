# Guía de entrega y mantenimiento

Para quien recibe el sistema. Aquí está lo que hay que saber para mantenerlo funcionando sin haber participado en
construirlo. Los detalles de cada parte están en las otras guías (enlazadas); esta es el mapa.

## 1. Qué es y de qué se compone

Un portal web por suscripción con avisos inmobiliarios de Perú. Se compone de servicios externos, casi todos con plan
gratuito:

| Servicio | Para qué | Dónde se configura |
| -------- | -------- | ------------------ |
| **Netlify** | Publica el sitio y la API (una función) y corre tres tareas programadas | Variables de entorno del sitio; despliega solo al subir a `main` |
| **Neon** (PostgreSQL) | Toda la información: avisos, usuarios, suscripciones, sesiones | Cadena `DATABASE_URL` en Netlify |
| **GitHub** | El código, las pruebas (CI), el **scraper propio de InfoCasas** y el **respaldo diario** | Pestaña *Actions* y secretos del repositorio |
| **Apify** | Carga de avisos de Urbania, Adondevivir y Properati (y de InfoCasas como alternativa) | Variables `APIFY_*` en Netlify; panel *Sistema → Carga de datos* |
| **Cloudinary** (opcional) | Guarda una copia de las portadas | Variable `CLOUDINARY_URL` en Netlify |

El mapa completo de carpetas y tareas programadas está en el [README](../README.md#estructura).

## 2. Credenciales: quién necesita qué

Nunca se suben al repositorio ni se pegan en chats. Si alguna se filtra, se rota de inmediato (pasos en
[`SEGURIDAD.md`](SEGURIDAD.md#3-credenciales-dónde-viven-y-cada-cuánto-rotarlas)).

| Credencial | Dónde vive | Qué hace |
| ---------- | ---------- | -------- |
| `DATABASE_URL` | Netlify (secreta) | Conexión de la app a Neon |
| `INGESTA_TOKEN` | Netlify **y** secreto de GitHub (el mismo valor) | Autoriza al scraper propio a enviar avisos |
| `GITHUB_TOKEN`, `GITHUB_REPO` | Netlify | El botón «Ejecutar scraper propio» del panel. Token fino de GitHub, solo este repositorio, permiso **Actions: Read and write**; **vence**: hay que renovarlo |
| `APIFY_TOKEN`, `APIFY_WEBHOOK_SECRET` | Netlify (secretas) | Carga con Apify |
| `CLOUDINARY_URL` | Netlify (secreta) | Copia de portadas |
| `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` | Secretos de GitHub | Respaldo diario cifrado (guarda la frase también fuera de GitHub) |
| `ALERT_WEBHOOK_URL`, `CRON_SECRET` | Netlify (secretas) | Alertas por webhook |

## 3. Primera puesta en marcha (lista)

1. **Neon:** crear el proyecto y aplicar todas las migraciones (`pnpm db:migrate`). Crear el primer administrador.
   ([README → Base de datos](../README.md#1-base-de-datos-neon))
2. **Netlify:** conectar el repositorio (rama `main`) y definir `DATABASE_URL`. Comprobar `/api/health`.
3. **Scraper propio:** crear `INGESTA_TOKEN` en Netlify y en GitHub; probarlo una vez desde *Actions → Scraper propio
   (InfoCasas) → Run workflow* ([`SCRAPER_PROPIO.md`](SCRAPER_PROPIO.md)). Para el botón del panel, crear `GITHUB_TOKEN` y
   `GITHUB_REPO`.
4. **Apify** (si se usa): token y secreto en Netlify, primera prueba con un máximo pequeño y recién después activar la carga
   automática ([`CARGA_APIFY.md`](CARGA_APIFY.md)). **No guardar tarjeta en Apify.**
5. **Respaldo:** crear los dos secretos de respaldo y lanzar el workflow una vez a mano. Hacer un simulacro de restauración
   ([`SEGURIDAD.md`](SEGURIDAD.md#5-respaldos)).
6. **Cloudinary** (opcional): [`FOTOS_CLOUDINARY.md`](FOTOS_CLOUDINARY.md).

## 4. Rutina de mantenimiento

**Cada semana** (5 minutos)
- *Sistema → Carga de datos → Scraper propio*: la última ejecución debe estar «Completada». Si no, ver la sección 5.
- El Dashboard no debe mostrar el aviso de «sin actividad del scraper».

**Cada mes**
- *Actions → Respaldo de la base de datos*: hay ejecuciones recientes en verde. Descargar un respaldo y guardarlo aparte.
- Gasto de Apify (si se usa) y uso de Cloudinary dentro de sus límites.
- *Sistema → Auditoría*: revisar que nadie tenga acceso de administrador sin necesitarlo.
- Renovar el `GITHUB_TOKEN` si está por vencer.

**Cada trimestre**
- Simulacro de restauración de un respaldo en una rama de Neon.
- Rotar credenciales según la tabla de [`SEGURIDAD.md`](SEGURIDAD.md).

## 5. Si algo falla

| Síntoma | Causa probable | Qué hacer |
| ------- | -------------- | --------- |
| «El token no tiene permiso de Actions» al pulsar *Ejecutar scraper propio* | El token de GitHub no tiene **Actions: Read and write** sobre el repositorio, o es otro token | En GitHub → *Settings → Developer settings → Fine-grained tokens*: el token debe tener acceso a *Only select repositories → este repositorio* y el permiso Actions en lectura y escritura. Si se regenera, actualizar `GITHUB_TOKEN` en Netlify y desplegar |
| «GitHub rechazó el token» | El token venció | Crear uno nuevo y actualizar `GITHUB_TOKEN` |
| El scraper propio sale en rojo con 403 | InfoCasas bloqueó las direcciones de GitHub | El scraper se detiene a propósito y no reintenta. Probar más tarde o correrlo desde un computador ([`SCRAPER_PROPIO.md`](SCRAPER_PROPIO.md)) |
| Aviso amarillo «Falta conectar Apify» | Faltan `APIFY_TOKEN` o `APIFY_WEBHOOK_SECRET`, o no se redesplegó | Ver [`CARGA_APIFY.md`](CARGA_APIFY.md#si-algo-falla) |
| No entran avisos nuevos / alerta del vigilante | El scraper o Apify no corrieron | Revisar *Actions* y *Sistema → Carga de datos*; lanzar una corrida a mano |
| «Ocurrió un error inesperado» al abrir una pantalla | Un error de la interfaz con algún dato raro | Recargar con Ctrl+F5; si persiste, abrir la consola del navegador (F12) y anotar el mensaje. Todo error nuevo debe llevar una prueba (ver sección 6) |
| La publicación no se actualiza | La compilación falló (tipos o pruebas) | Mirar el resultado de *Actions → CI* y el registro de *Deploys* en Netlify |
| La base responde lento la primera vez | Neon suspende el cómputo por inactividad y lo despierta al primer uso | Normal; reintentar |

## 6. Cómo hacer cambios sin romper nada

**Flujo acordado**

1. Hacer el cambio y correr `pnpm check`, `pnpm test` y `pnpm build`.
2. Subir la versión en `package.json` **y** agregar su entrada arriba de todo en `client/src/lib/changelog.ts` (una prueba
   verifica que coincidan). Es lo que se muestra en *Sistema → Acerca del sistema*.
3. Commit y subida a `main`: Netlify despliega solo. Las migraciones nuevas se ejecutan a mano en Neon.

**Convenciones**
- Interfaz y textos en español; iconos de lucide, **sin emojis**; colores con los tokens de `client/src/index.css`.
- Los precios se muestran como los publicó el portal; las conversiones van aparte y marcadas como aproximadas.
- Todo comportamiento nuevo lleva pruebas. Las de scraping usan **datos reales** guardados en `scraper/fixtures/`; las de la
  API corren contra un Postgres de verdad (PGlite). Un error que se corrige debe llevar la prueba que lo habría detectado.
- Una prueba (`docs/docs.test.ts`) verifica que las guías no se desactualicen: si agregas una migración, una variable de
  entorno o mueves un archivo citado, el CI avisa qué documento actualizar.

**Dónde mirar según lo que quieras cambiar**

| Quiero cambiar… | Mirar |
| --------------- | ----- |
| Qué filtros hay y cómo se aplican | `api/propertyQueries.ts`, `shared/filters.ts`, `client/src/components/filters/` |
| Cómo se leen los avisos de InfoCasas | `scraper/lib/portales.mjs` (y `scraper/proyectos.test.ts`) |
| Cómo se leen los de Apify | `api/carga.ts` |
| Cómo se limpia o corrige un aviso al guardarlo | `api/ingest.ts`, `shared/ubicacion.ts`, `shared/tipoInmueble.ts` |
| Cómo se muestra un aviso (tarjeta, detalle) | `client/src/components/properties/PropertyCard.tsx`, `client/src/components/portal/PropertyDetailModal.tsx` |
| Colores, tipografías y tamaños | `client/src/index.css` |
| Reglas de acceso, sesiones y contraseñas | `api/auth.ts`, `db/002_auth.sql` |
| Las tareas programadas | `netlify/functions/` y `.github/workflows/` |

## 7. Decisiones y límites a tener presentes

- **El scraping directo se limita a InfoCasas.** Urbania, Adondevivir y Properati responden 403 a las lecturas automáticas
  (usan un desafío anti-robots) y el sistema **no** intenta esquivarlo: no es una vía autorizada y se rompería con cada
  cambio del portal. Esas fuentes entran por Apify. La ampliación del scraping se dio por cerrada: más cobertura implicaría
  un plan de pago de Apify o un acuerdo de datos con los portales.
- **No hay datos abiertos que sustituyan los avisos actuales.** Se evaluaron los de Properati y un conjunto académico de 2023:
  son históricos y pequeños.
- **Las fotos son de terceros.** La copia de portadas a Cloudinary es un uso más fuerte que enlazarlas; revisar los términos
  de cada portal antes de comercializar.
- **Un proyecto no tiene un solo precio:** el sistema guarda el rango «Desde–Hasta» y las tipologías; con Apify el rango solo
  es exacto si llegan todas las tipologías en la misma corrida. Para InfoCasas la fuente exacta es el scraper propio.

## 8. Ideas para seguir mejorando

Sugerencias, no compromisos: análisis de mercado (tendencias, avisos que bajaron de precio, oportunidades bajo la mediana),
alertas a los clientes cuando entra un aviso de una búsqueda guardada, detección de avisos duplicados entre portales y de
avisos que ya no están publicados, mapa de avisos, y más pulido de la interfaz.
