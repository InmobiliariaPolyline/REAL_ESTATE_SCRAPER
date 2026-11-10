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

/** El menor número positivo de una lista como ["1","2","3"]; `undefined` si no hay (p. ej. ["0"], monoambiente). */
const menorPositivo = lista => {
  const n = (Array.isArray(lista) ? lista : []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
  return n.length > 0 ? Math.min(...n) : undefined
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

/** Un aviso de InfoCasas (`searchFast.data[i]`) como aviso del sistema; `null` si no sirve. */
export function avisoDeInfocasas(it, base = "https://www.infocasas.com.pe") {
  const operacion = /^venta/i.test(it?.operation_type?.name ?? "") ? "VENTA" : /^alquiler/i.test(it?.operation_type?.name ?? "") ? "ALQUILER" : null
  const titulo = texto(it?.title)
  if (!it?.id || !operacion || !titulo) return null

  const ficha = Object.fromEntries((it.technicalSheet ?? []).map(t => [t.field, t.value]))
  // Un aviso con `project` es un proyecto inmobiliario (en el portal se muestra «Desde …»): el listado trae los
  // datos de una de sus tipologías, pero la ficha del portal (y lo que ve quien abre el enlace) usa los mínimos
  // del proyecto, así que se guardan esos y el aviso se marca como «Proyecto».
  // Los avisos normales traen `project: []`; uno real es un objeto con id.
  const proyecto = it.project && typeof it.project === "object" && !Array.isArray(it.project) && it.project.id ? it.project : null
  const desde = proyecto?.minPrice?.amount > 0 ? proyecto.minPrice : null
  const precio = desde ?? it.price ?? {}
  const moneda = /u\$s|usd/i.test(precio.currency?.name ?? "") ? "USD" : "PEN"
  const oculto = it.price?.hidePrice === true
  const loc = it.locations ?? {}
  const nombre = k => (Array.isArray(loc[k]) ? loc[k][0]?.name : loc[k]?.name)
  const punto = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/.exec(loc.location_point ?? "")
  const gastos = montoConMoneda(ficha.commonExpenses)
  const limpiaFoto = u => (typeof u === "string" ? u.replace(/#.*$/, "") : u)
  const imagenes = (it.images ?? []).map(i => limpiaFoto(i?.image)).filter(Boolean)
  const dormitorios = (proyecto ? menorPositivo(proyecto.bedrooms) : undefined) ?? entero(ficha.bedrooms)
  const banios = (proyecto ? menorPositivo(proyecto.bathrooms) : undefined) ?? entero(ficha.bathrooms)
  const areaMin = proyecto ? positivo(proyecto.minM2) : undefined

  return {
    portal: "infocasas",
    codigo: String(it.id),
    operacion,
    inmueble: proyecto ? "Proyecto" : texto(it.property_type?.name) ?? "Otro",
    titulo,
    precio: oculto ? undefined : positivo(precio.amount),
    moneda,
    // En un proyecto el dólar lo calcula el sistema a partir del precio «desde».
    precioUsd: oculto || desde ? undefined : positivo(it.price_amount_usd),
    distrito: nombre("neighbourhood") ?? nombre("commune") ?? nombre("zone") ?? nombre("locality") ?? nombre("city") ?? nombre("state"),
    departamento: nombre("state"),
    provincia: nombre("city"),
    dormitorios: dormitorios?.toString(),
    banios: banios?.toString(),
    area: areaMin ? `${areaMin} m2` : positivo(it.m2) ? `${it.m2} m2` : texto(ficha.m2Built),
    imagen: texto(limpiaFoto(it.img)) ?? imagenes[0],
    imagenes,
    url: it.link ? base + it.link : undefined,
    descripcion: (proyecto ? texto(proyecto.description) : undefined) ?? texto(it.description),
    direccion: it.showAddress === false ? undefined : texto(it.address),
    estacionamientos: ficha.garage !== undefined && ficha.garage !== "" ? String(entero(ficha.garage) ?? 0) : undefined,
    antiguedad: antiguedadDe(ficha.constructionYear) ?? (proyecto ? antiguedadDeEstado(ficha.construction_state_name) : undefined),
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
  ],
  /** Con --provincias se agregan estas (probadas): las principales ciudades fuera de Lima. */
  busquedasProvincias: [
    "venta/departamentos/arequipa", "alquiler/departamentos/arequipa", "venta/casas/arequipa",
    "venta/departamentos/la-libertad", "venta/departamentos/piura", "venta/departamentos/lambayeque",
    "proyectos",
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
