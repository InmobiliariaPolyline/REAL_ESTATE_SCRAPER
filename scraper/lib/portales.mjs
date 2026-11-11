// Lectura de los portales que entregan sus listados dentro de la propia página (datos públicos que el
// navegador ya recibe). Cada portal: dónde buscar, cómo pedir cada página y cómo convertir su
// formato en el aviso que espera POST /api/ingesta (ver docs/SCRAPER_PROPIO.md).
//
// Solo está InfoCasas: Urbania, Adondevivir y Properati responden 403 a las peticiones automáticas y no se
// fuerzan (para ellos sigue la carga con Apify).

const anioActual = () => new Date().getFullYear()
const texto = v => (typeof v === "string" && v.trim() ? v.trim() : undefined)
const entero = v => {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""))
  return Number.isFinite(n) && String(v ?? "").trim() !== "" && n > 0 ? n : undefined
}
const positivo = v => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined)

/** Convierte un año de construcción («2019») en antigüedad («7 años»); otro valor se deja como texto. */
function antiguedadDe(valor) {
  const t = texto(String(valor ?? ""))
  if (!t) return undefined
  if (/^(19|20)\d{2}$/.test(t)) {
    const dif = anioActual() - Number(t)
    return dif >= 0 && dif <= 200 ? (dif === 0 ? "Estreno" : `${dif} años`) : undefined
  }
  return t
}

// Área máxima creíble por tipo (m²); los terrenos, edificios y similares pueden ser enormes.
const AREA_MAXIMA = { Departamento: 3000, Proyecto: 3000, Casa: 20000, Oficina: 20000, "Local Comercial": 50000 }

/**
 * Área de la ficha («218.000 m2» -> 218; «120 m2» -> 120). Solo se acepta un entero o un entero con «.000»: algo
 * como «24.268» puede ser 24,268 m² (miles) o 24,268 m² (decimales) y no se adivina.
 */
const areaDeTexto = v => {
  const m = /^\s*(\d+)(?:\.000)?\s*(?:m2|m²)?\s*$/i.exec(String(v ?? ""))
  return m ? positivo(Number(m[1])) : undefined
}

/**
 * Área en m². El portal a veces entrega `m2` mal escalado (218.000 m² -> 218000): si no es creíble para el tipo se
 * prueba con el texto de la ficha y, si tampoco, con la superficie del terreno. Mejor sin área que con una absurda.
 */
function areaDe(it, ficha, tipo) {
  const maxima = AREA_MAXIMA[tipo] ?? Infinity
  for (const c of [positivo(it.m2), areaDeTexto(ficha.m2Built), positivo(it.m2Terrain)]) {
    if (c && c <= maxima) return c
  }
  return undefined
}

/** Estado de construcción de un proyecto («A estrenar», «En construcción») como antigüedad. */
function antiguedadDeEstado(valor) {
  const t = texto(valor)
  if (!t) return undefined
  return /estrenar|estreno/i.test(t) ? "Estreno" : t
}

/** «S/ 300», «U$S 120», «USD 120» -> { monto, moneda }. */
function montoConMoneda(valor) {
  const t = texto(valor)
  if (!t) return undefined
  const monto = entero(t)
  if (!monto) return undefined
  return { monto, moneda: /u\$s|usd|us\$|\$/i.test(t) ? "USD" : "PEN" }
}

// ── InfoCasas ────────────────────────────────────────────────────────────────

function datosNextInfocasas(html) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)
  if (!m) return null
  try {
    return JSON.parse(m[1]).props?.pageProps?.fetchResult?.searchFast ?? null
  } catch {
    return null
  }
}

