/**
 * Ubicación de los avisos: departamento (región), provincia (ciudad) y distrito.
 * Los portales escriben los nombres de formas distintas («Santiago De Surco», «SANTIAGO DE SURCO»);
 * aquí se normalizan para que los filtros no dupliquen valores.
 */

/** Distritos de Lima Metropolitana (provincia de Lima, departamento de Lima). */
export const DISTRITOS_LIMA = [
  "Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos", "Cieneguilla", "Comas", "El Agustino",
  "Independencia", "Jesús María", "La Molina", "La Victoria", "Lima", "Lince", "Los Olivos", "Lurigancho", "Lurín",
  "Magdalena del Mar", "Miraflores", "Pachacámac", "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra",
  "Rímac", "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis",
  "San Martín de Porres", "San Miguel", "Santa Anita", "Santa María del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo",
  "Villa El Salvador", "Villa María del Triunfo",
] as const

/** Distritos de la Provincia Constitucional del Callao. */
export const DISTRITOS_CALLAO = ["Callao", "Bellavista", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Mi Perú", "Ventanilla"] as const

/** Otras formas habituales de escribir un distrito -> nombre oficial. */
const ALIAS: Record<string, string> = {
  "lima cercado": "Lima",
  "cercado de lima": "Lima",
  "magdalena": "Magdalena del Mar",
  "chosica": "Lurigancho",
  "lurigancho chosica": "Lurigancho",
  "ate vitarte": "Ate",
  "carmen de la legua": "Carmen de la Legua Reynoso",
  "villa maria del triunfo": "Villa María del Triunfo",
  "san juan lurigancho": "San Juan de Lurigancho",
  "sjl": "San Juan de Lurigancho",
  "sjm": "San Juan de Miraflores",
  "smp": "San Martín de Porres",
  "ves": "Villa El Salvador",
  "surco": "Santiago de Surco",
}

/** Alias de distritos (clave sin tildes -> nombre oficial); la base los usa para reconocer «Cercado de Lima» como «Lima». */
export const ALIAS_DE_DISTRITO: Readonly<Record<string, string>> = ALIAS

/** Minúsculas, sin tildes ni espacios sobrantes: «Santiago De  Surco» -> «santiago de surco». */
export function claveNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "el"])

/** Mayúscula inicial en cada palabra, salvo partículas («de», «del», «la»…) que van en minúscula. */
export function tituloNombre(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ")
}

const LIMA = new Map<string, string>(DISTRITOS_LIMA.map(d => [claveNombre(d), d]))
const CALLAO = new Map<string, string>(DISTRITOS_CALLAO.map(d => [claveNombre(d), d]))

/**
 * Nombre canónico de un distrito: el oficial si es de Lima o del Callao (con alias y sin importar
 * mayúsculas ni tildes) y, si no, el texto en formato título.
 */
export function distritoCanonico(distrito: string | null | undefined): string | null {
  const t = (distrito ?? "").trim()
  if (!t) return null
  const clave = claveNombre(t)
  const nombre = ALIAS[clave] ?? t
  const k = claveNombre(nombre)
  return LIMA.get(k) ?? CALLAO.get(k) ?? tituloNombre(nombre)
}

/**
 * Nombre oficial si `distrito` es (o es un alias de) un distrito de Lima Metropolitana o del Callao; `null` si es
 * otra cosa, por ejemplo un texto parcial («mira») o un distrito de provincias.
 */
export function distritoOficial(distrito: string | null | undefined): string | null {
  const t = (distrito ?? "").trim()
  if (!t) return null
  const clave = claveNombre(t)
  const k = claveNombre(ALIAS[clave] ?? t)
  return LIMA.get(k) ?? CALLAO.get(k) ?? null
}

/** Todas las formas (claves sin tildes) con que se reconoce un distrito oficial: su nombre y sus alias. */
export function clavesDeDistrito(oficial: string): string[] {
  const nombre = claveNombre(oficial)
  return [nombre, ...Object.entries(ALIAS).filter(([, v]) => claveNombre(v) === nombre).map(([k]) => k)]
}

export interface Ubicacion {
  departamento: string
  provincia: string
}

