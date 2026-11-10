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
  const precio = it.price ?? {}
  const moneda = /u\$s|usd/i.test(precio.currency?.name ?? "") ? "USD" : "PEN"
  const oculto = precio.hidePrice === true
  const loc = it.locations ?? {}
  const nombre = k => (Array.isArray(loc[k]) ? loc[k][0]?.name : loc[k]?.name)
  const punto = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/.exec(loc.location_point ?? "")
  const gastos = montoConMoneda(ficha.commonExpenses)
  const imagenes = (it.images ?? []).map(i => i?.image).filter(Boolean)

  return {
    portal: "infocasas",
    codigo: String(it.id),
    operacion,
    inmueble: texto(it.property_type?.name) ?? "Otro",
    titulo,
    precio: oculto ? undefined : positivo(precio.amount),
    moneda,
    precioUsd: oculto ? undefined : positivo(it.price_amount_usd),
    distrito: nombre("neighbourhood") ?? nombre("commune") ?? nombre("zone") ?? nombre("locality") ?? nombre("city") ?? nombre("state"),
    departamento: nombre("state"),
    provincia: nombre("city"),
    dormitorios: entero(ficha.bedrooms)?.toString(),
    banios: entero(ficha.bathrooms)?.toString(),
    area: positivo(it.m2) ? `${it.m2} m2` : texto(ficha.m2Built),
    imagen: texto(it.img) ?? imagenes[0],
    imagenes,
    url: it.link ? base + it.link : undefined,
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
