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