/** Departamento y provincia de un distrito de Lima o del Callao; `null` si no se reconoce. */
export function ubicacionDeDistrito(distrito: string | null | undefined): Ubicacion | null {
  const t = (distrito ?? "").trim()
  if (!t) return null
  const k = claveNombre(ALIAS[claveNombre(t)] ?? t)
  if (LIMA.has(k)) return { departamento: "Lima", provincia: "Lima" }
  if (CALLAO.has(k)) return { departamento: "Callao", provincia: "Callao" }
  return null
}

/** Departamento o provincia: sin espacios sobrantes y en formato título; `null` si queda vacío. */
export function nombreDeLugar(valor: string | null | undefined): string | null {
  const t = (valor ?? "").trim()
  return t ? tituloNombre(t).slice(0, 60) : null
}

// ── Catálogo completo del Perú (para que los filtros ofrezcan todo, haya o no avisos) ──────────

/** Los 24 departamentos y la Provincia Constitucional del Callao. */
export const DEPARTAMENTOS = [
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica",
  "Junín", "La Libertad", "Lambayeque", "Lima", "Loreto", "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín",
  "Tacna", "Tumbes", "Ucayali",
] as const

/** Las 196 provincias, por departamento. */
export const PROVINCIAS: Record<string, readonly string[]> = {
  "Amazonas": ["Chachapoyas", "Bagua", "Bongará", "Condorcanqui", "Luya", "Rodríguez de Mendoza", "Utcubamba"],
  "Áncash": ["Huaraz", "Aija", "Antonio Raymondi", "Asunción", "Bolognesi", "Carhuaz", "Carlos Fermín Fitzcarrald", "Casma", "Corongo", "Huari", "Huarmey", "Huaylas", "Mariscal Luzuriaga", "Ocros", "Pallasca", "Pomabamba", "Recuay", "Santa", "Sihuas", "Yungay"],
  "Apurímac": ["Abancay", "Andahuaylas", "Antabamba", "Aymaraes", "Chincheros", "Cotabambas", "Grau"],
  "Arequipa": ["Arequipa", "Camaná", "Caravelí", "Castilla", "Caylloma", "Condesuyos", "Islay", "La Unión"],
  "Ayacucho": ["Huamanga", "Cangallo", "Huanca Sancos", "Huanta", "La Mar", "Lucanas", "Parinacochas", "Páucar del Sara Sara", "Sucre", "Víctor Fajardo", "Vilcas Huamán"],
  "Cajamarca": ["Cajamarca", "Cajabamba", "Celendín", "Chota", "Contumazá", "Cutervo", "Hualgayoc", "Jaén", "San Ignacio", "San Marcos", "San Miguel", "San Pablo", "Santa Cruz"],
  "Callao": ["Callao"],
  "Cusco": ["Cusco", "Acomayo", "Anta", "Calca", "Canas", "Canchis", "Chumbivilcas", "Espinar", "La Convención", "Paruro", "Paucartambo", "Quispicanchi", "Urubamba"],
  "Huancavelica": ["Huancavelica", "Acobamba", "Angaraes", "Castrovirreyna", "Churcampa", "Huaytará", "Tayacaja"],
  "Huánuco": ["Huánuco", "Ambo", "Dos de Mayo", "Huacaybamba", "Huamalíes", "Leoncio Prado", "Marañón", "Pachitea", "Puerto Inca", "Lauricocha", "Yarowilca"],
  "Ica": ["Ica", "Chincha", "Nasca", "Palpa", "Pisco"],
  "Junín": ["Huancayo", "Chanchamayo", "Chupaca", "Concepción", "Jauja", "Junín", "Satipo", "Tarma", "Yauli"],
  "La Libertad": ["Trujillo", "Ascope", "Bolívar", "Chepén", "Gran Chimú", "Julcán", "Otuzco", "Pacasmayo", "Pataz", "Sánchez Carrión", "Santiago de Chuco", "Virú"],
  "Lambayeque": ["Chiclayo", "Ferreñafe", "Lambayeque"],
  "Lima": ["Lima", "Barranca", "Cajatambo", "Canta", "Cañete", "Huaral", "Huarochirí", "Huaura", "Oyón", "Yauyos"],
  "Loreto": ["Maynas", "Alto Amazonas", "Datem del Marañón", "Loreto", "Mariscal Ramón Castilla", "Putumayo", "Requena", "Ucayali"],
  "Madre de Dios": ["Tambopata", "Manu", "Tahuamanu"],
  "Moquegua": ["Mariscal Nieto", "General Sánchez Cerro", "Ilo"],
  "Pasco": ["Pasco", "Daniel Alcides Carrión", "Oxapampa"],
  "Piura": ["Piura", "Ayabaca", "Huancabamba", "Morropón", "Paita", "Sechura", "Sullana", "Talara"],
  "Puno": ["Puno", "Azángaro", "Carabaya", "Chucuito", "El Collao", "Huancané", "Lampa", "Melgar", "Moho", "San Antonio de Putina", "San Román", "Sandia", "Yunguyo"],
  "San Martín": ["Moyobamba", "Bellavista", "El Dorado", "Huallaga", "Lamas", "Mariscal Cáceres", "Picota", "Rioja", "San Martín", "Tocache"],
  "Tacna": ["Tacna", "Candarave", "Jorge Basadre", "Tarata"],
  "Tumbes": ["Tumbes", "Contralmirante Villar", "Zarumilla"],
  "Ucayali": ["Coronel Portillo", "Atalaya", "Padre Abad", "Purús"],
}

