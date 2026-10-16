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
