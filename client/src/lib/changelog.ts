export type CambioTipo = "implementacion" | "mejora" | "correccion" | "seguridad"

export interface Cambio {
  tipo: CambioTipo
  texto: string
}

export interface Version {
  version: string
  /** Fecha de la versión (AAAA-MM-DD). */
  fecha: string
  titulo: string
  cambios: Cambio[]
}

export const TIPOS: Record<CambioTipo, { label: string; plural: string }> = {
  implementacion: { label: "Implementación", plural: "Implementaciones" },
  mejora: { label: "Mejora", plural: "Mejoras" },
  correccion: { label: "Corrección", plural: "Correcciones" },
  seguridad: { label: "Seguridad", plural: "Seguridad" },
}

/** Historial de versiones, de la más reciente a la más antigua. */
export const VERSIONES: Version[] = [
  {
    version: "2.13.0",
    fecha: "2026-11-10",
    titulo: "Tipo de inmueble razonado y avisos sin precio",
    cambios: [
      { tipo: "implementacion", texto: "El sistema ahora razona el tipo de inmueble leyendo el título: corrige avisos mal clasificados por el portal («Terreno - La Molina» publicado como Casa, «Casa de playa» como Departamento, «Edificio comercial» como Local) y solo cambia el tipo cuando el título lo contradice con claridad; ante la duda respeta al portal. Aplica a todas las fuentes." },
      { tipo: "mejora", texto: "No cuenta como tipo lo que es un lugar, un uso o un extra: «local en edificio», «casa para oficina», «casa como terreno», «3 dormitorios y cochera» o «casa club»." },
      { tipo: "correccion", texto: "Un aviso sin precio ya no muestra «S/ 0» ni «USD 0»: la tarjeta, la tabla y la vista previa dicen «Sin precio», sin símbolo de moneda. En la vista previa se explica que el anunciante no publicó un precio y se reemplaza el bloque de cuota y financiamiento por esa aclaración en lugar de una lista de guiones." },
    ],
  },
  {
    version: "2.12.0",
    fecha: "2026-11-10",
    titulo: "Botón del scraper propio en Carga de datos",
    cambios: [
      { tipo: "implementacion", texto: "Nueva tarjeta «Scraper propio» en Sistema → Carga de datos, junto a la de Apify: un botón que ejecuta el scraper en GitHub (sin computador encendido ni créditos de Apify), con las páginas por búsqueda a elegir, el estado de las últimas ejecuciones y un enlace a cada una." },
      { tipo: "mejora", texto: "La tarjeta muestra qué entidades cubre cada vía: InfoCasas con el scraper propio y con Apify; Urbania, Adondevivir y Properati solo con Apify (bloquean las lecturas automáticas) con todas sus direcciones de venta, alquiler y tipo." },
      { tipo: "seguridad", texto: "Solo el administrador puede ejecutarlo, se deja constancia en la auditoría, no se lanza una ejecución si ya hay otra en curso y el token de GitHub nunca llega al navegador. Requiere las variables GITHUB_TOKEN y GITHUB_REPO en Netlify (ver docs/SCRAPER_PROPIO.md)." },
    ],
  },
  {
    version: "2.11.0",
    fecha: "2026-11-10",
    titulo: "Auditoría de datos y pruebas con avisos reales",
    cambios: [
      { tipo: "correccion", texto: "El filtro de distrito ya no mezcla distritos: «Miraflores» traía también «San Juan de Miraflores». Un distrito oficial de Lima o del Callao se compara exacto; el texto parcial sigue buscando por coincidencia." },
      { tipo: "correccion", texto: "Las coordenadas «0, 0» (o fuera de Perú) que entregan algunos avisos se guardan vacías en lugar de ubicar el aviso en el océano. Aplica a todos los portales." },
      { tipo: "correccion", texto: "Los precios que son un error de tipeo evidente (una venta de US$ 145, un local de US$ 1 500 millones, un departamento a US$ 1,5 millones el m²) se guardan sin precio para no distorsionar medianas ni comparaciones." },
      { tipo: "correccion", texto: "El área de InfoCasas se corrige cuando el portal la entrega mal escalada (218.000 m² llegaba como 218 000), usa la superficie del terreno si no hay construida y se deja vacía si es absurda." },
      { tipo: "correccion", texto: "Los tipos de inmueble se unifican con su nombre oficial («Local Comercial» y «Local comercial» eran dos filtros distintos). La migración opcional db/012_tipos.sql corrige los ya guardados." },
      { tipo: "implementacion", texto: "Nueva prueba de punta a punta con 174 avisos reales de InfoCasas: lector, entrada /api/ingesta, base de datos y API del portal (filtros, orden, detalle, facetas, exportación), comprobando que nada se pierde ni se deforma." },
    ],
  },
  {
    version: "2.10.2",
    fecha: "2026-11-10",
    titulo: "Proyectos de InfoCasas bien clasificados",
    cambios: [
      { tipo: "correccion", texto: "Los proyectos inmobiliarios de InfoCasas se guardaban como «Departamento» con los datos de una sola tipología (p. ej. 3 dormitorios y S/ 489 750). Ahora se guardan como «Proyecto» con lo que muestra el portal: precio «desde», dormitorios, baños y área mínimos, estado de construcción y la descripción del proyecto." },
      { tipo: "correccion", texto: "Las direcciones de fotos de InfoCasas ya no llevan el sufijo «#HASTH»." },
    ],
  },
  {
    version: "2.10.1",
    fecha: "2026-11-10",
    titulo: "Diagnóstico de la copia de portadas",
    cambios: [
      { tipo: "mejora", texto: "El registro de la función copiar-portadas ahora incluye el motivo de la primera copia fallida (permisos de la clave, foto inexistente, etc.)." },
    ],
  },
  {
    version: "2.10.0",
    fecha: "2026-11-10",
    titulo: "Portadas propias en Cloudinary",
    cambios: [
      { tipo: "implementacion", texto: "Nueva función programada que, cada hora, copia a Cloudinary (plan gratis) las portadas de los avisos, reducidas a 720 px, para que sigan viéndose aunque el portal borre el aviso. Se activa con la variable CLOUDINARY_URL; sin ella no cambia nada." },
      { tipo: "mejora", texto: "Una nueva lectura del portal ya no reemplaza una portada que ya fue copiada. Si una copia falla, el aviso conserva la foto original." },
      { tipo: "implementacion", texto: "Guía docs/FOTOS_CLOUDINARY.md con los pasos y los límites del plan gratis." },
    ],
  },
  {
    version: "2.9.1",
    fecha: "2026-11-10",
    titulo: "Scraper automático en la nube",
    cambios: [
      { tipo: "implementacion", texto: "Nuevo workflow de GitHub Actions que ejecuta el scraper de InfoCasas lunes y jueves sin depender de ningún computador; solo necesita el secreto INGESTA_TOKEN." },
    ],
  },
  {
    version: "2.9.0",
    fecha: "2026-11-10",
    titulo: "Scraper propio: provincias y programación",
    cambios: [
      { tipo: "implementacion", texto: "Nueva opción --provincias en el scraper: suma Arequipa, La Libertad, Piura, Lambayeque y la sección de proyectos de InfoCasas (rutas verificadas)." },
      { tipo: "implementacion", texto: "Nuevo script scraper/programar-windows.ps1 que crea la tarea programada de Windows (lunes y jueves) y guarda el token como variable del usuario." },
    ],
  },
  {
    version: "2.8.0",
    fecha: "2026-11-10",
    titulo: "Búsquedas por operación, tipo y distrito",
    cambios: [
      { tipo: "mejora", texto: "La carga de Adondevivir y Urbania ahora recorre 61 búsquedas cada una: venta y alquiler de departamentos, casas, terrenos, locales y oficinas en Lima, más departamentos y casas en 14 distritos." },
      { tipo: "mejora", texto: "Properati usa las direcciones exactas de departamentos y casas, venta y alquiler." },
      { tipo: "mejora", texto: "El scraper propio de InfoCasas suma terrenos, oficinas y locales comerciales (venta y alquiler) a sus búsquedas por defecto." },
      { tipo: "implementacion", texto: "Nueva guía docs/URLS_BUSQUEDA.md con la forma de las direcciones de cada portal según venta, alquiler, tipo y lugar." },
    ],
  },
  {
    version: "2.7.0",
    fecha: "2026-11-10",
    titulo: "Scraper propio de InfoCasas",
    cambios: [
      { tipo: "implementacion", texto: "Nuevo scraper propio (Node) que lee los listados públicos de InfoCasas Perú —21 avisos por página con precio, fotos, descripción, dirección, coordenadas y anunciante— y los envía al sistema por la entrada protegida." },
      { tipo: "mejora", texto: "Se porta con cuidado: una petición a la vez con pausas, consulta el robots.txt del portal antes de cada página y se detiene si responde 403, 429 o error del servidor, sin reintentar ni esquivar." },
      { tipo: "mejora", texto: "Documentado en docs/SCRAPER_PROPIO.md, con modo de prueba (--probar), búsquedas por distrito y cómo programarlo en Windows." },
    ],
  },
  {
    version: "2.6.0",
    fecha: "2026-11-10",
    titulo: "Entrada para scrapers propios (PHP, Python o Node)",
    cambios: [
      { tipo: "implementacion", texto: "Nueva entrada protegida con clave, POST /api/ingesta, para que cualquier scraper propio (por ejemplo un script PHP corriendo con XAMPP) envíe avisos al sistema: se guardan sin duplicar, con fotos, detalles y ubicación, igual que con Apify." },
      { tipo: "mejora", texto: "Se agrega la carpeta scraper/ con un envío listo en PHP y en Node, un archivo de ejemplo y la guía docs/SCRAPER_PROPIO.md (crear la clave, probar la conexión, programar la tarea y entregarlo a otra persona)." },
    ],
  },
  {
    version: "2.5.0",
    fecha: "2026-11-10",
    titulo: "Los filtros ofrecen todo el Perú, haya o no avisos",
    cambios: [
      { tipo: "mejora", texto: "Departamento, ciudad o provincia, distrito y tipo de inmueble ya no dependen de los datos disponibles: se ofrecen los 25 departamentos, las 196 provincias, los distritos de Lima, el Callao y de las ciudades principales, y todos los tipos de inmueble." },
      { tipo: "mejora", texto: "Cada opción muestra cuántos avisos tiene (0 si aún no hay); primero van las que tienen avisos y después el resto por orden alfabético. Al elegir un departamento, sus provincias y distritos se ofrecen aunque aún no tenga avisos." },
      { tipo: "mejora", texto: "Si en el catálogo aparece un lugar o tipo que no estaba en la lista completa, se agrega solo; y si no se puede consultar el catálogo, las listas completas siguen disponibles. Lo mismo en Propiedades del administrador." },
    ],
  },
  {
    version: "2.4.1",
    fecha: "2026-11-10",
    titulo: "Los precios se muestran en soles por defecto",
    cambios: [
      { tipo: "correccion", texto: "Las tarjetas de Propiedades (administración) mostraban el precio en la moneda en que se publicó cada aviso, casi siempre dólares. Ahora muestran soles; el equivalente en dólares se ve al hacer clic en la tarjeta (con un selector Soles/Dólares)." },
      { tipo: "correccion", texto: "Un aviso publicado en dólares se leía como si fuera en soles (US$ 400 000 aparecía como S/ 400 000). Ahora se convierte al tipo de cambio y se marca con «~»; lo mismo en la comparación, la tabla, el Inicio y el historial de precios." },
      { tipo: "correccion", texto: "El rango de precio y el orden por precio en soles también confundían los avisos publicados en dólares con los publicados en soles; ahora comparan en la misma moneda." },
      { tipo: "mejora", texto: "El rango de precio del panel de administración y la calculadora parten de soles." },
    ],
  },
  {
    version: "2.4.0",
    fecha: "2026-11-10",
    titulo: "Nueva ventana de filtros: todo a la vista",
    cambios: [
      { tipo: "implementacion", texto: "La ventana de filtros se rediseñó por completo: ya no hay «Más filtros» oculto, todos los bloques están a la vista (palabra clave, operación, tipo, ubicación, precio, ambientes y cocheras, área, antigüedad, portales, anunciante y publicación)." },
      { tipo: "implementacion", texto: "En pantallas anchas la ventana queda a la izquierda y siempre visible al desplazar los resultados; en el celular sigue siendo un panel lateral con el botón Buscar fijo abajo." },
      { tipo: "mejora", texto: "Opciones como fichas con icono (operación, tipo con la cantidad de avisos, dormitorios, baños, cocheras, antigüedad, publicación), portales como etiquetas de color y distritos con más avisos con un solo clic." },
      { tipo: "mejora", texto: "El total de avisos se actualiza en vivo mientras eliges filtros, antes de pulsar Buscar; hay atajos de precio y de área, y los chips se quitan al instante." },
      { tipo: "mejora", texto: "Propiedades del administrador usa la misma ventana de filtros, con todos los bloques a la vista." },
    ],
  },
  {
    version: "2.3.1",
    fecha: "2026-11-10",
    titulo: "Los filtros nuevos también están en el panel de administración",
    cambios: [
      { tipo: "correccion", texto: "Los filtros de departamento, ciudad, tipo, cocheras, antigüedad, anunciante y demás solo se habían puesto en el catálogo de los clientes: ahora Propiedades (administración) tiene el mismo desglose «Más filtros»." },
      { tipo: "mejora", texto: "El panel y el catálogo comparten la misma lógica de filtrado y los mismos campos, así que se comportan igual." },
      { tipo: "mejora", texto: "Las búsquedas guardadas del administrador siguen guardando distrito, operación, portal y precio; al guardar con filtros de «Más filtros» puestos, se avisa de que esos no se guardan." },
    ],
  },
  {
    version: "2.3.0",
    fecha: "2026-11-10",
    titulo: "Filtros por departamento, ciudad, tipo, cocheras y más",
    cambios: [
      { tipo: "implementacion", texto: "Nuevos filtros con datos que entregan los portales: departamento (región), ciudad o provincia, tipo de inmueble (departamento, casa, terreno, oficina…), cocheras, antigüedad máxima (desde «estreno»), anunciante y «solo avisos con precio»." },
      { tipo: "mejora", texto: "Las listas de departamento, provincia, tipo y anunciante salen de lo que realmente hay en el catálogo, con la cantidad de avisos de cada una; el distrito sugiere los que existen y las provincias se limitan al departamento elegido." },
      { tipo: "mejora", texto: "Los distritos de Lima y del Callao se unifican con su nombre oficial («Santiago De Surco» y «Surco» pasan a «Santiago de Surco») y deducen su departamento y provincia; la carga guarda además el departamento y la ciudad que entrega cada portal (db/011_ubicacion.sql)." },
      { tipo: "mejora", texto: "Cada filtro nuevo aparece como chip y vale también para las búsquedas guardadas." },
    ],
  },
  {
    version: "2.2.0",
    fecha: "2026-11-04",
    titulo: "InfoCasas y Properati se suman a la carga",
    cambios: [
      { tipo: "implementacion", texto: "La carga automática ahora también recibe avisos de InfoCasas Perú (con galería completa de fotos, descripción, coordenadas y anunciante) y de Properati Perú, cada una con su actor, sus búsquedas y su propio tope." },
      { tipo: "mejora", texto: "Cargar ahora y la carga programada lanzan una corrida por cada una de las cuatro fuentes; Sistema → Carga de datos muestra el uso y el tope de cada una." },
      { tipo: "correccion", texto: "Los actores que se ejecutaban a mano en la consola de Apify no llegaban al sistema porque no avisan de su resultado: ahora se lanzan desde el sistema y sus avisos se guardan solos." },
      { tipo: "mejora", texto: "Properati: se descartan coordenadas de otros países y áreas irreales (p. ej. «1 m²») que algunos avisos traen por error." },
    ],
  },
  {
    version: "2.1.0",
    fecha: "2026-10-22",
    titulo: "Filtros por secciones y vista previa con más de 60 detalles",
    cambios: [
      { tipo: "implementacion", texto: "Nuevo panel de filtros por secciones con buen espaciado: qué buscas y dónde, precio y portales, y un desglose «Más filtros» con dormitorios, baños, área mínima y máxima, y fecha de publicación." },
      { tipo: "implementacion", texto: "Filtros nuevos: palabra clave (título y distrito), baños, área en m², y publicado hoy, en 7 o en 30 días. También valen para las búsquedas guardadas." },
      { tipo: "mejora", texto: "Cada filtro aplicado aparece como chip que se quita con un clic y busca al instante; hay topes de precio rápidos según la moneda y la operación." },
      { tipo: "implementacion", texto: "Vista previa de la propiedad rediseñada con más de 60 detalles explicados en lenguaje sencillo: precio en soles y dólares, precio por m², cuota de hipoteca de referencia, costos del alquiler, comparación con la mediana del distrito, tiempo en el sistema, ubicación y avisos parecidos." },
      { tipo: "mejora", texto: "Iconos con volumen y fichas que se inclinan hacia el cursor (efecto 3D); sin emojis, solo iconos. Con «Reducir movimiento» las fichas quedan quietas." },
      { tipo: "implementacion", texto: "La carga guarda además descripción, dirección, cocheras, antigüedad, anunciante, coordenadas y mantenimiento cuando la fuente los entrega (db/009_detalles.sql, opcional)." },
      { tipo: "correccion", texto: "Los filtros del panel de administración ya no se amontonan ni cruzan: nueva distribución en filas con aire entre campos." },
    ],
  },
  {
    version: "2.0.0",
    fecha: "2026-10-22",
    titulo: "Nuevo diseño: cristal, luz y movimiento",
    cambios: [
      { tipo: "implementacion", texto: "Rediseño completo de la interfaz: nuevas tipografías (Fraunces y Plus Jakarta Sans), superficies de cristal con relieve, botones con luz, campos con halo al enfocar y esquinas más suaves en todo el sistema." },
      { tipo: "implementacion", texto: "Iconos animados: cada icono hace su propio gesto al pasar el cursor (la lupa se mueve, el engranaje gira, la campana se balancea, el corazón late, la papelera se sacude…) sin tocar ninguna pantalla." },
      { tipo: "implementacion", texto: "Movimiento nuevo: transición de entrada entre secciones, brillo que sigue al cursor sobre las tarjetas, indicador luminoso en la navegación, barra de tiempo en los avisos emergentes y fondo con auroras suaves." },
      { tipo: "mejora", texto: "Pantalla de acceso con orbes luminosos y marco giratorio, barra lateral y cabecera de cristal, estados vacíos con halo, y títulos con filete dorado animado." },
      { tipo: "mejora", texto: "Todo respeta «Reducir movimiento» (preferencia del sistema o ajuste en Tema y personalización) y funciona igual en tema claro, oscuro y móvil." },
      { tipo: "correccion", texto: "Las tarjetas de propiedades vuelven a elevarse al pasar el cursor (la animación de entrada retenía la posición) y el Catálogo ya no repite el saludo del Inicio." },
    ],
  },
  {
    version: "1.11.1",
    fecha: "2026-10-22",
    titulo: "Vista previa siempre a la vista y datos más limpios",
    cambios: [
      { tipo: "correccion", texto: "La vista previa de una propiedad ya no queda fuera de la pantalla al hacer clic en una tarjeta con la página desplazada: se abre siempre centrada y la página no se mueve por detrás." },
      { tipo: "correccion", texto: "Los títulos ya no muestran códigos como «&sup2;» (ahora «m²») y se corrigió un precio en dólares absurdo que entregaba una fuente (alquiler de S/ 1 199 con US$ 357 000)." },
      { tipo: "mejora", texto: "Las fotos de Adondevivir y Urbania se piden en tamaño grande, y la carga de Adondevivir recorre también las páginas 2 a 5 de cada búsqueda para traer avisos nuevos en cada corrida." },
    ],
  },
  {
    version: "1.11.0",
    fecha: "2026-10-22",
    titulo: "Vista previa de propiedades con galería de fotos",
    cambios: [
      { tipo: "implementacion", texto: "Al hacer clic en la foto de una tarjeta se abre la vista previa con la galería: foto grande, flechas, contador, miniaturas que se desplazan cuando hay muchas y control con el teclado." },
      { tipo: "implementacion", texto: "La carga guarda todas las fotos de cada aviso (hasta 20) en la nueva columna imagenes (db/008_imagenes.sql); los avisos ya cargados muestran su portada hasta que se vuelvan a cargar." },
      { tipo: "mejora", texto: "El administrador también puede abrir la vista previa desde Propiedades; el botón de comparar solo aparece en el portal." },
    ],
  },
  {
    version: "1.10.1",
    fecha: "2026-10-22",
    titulo: "La carga trae todas las fuentes a la vez",
    cambios: [
      { tipo: "mejora", texto: "«Cargar ahora» y la carga programada (lunes y jueves) ahora lanzan una corrida por fuente (Adondevivir y Urbania), cada una con su actor y su tope; antes se cargaba una sola por vez." },
      { tipo: "mejora", texto: "Si una fuente está en curso o sin cupo, las demás igual cargan; el selector permite cargar solo una." },
    ],
  },
  {
    version: "1.10.0",
    fecha: "2026-10-22",
    titulo: "Urbania como segunda fuente de avisos",
    cambios: [
      { tipo: "implementacion", texto: "La carga automática ahora también trae avisos de Urbania (portal urbania), con su actor, sus búsquedas y su propio tope por ciclo (200 por defecto)." },
      { tipo: "mejora", texto: "Sin elegir fuente se carga la que lleva menos de su tope; «Cargar ahora» permite elegir Adondevivir o Urbania, y la pantalla muestra el uso de cada una." },
      { tipo: "mejora", texto: "Los topes en dólares suman la tarifa por corrida de Urbania (US$ 0.015) y la carga programada corre lunes y jueves." },
    ],
  },
  {
    version: "1.9.0",
    fecha: "2026-10-22",
    titulo: "Actor de respaldo para la carga",
    cambios: [
      { tipo: "implementacion", texto: "Segundo actor de Apify (scrapers_lat) como respaldo: si una corrida falla, la siguiente usa el otro actor, y si también falla se vuelve al principal." },
      { tipo: "mejora", texto: "Cada actor tiene su costo y su límite por corrida (el respaldo, 10 avisos en el plan gratuito); los topes en dólares usan el costo del actor elegido." },
      { tipo: "mejora", texto: "El sistema entiende los dos formatos de datos y evita duplicados cuando ambos actores ven el mismo aviso; el historial muestra qué actor hizo cada corrida." },
    ],
  },
  {
    version: "1.8.4",
    fecha: "2026-10-22",
    titulo: "Propiedades del admin: ya no se ocultan los avisos en soles",
    cambios: [
      { tipo: "correccion", texto: "El filtro de moneda de Propiedades (admin) escondía los avisos publicados en soles cuando estaba en «Dólares». Ahora solo define la moneda del rango de precios y no excluye avisos." },
    ],
  },
  {
    version: "1.8.3",
    fecha: "2026-10-22",
    titulo: "Historial de cargas más fiel",
    cambios: [
      { tipo: "correccion", texto: "Un fallo del sitio (por ejemplo un timeout) ya no se cuenta como aviso recibido: la corrida queda «Fallida» con el motivo en el historial." },
      { tipo: "mejora", texto: "Una búsqueda sin resultados queda «Completada» con la explicación, y los errores de páginas sueltas se indican sin ocultar los avisos buenos." },
    ],
  },
  {
    version: "1.8.2",
    fecha: "2026-10-22",
    titulo: "Carga de datos más simple y con datos reales",
    cambios: [
      { tipo: "mejora", texto: "El ciclo, el crédito y el gasto se leen de la cuenta de Apify (solo lectura): ya no hay que escribir el día de reinicio ni suponer el crédito." },
      { tipo: "seguridad", texto: "Los topes usan el gasto real de la cuenta, incluidas pruebas manuales hechas fuera del sistema; si Apify no responde, se usan estimaciones prudentes." },
      { tipo: "mejora", texto: "La pantalla marca cada valor como Automático, Editable o Manual y deja solo lo esencial a la vista (el máximo por corrida pasa a opciones avanzadas)." },
    ],
  },
  {
    version: "1.8.1",
    fecha: "2026-10-22",
    titulo: "Topes ajustados al plan gratuito de Apify",
    cambios: [
      { tipo: "seguridad", texto: "El tope mensual máximo se calcula del crédito gratuito (US$ 5) y se usa solo el 90 %: hasta 1 500 avisos por ciclo." },
      { tipo: "mejora", texto: "El conteo sigue el ciclo real de Apify (se reinicia el día 23 en esta cuenta, configurable) en lugar del mes calendario." },
      { tipo: "mejora", texto: "La pantalla de carga muestra el gasto estimado sobre el crédito gratis y la fecha del próximo reinicio." },
      { tipo: "correccion", texto: "Los proyectos inmobiliarios se agrupan bajo el tipo «Proyecto» y el barrio «S/n» se reemplaza por la ciudad." },
    ],
  },
  {
    version: "1.8.0",
    fecha: "2026-10-22",
    titulo: "Carga automática de avisos",
    cambios: [
      { tipo: "implementacion", texto: "Carga automática de avisos de Adondevivir con Apify: función programada semanal y botón «Cargar ahora» en Sistema → Carga de datos." },
      { tipo: "implementacion", texto: "Los avisos se leen de Apify mediante un aviso de fin de corrida (webhook) autenticado y se guardan sin duplicar." },
      { tipo: "seguridad", texto: "Topes de gasto en varias capas: interruptor de pausa, tope mensual y máximo por corrida reservados antes de pedir, y límites de avisos y de dólares enviados a Apify." },
      { tipo: "mejora", texto: "Pantalla de carga con anillo de uso mensual, estimación de costo, historial de corridas y auditoría de cada cambio." },
      { tipo: "mejora", texto: "Se retiró el lector experimental de páginas de Adondevivir, bloqueado por su protección anti-bots." },
    ],
  },
  {
    version: "1.7.0",
    fecha: "2026-10-17",
    titulo: "Módulo Sistema",
    cambios: [
      { tipo: "implementacion", texto: "Módulo Sistema con sub-barra lateral: Perfil, Seguridad, Personalización, Acerca del sistema y, para el administrador, Actividad y Auditoría." },
      { tipo: "implementacion", texto: "Personalización: color de acento, tamaño de interfaz, animaciones reducidas y luz ambiental, guardadas en el navegador." },
      { tipo: "implementacion", texto: "Perfil con antigüedad, accesos, sesiones activas y plan con anillo de días restantes (GET /api/account/profile)." },
      { tipo: "implementacion", texto: "Acerca del sistema: versión, historial de cambios y diagnóstico en vivo de la API." },
      { tipo: "mejora", texto: "Los clientes también tienen la pestaña Cuenta con las mismas secciones personales." },
    ],
  },
  {
    version: "1.6.0",
    fecha: "2026-10-16",
    titulo: "Inicio, estadísticas y herramientas",
    cambios: [
      { tipo: "implementacion", texto: "Pantalla de inicio del cliente: avisos nuevos, bajadas de precio en favoritos y novedades por búsqueda guardada." },
      { tipo: "implementacion", texto: "Estadísticas por distrito con la mediana del precio por m²." },
      { tipo: "implementacion", texto: "Calculadora de hipoteca y rentabilidad por alquiler." },
      { tipo: "implementacion", texto: "Buscador global con Ctrl+K en el portal y el panel de administración." },
      { tipo: "implementacion", texto: "Vencimientos de suscripción en el Dashboard, con recordatorio por WhatsApp." },
    ],
  },
  {
    version: "1.5.0",
    fecha: "2026-10-16",
    titulo: "Sesión, animaciones y limpieza",
    cambios: [
      { tipo: "seguridad", texto: "La sesión vive por pestaña y se cierra por inactividad (aviso con cuenta atrás); el servidor invalida sesiones sin uso en 30 minutos." },
      { tipo: "mejora", texto: "Dashboard en vivo: refresco automático, cifras animadas, minigráficas y barras por portal." },
      { tipo: "mejora", texto: "Formularios con validación visual y medidor de fortaleza de contraseña." },
      { tipo: "mejora", texto: "Actualización de dependencias con vulnerabilidades conocidas (0 pendientes)." },
      { tipo: "correccion", texto: "Corregida una pantalla en blanco en producción causada por la división de archivos del build." },
      { tipo: "mejora", texto: "Se retiró la opción «Forzar scraper» y las variables GITHUB_* asociadas." },
    ],
  },
  {
    version: "1.4.0",
    fecha: "2026-10-16",
    titulo: "Calidad y accesibilidad",
    cambios: [
      { tipo: "implementacion", texto: "Tema claro y oscuro con la preferencia guardada y sin parpadeo al cargar." },
      { tipo: "implementacion", texto: "Integración continua: tipos, pruebas y build en cada cambio, más auditoría de dependencias." },
      { tipo: "mejora", texto: "Accesibilidad: foco atrapado en los modales, enlace «Saltar al contenido» y mejor contraste." },
      { tipo: "mejora", texto: "Carga diferida de pantallas, pestañas y modales para reducir lo que se descarga." },
    ],
  },
  {
    version: "1.3.0",
    fecha: "2026-10-16",
    titulo: "Seguridad y operación",
    cambios: [
      { tipo: "seguridad", texto: "Sesiones activas visibles por dispositivo e IP, con cierre individual o de todas las demás." },
      { tipo: "seguridad", texto: "Registro de auditoría de las acciones administrativas." },
      { tipo: "implementacion", texto: "Respaldos diarios cifrados con GitHub Actions y rol de solo lectura para Inmodata." },
    ],
  },
  {
    version: "1.2.0",
    fecha: "2026-10-16",
    titulo: "Portal de clientes",
    cambios: [
      { tipo: "implementacion", texto: "Favoritos y búsquedas guardadas para clientes." },
      { tipo: "implementacion", texto: "Orden por precio, comparador de hasta 3 propiedades y detalle con historial de precios." },
      { tipo: "implementacion", texto: "Exportación de la búsqueda a CSV con protección contra inyección de fórmulas." },
    ],
  },
  {
    version: "1.1.0",
    fecha: "2026-10-16",
    titulo: "Contraseñas y mantenimiento",
    cambios: [
      { tipo: "implementacion", texto: "Cambio de contraseña propia y restablecimiento por el administrador." },
      { tipo: "implementacion", texto: "Limpieza segura de avisos inactivos, con vista previa y salvaguardas." },
      { tipo: "implementacion", texto: "Alertas por falta de datos mediante una función programada (watchdog)." },
    ],
  },
  {
    version: "1.0.0",
    fecha: "2026-10-16",
    titulo: "Plataforma base",
    cambios: [
      { tipo: "implementacion", texto: "Migración a Neon (Postgres) con API propia y despliegue en Netlify." },
      { tipo: "implementacion", texto: "Rediseño completo de la interfaz: grafito, tarjetas redondeadas y acento dorado." },
      { tipo: "correccion", texto: "Revisión general de errores del sistema original: consultas, filtros, fechas y precios." },
    ],
  },
]

/** Cuenta los cambios de cada tipo en todo el historial. */
export function contarPorTipo(versiones: Version[] = VERSIONES): Record<CambioTipo, number> {
  const total: Record<CambioTipo, number> = { implementacion: 0, mejora: 0, correccion: 0, seguridad: 0 }
  for (const v of versiones) for (const c of v.cambios) total[c.tipo]++
  return total
}

export const VERSION_ACTUAL = VERSIONES[0].version