/**
 * Distritos principales fuera de Lima Metropolitana y del Callao (las ciudades donde más se anuncian
 * inmuebles). No son todos los distritos del país: el catálogo agrega los demás cuando aparecen.
 */
export const DISTRITOS_PRINCIPALES: Record<string, readonly string[]> = {
  "Áncash": ["Huaraz", "Independencia", "Chimbote", "Nuevo Chimbote", "Casma", "Huarmey"],
  "Arequipa": ["Arequipa", "Cayma", "Cerro Colorado", "Yanahuara", "Sachaca", "Socabaya", "Paucarpata", "Miraflores", "Mariano Melgar", "José Luis Bustamante y Rivero", "Jacobo Hunter", "Alto Selva Alegre", "Characato", "Tiabaya", "Sabandía", "Yura", "Camaná", "Mollendo"],
  "Ayacucho": ["Ayacucho", "Carmen Alto", "San Juan Bautista", "Jesús Nazareno"],
  "Cajamarca": ["Cajamarca", "Baños del Inca", "Jaén", "Chota"],
  "Cusco": ["Cusco", "San Sebastián", "San Jerónimo", "Santiago", "Wanchaq", "Saylla", "Poroy", "Urubamba", "Ollantaytambo", "Calca"],
  "Huánuco": ["Huánuco", "Amarilis", "Pillco Marca", "Tingo María"],
  "Ica": ["Ica", "La Tinguiña", "Parcona", "Subtanjalla", "Pisco", "Chincha Alta", "Nasca"],
  "Junín": ["Huancayo", "El Tambo", "Chilca", "Tarma", "Jauja", "La Merced", "Satipo"],
  "La Libertad": ["Trujillo", "Víctor Larco Herrera", "La Esperanza", "El Porvenir", "Florencia de Mora", "Huanchaco", "Laredo", "Moche", "Salaverry", "Alto Trujillo", "Chepén", "Pacasmayo"],
  "Lambayeque": ["Chiclayo", "José Leonardo Ortiz", "La Victoria", "Pimentel", "Pomalca", "Monsefú", "Santa Rosa", "Reque", "Lambayeque", "Ferreñafe"],
  "Lima": ["Huacho", "Huaral", "Barranca", "Supe", "San Vicente de Cañete", "Mala", "Asia", "Chilca", "Huaura", "Oyón"],
  "Loreto": ["Iquitos", "Punchana", "Belén", "San Juan Bautista", "Yurimaguas"],
  "Madre de Dios": ["Tambopata", "Las Piedras", "Iñapari"],
  "Moquegua": ["Moquegua", "Samegua", "Ilo"],
  "Pasco": ["Chaupimarca", "Yanacancha", "Oxapampa", "Villa Rica"],
  "Piura": ["Piura", "Castilla", "Catacaos", "Veintiséis de Octubre", "Sullana", "Paita", "Talara", "Máncora", "Sechura"],
  "Puno": ["Puno", "Juliaca", "Ilave", "Azángaro"],
  "San Martín": ["Tarapoto", "Morales", "La Banda de Shilcayo", "Moyobamba", "Rioja", "Tocache"],
  "Tacna": ["Tacna", "Alto de la Alianza", "Ciudad Nueva", "Pocollay", "Gregorio Albarracín", "Calana"],
  "Tumbes": ["Tumbes", "Zarumilla", "Zorritos"],
  "Ucayali": ["Callería", "Yarinacocha", "Manantay"],
}