// ── Proyectos ────────────────────────────────────────────────────────────────
//
// Un proyecto (edificio en construcción, condominio) ofrece varias tipologías: «1 dormitorio, 54 m², US$ 108,700» hasta
// «3 dormitorios, 66 m², US$ 130,600». InfoCasas lo entrega de dos formas, y las dos deben dar el mismo aviso:
//   - como el proyecto mismo (`isProject`, `isProjectUnit: false`, `project: []`, enlace «proyectos/b34»), con el precio,
//     el área y los dormitorios de su tipología más pequeña;
//   - como una de sus tipologías (`isProjectUnit: true`, `project: {…}`, enlace «/b34/187068547»), con los datos de esa
//     tipología solamente (por eso un proyecto aparecía como un «Departamento» de US$ 130,600 y 66 m²).
// En ambas viene `commercial_units`: la lista de todas las tipologías. Se guarda UN aviso por proyecto, con el rango
// («Desde … hasta …») calculado de esa lista y la lista misma.

/** Nombre del proyecto en la dirección: «proyectos/b34» o «/b34/187068547» -> «b34». */
const slugDeProyecto = link => {
  const t = String(link ?? "")
  return /(?:^|\/)proyectos\/([^/?#]+)/.exec(t)?.[1] ?? /^\/?([^/?#]+)\/\d+\/?(?:[?#].*)?$/.exec(t)?.[1]
}

const nombreMoneda = c => (typeof c === "string" ? c : c?.name)
const esDolar = c => /u\$s|usd|us\$|\$/i.test(nombreMoneda(c) ?? "") && !/^s\//i.test(nombreMoneda(c) ?? "")

/** Cantidades distintas de menor a mayor («1, 2, 3»), como las guarda el servidor. */
const listaNumeros = valores => {
  const distintos = [...new Set(valores.filter(v => typeof v === "number" && v > 0))].sort((x, y) => x - y)
  return distintos.length ? distintos.join(", ") : undefined
}

/** Un registro de InfoCasas que es un proyecto (o una tipología de uno); `null` si es un aviso normal. */
function proyectoDe(it) {
  const objeto = it.project && typeof it.project === "object" && !Array.isArray(it.project) && it.project.id ? it.project : null
  return it.isProject === true || objeto ? objeto ?? {} : null
}

function avisoDeProyecto(it, operacion, titulo, objeto, base) {
  const ficha = Object.fromEntries((it.technicalSheet ?? []).map(t => [t.field, t.value]))
  const crudas = Array.isArray(it.commercial_units) ? it.commercial_units : []
  // Sin lista de tipologías, el propio registro es la única que se conoce.
  const fuentes = crudas.length
    ? crudas
    : [{ id: it.id, bedrooms: it.bedrooms ?? entero(ficha.bedrooms), bathrooms: it.bathrooms ?? entero(ficha.bathrooms), m2: it.m2Built || it.m2 || it.m2Terrain, price: it.price }]
  const oculto = it.price?.hidePrice === true && !crudas.length
  const unidades = fuentes.map(u => ({
    codigo: String(u.id),
    dormitorios: positivo(Number(u.bedrooms)),
    banios: positivo(Number(u.bathrooms)),
    area: positivo(Number(u.m2)) ?? positivo(Number(u.m2Terrain)),
    precio: u.price?.hidePrice === true || oculto ? undefined : positivo(Number(u.price?.amount)),
    moneda: nombreMoneda(u.price?.currency),
  }))
  const conPrecio = unidades.filter(u => u.precio !== undefined)
  const minimo = conPrecio.length ? Math.min(...conPrecio.map(u => u.precio)) : undefined
  const maximo = conPrecio.length ? Math.max(...conPrecio.map(u => u.precio)) : undefined
  const monedaDe = conPrecio[0]?.moneda ?? nombreMoneda(it.price?.currency) ?? nombreMoneda(objeto.minPrice?.currency)
  // Sin la lista de tipologías solo se conoce la propia y, si el proyecto lo informa, su precio y su área «desde».
  const listaConocida = crudas.length > 0
  const desde = !listaConocida && !oculto ? positivo(Number(objeto.minPrice?.amount)) : undefined
  const precio = desde ?? minimo
  const areas = unidades.map(u => u.area).filter(Boolean)
  const areaDesde = !listaConocida ? positivo(Number(objeto.minM2)) : undefined
  const areaMin = areaDesde ?? (areas.length ? Math.min(...areas) : undefined)
  const areaMax = areas.length ? Math.max(...areas) : undefined

  const slug = slugDeProyecto(objeto.link) ?? slugDeProyecto(it.link)
  const loc = it.locations ?? {}
  const nombre = k => (Array.isArray(loc[k]) ? loc[k][0]?.name : loc[k]?.name)
  const punto = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/.exec(loc.location_point ?? "")
  const limpiaFoto = u => (typeof u === "string" ? u.replace(/#.*$/, "") : u)
  const imagenes = (it.images ?? []).map(i => limpiaFoto(i?.image)).filter(Boolean)
  const estado = texto(ficha.construction_state_name)

  return {
    portal: "infocasas",
    // El código es el del proyecto, no el de una tipología: así las distintas formas de leerlo no lo duplican.
    codigo: slug ? `proyecto-${slug}` : String(objeto.id ?? it.id),
    operacion,
    inmueble: "Proyecto",
    titulo,
    precio,
    precioMax: precio !== undefined && maximo !== undefined && maximo > precio ? maximo : undefined,
    moneda: esDolar(monedaDe) ? "USD" : "PEN",
    distrito: nombre("neighbourhood") ?? nombre("commune") ?? nombre("zone") ?? nombre("locality") ?? nombre("city") ?? nombre("state"),
    departamento: nombre("state"),
    provincia: nombre("city"),
    dormitorios: (!listaConocida ? listaNumeros((objeto.bedrooms ?? []).map(Number)) : undefined) ?? listaNumeros(unidades.map(u => u.dormitorios)),
    banios: (!listaConocida ? listaNumeros((objeto.bathrooms ?? []).map(Number)) : undefined) ?? listaNumeros(unidades.map(u => u.banios)),
    area: areaMin === undefined ? undefined : areaMax !== undefined && areaMax > areaMin ? `${areaMin} – ${areaMax} m2` : `${areaMin} m2`,
    imagen: texto(limpiaFoto(it.img)) ?? imagenes[0],
    imagenes,
    url: slug ? `${base}/proyectos/${slug}` : it.link ? base + (String(it.link).startsWith("/") ? "" : "/") + it.link : undefined,
    descripcion: texto(objeto.description) ?? texto(it.description),
    direccion: it.showAddress === false ? undefined : texto(it.address),
    antiguedad: estado ? antiguedadDeEstado(estado) : undefined,
    publicador: texto(it.owner?.name),
    latitud: punto ? Number(punto[2]) : undefined,
    longitud: punto ? Number(punto[1]) : undefined,
    // Sin la lista completa no se guarda una sola tipología como si fuera todo el proyecto.
    unidades: listaConocida ? unidades.map(({ moneda: _m, ...u }) => u) : undefined,
  }
}

/** Un aviso de InfoCasas (`searchFast.data[i]`) como aviso del sistema; `null` si no sirve. */
export function avisoDeInfocasas(it, base = "https://www.infocasas.com.pe") {
  const operacion = /^venta/i.test(it?.operation_type?.name ?? "") ? "VENTA" : /^alquiler/i.test(it?.operation_type?.name ?? "") ? "ALQUILER" : null
  const titulo = texto(it?.title)
  if (!it?.id || !operacion || !titulo) return null

  const objeto = proyectoDe(it)
  if (objeto) return avisoDeProyecto(it, operacion, titulo, objeto, base)

  const ficha = Object.fromEntries((it.technicalSheet ?? []).map(t => [t.field, t.value]))
  const precio = it.price ?? {}
  const moneda = /u\$s|usd/i.test(precio.currency?.name ?? "") ? "USD" : "PEN"
  const oculto = it.price?.hidePrice === true
  const loc = it.locations ?? {}
  const nombre = k => (Array.isArray(loc[k]) ? loc[k][0]?.name : loc[k]?.name)
  const punto = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/.exec(loc.location_point ?? "")
  const gastos = montoConMoneda(ficha.commonExpenses)
  const limpiaFoto = u => (typeof u === "string" ? u.replace(/#.*$/, "") : u)
  const imagenes = (it.images ?? []).map(i => limpiaFoto(i?.image)).filter(Boolean)
  const tipoInmueble = texto(it.property_type?.name) ?? "Otro"
  const area = areaDe(it, ficha, tipoInmueble)

  return {
    portal: "infocasas",
    codigo: String(it.id),
    operacion,
    inmueble: tipoInmueble,
    titulo,
    precio: oculto ? undefined : positivo(precio.amount),
    moneda,
    precioUsd: oculto ? undefined : positivo(it.price_amount_usd),
    distrito: nombre("neighbourhood") ?? nombre("commune") ?? nombre("zone") ?? nombre("locality") ?? nombre("city") ?? nombre("state"),
    departamento: nombre("state"),
    provincia: nombre("city"),
    dormitorios: entero(ficha.bedrooms)?.toString(),
    banios: entero(ficha.bathrooms)?.toString(),
    area: area ? `${area} m2` : undefined,
    imagen: texto(limpiaFoto(it.img)) ?? imagenes[0],
    imagenes,
    url: it.link ? base + (String(it.link).startsWith("/") ? "" : "/") + it.link : undefined,
    descripcion: texto(it.description),
    direccion: it.showAddress === false ? undefined : texto(it.address),
    estacionamientos: ficha.garage !== undefined && ficha.garage !== "" ? String(entero(ficha.garage) ?? 0) : undefined,
    antiguedad: antiguedadDe(ficha.constructionYear),
    publicador: texto(it.owner?.name),
    latitud: punto ? Number(punto[2]) : undefined,
    longitud: punto ? Number(punto[1]) : undefined,
    // Los gastos comunes solo se guardan si están en la misma moneda que el precio.
    mantenimiento: gastos && gastos.moneda === moneda ? gastos.monto : undefined,
  }
}

export const infocasas = {
  id: "infocasas",
  nombre: "InfoCasas",
  base: "https://www.infocasas.com.pe",
  /** Rutas de búsqueda (la ruta termina donde empieza la paginación). Se pueden agregar distritos: «venta/departamentos/lima/miraflores». */
  busquedas: [
    "venta/departamentos/lima", "alquiler/departamentos/lima", "venta/casas/lima", "alquiler/casas/lima",
    "venta/terrenos/lima", "venta/oficinas/lima", "alquiler/oficinas/lima",
    "venta/locales-comerciales/lima", "alquiler/locales-comerciales/lima",
    // Los proyectos tienen su propio listado (todo el país): cada uno se guarda una vez, con su rango de precios.
    "proyectos",
  ],
  /** Con --provincias se agregan estas (probadas): las principales ciudades fuera de Lima. */
  busquedasProvincias: [
    "venta/departamentos/arequipa", "alquiler/departamentos/arequipa", "venta/casas/arequipa",
    "venta/departamentos/la-libertad", "venta/departamentos/piura", "venta/departamentos/lambayeque",
  ],
  maxPaginas: 25,
  urlPagina: (busqueda, n) => `https://www.infocasas.com.pe/${busqueda}${n > 1 ? `/pagina${n}` : ""}`,
  extraer(html) {
    const sf = datosNextInfocasas(html)
    if (!sf || !Array.isArray(sf.data)) return null
    return {
      avisos: sf.data.map(i => avisoDeInfocasas(i)).filter(Boolean),
      crudos: sf.data.length,
      paginas: Number(sf.paginatorInfo?.lastPage) || 1,
      total: Number(sf.paginatorInfo?.total) || undefined,
    }
  },
}

export const PORTALES = { infocasas }