/** Tipos de inmueble que publican los portales. */
export const TIPOS_INMUEBLE = [
  "Departamento", "Casa", "Terreno", "Oficina", "Local comercial", "Proyecto", "Habitación", "Edificio", "Cochera",
  "Local industrial", "Chacra o campo", "Hotel", "Otros",
] as const

const ALIAS_TIPO: Record<string, (typeof TIPOS_INMUEBLE)[number]> = {
  departamentos: "Departamento", depto: "Departamento", casas: "Casa", terrenos: "Terreno", lote: "Terreno", lotes: "Terreno",
  oficinas: "Oficina", "locales comerciales": "Local comercial", local: "Local comercial", locales: "Local comercial",
  proyectos: "Proyecto", habitaciones: "Habitación", habitacion: "Habitación", edificios: "Edificio", cocheras: "Cochera",
  estacionamiento: "Cochera", estacionamientos: "Cochera",
  "local industrial o galpon": "Local industrial", "galpon": "Local industrial", "local industrial": "Local industrial",
  chacra: "Chacra o campo", campo: "Chacra o campo", chacras: "Chacra o campo", "chacra o campo": "Chacra o campo", "terreno agricola": "Chacra o campo",
  otro: "Otros",
}

/**
 * Nombre oficial de un tipo de inmueble: «Local Comercial» y «local comercial» pasan a «Local comercial», «Local
 * industrial o galpón» a «Local industrial». Lo que no se reconoce se deja como llegó (con la primera letra en mayúscula).
 */
export function tipoCanonico(tipo: string): string {
  const clave = claveNombre(tipo)
  const oficial = TIPOS_INMUEBLE.find(t => claveNombre(t) === clave)
  if (oficial) return oficial
  if (ALIAS_TIPO[clave]) return ALIAS_TIPO[clave]
  return tipo.trim().charAt(0).toUpperCase() + tipo.trim().slice(1)
}

// ── Jerarquía geográfica coherente: departamento → provincia → distrito ────────────────────────

/** Distritos principales que NO están en la provincia capital de su departamento (el resto sí lo está). */
const PROVINCIA_DE_PRINCIPAL: Record<string, string> = {
  "Áncash|Chimbote": "Santa", "Áncash|Nuevo Chimbote": "Santa", "Áncash|Casma": "Casma", "Áncash|Huarmey": "Huarmey",
  "Arequipa|Camaná": "Camaná", "Arequipa|Mollendo": "Islay",
  "Cajamarca|Jaén": "Jaén", "Cajamarca|Chota": "Chota",
  "Cusco|Urubamba": "Urubamba", "Cusco|Ollantaytambo": "Urubamba", "Cusco|Calca": "Calca",
  "Huánuco|Tingo María": "Leoncio Prado",
  "Ica|Chincha Alta": "Chincha", "Ica|Pisco": "Pisco", "Ica|Nasca": "Nasca",
  "Junín|Tarma": "Tarma", "Junín|Jauja": "Jauja", "Junín|La Merced": "Chanchamayo", "Junín|Satipo": "Satipo",
  "La Libertad|Chepén": "Chepén", "La Libertad|Pacasmayo": "Pacasmayo",
  "Lambayeque|Lambayeque": "Lambayeque", "Lambayeque|Ferreñafe": "Ferreñafe",
  "Lima|Huacho": "Huaura", "Lima|Huaura": "Huaura", "Lima|Huaral": "Huaral", "Lima|Barranca": "Barranca", "Lima|Supe": "Barranca",
  "Lima|San Vicente de Cañete": "Cañete", "Lima|Mala": "Cañete", "Lima|Asia": "Cañete", "Lima|Chilca": "Cañete", "Lima|Oyón": "Oyón",
  "Loreto|Yurimaguas": "Alto Amazonas",
  "Madre de Dios|Iñapari": "Tahuamanu",
  "Moquegua|Ilo": "Ilo",
  "Pasco|Oxapampa": "Oxapampa", "Pasco|Villa Rica": "Oxapampa",
  "Piura|Sullana": "Sullana", "Piura|Paita": "Paita", "Piura|Talara": "Talara", "Piura|Máncora": "Talara", "Piura|Sechura": "Sechura",
  "Puno|Juliaca": "San Román", "Puno|Ilave": "El Collao", "Puno|Azángaro": "Azángaro",
  "San Martín|Moyobamba": "Moyobamba", "San Martín|Rioja": "Rioja", "San Martín|Tocache": "Tocache", "San Martín|Tarapoto": "San Martín", "San Martín|Morales": "San Martín", "San Martín|La Banda de Shilcayo": "San Martín",
  "Tumbes|Zarumilla": "Zarumilla", "Tumbes|Zorritos": "Contralmirante Villar",
}

/** Provincia de uno de los distritos principales de un departamento (la capital salvo excepciones); `null` si no se conoce. */
export function provinciaDeDistritoPrincipal(departamento: string, distrito: string): string | null {
  const dep = Object.keys(DISTRITOS_PRINCIPALES).find(d => claveNombre(d) === claveNombre(departamento))
  if (!dep) return null
  const d = DISTRITOS_PRINCIPALES[dep].find(x => claveNombre(x) === claveNombre(distrito))
  if (!d) return null
  const excepcion = Object.entries(PROVINCIA_DE_PRINCIPAL).find(([k]) => claveNombre(k) === claveNombre(`${dep}|${d}`))
  return excepcion?.[1] ?? PROVINCIAS[dep]?.[0] ?? null
}

/** Departamento de una provincia cuando el nombre es de una sola provincia del país; `null` si es ambiguo o desconocido. */
export function departamentoDeProvincia(provincia: string | null | undefined): string | null {
  const k = claveNombre(provincia ?? "")
  if (!k) return null
  const dueños = Object.entries(PROVINCIAS).filter(([, lista]) => lista.some(p => claveNombre(p) === k)).map(([dep]) => dep)
  return dueños.length === 1 ? dueños[0] : null
}

export interface Lugar {
  departamento: string | null
  provincia: string | null
  distrito: string | null
}

/**
 * Ubicación coherente. Un distrito de Lima Metropolitana o del Callao manda sobre lo que diga el portal (Lima y Callao
 * son departamentos distintos, pero varios portales publican el Callao como «Lima»); si no, una provincia que solo
 * existe en un departamento fija ese departamento. Lo demás se conserva tal como llegó.
 */
export function ubicacionCanonica(l: Lugar): Lugar {
  const distrito = distritoCanonico(l.distrito)
  const deDistrito = ubicacionDeDistrito(distrito)
  // Solo se corrige la confusión Lima/Callao (o la falta de departamento): un «La Victoria» de Lambayeque sigue en Lambayeque.
  const claveDep = claveNombre(l.departamento ?? "")
  if (deDistrito && (!claveDep || claveDep === "lima" || claveDep === "callao")) return { ...deDistrito, distrito }
  let provincia = nombreDeLugar(l.provincia)
  let departamento = nombreDeLugar(l.departamento)
  // Algunos portales ponen una provincia donde va el departamento («Cañete», «Pisco»): se corrige al departamento real.
  if (departamento && !DEPARTAMENTOS.some(d => claveNombre(d) === claveNombre(departamento!))) {
    const real = departamentoDeProvincia(departamento)
    if (real) {
      provincia ??= departamento
      departamento = real
    }
  }
  const deProvincia = departamentoDeProvincia(provincia)
  return { departamento: deProvincia ?? departamento, provincia, distrito }
}
