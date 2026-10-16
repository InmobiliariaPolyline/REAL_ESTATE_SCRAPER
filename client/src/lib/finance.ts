/** Cálculos de la calculadora de hipoteca y rentabilidad (todo en una misma moneda). */

/** Cuota mensual de un préstamo con amortización francesa (cuota fija). */
export function cuotaMensual(prestamo: number, tasaAnualPct: number, anios: number): number {
  const n = Math.round(anios * 12)
  if (!(prestamo > 0) || n <= 0) return 0
  const i = Math.max(0, tasaAnualPct) / 100 / 12
  if (i === 0) return prestamo / n
  return (prestamo * i) / (1 - Math.pow(1 + i, -n))
}

export interface EntradaCalculo {
  precio: number
  /** Porcentaje del precio pagado al contado (0 a 100). */
  inicialPct: number
  tasaAnualPct: number
  anios: number
  /** Alquiler mensual estimado si se pone en renta. */
  alquilerMensual: number
  /** Gastos mensuales (mantenimiento, arbitrios, seguro…). */
  gastosMensuales: number
}

export interface ResultadoCalculo {
  inicial: number
  prestamo: number
  cuota: number
  totalPagado: number
  totalIntereses: number
  /** Rentabilidad bruta anual (% del precio). */
  rentabilidadBruta: number
  /** Rentabilidad neta anual, descontados los gastos (% del precio). */
  rentabilidadNeta: number
  /** Años que tarda el alquiler neto en igualar el precio; `null` si no hay renta neta. */
  aniosRecuperacion: number | null
  /** Alquiler menos gastos menos cuota, por mes (puede ser negativo). */
  flujoMensual: number
}

const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export function analizar(e: EntradaCalculo): ResultadoCalculo {
  const precio = nonNeg(e.precio)
  const inicialPct = Math.min(100, nonNeg(e.inicialPct))
  const alquiler = nonNeg(e.alquilerMensual)
  const gastos = nonNeg(e.gastosMensuales)

  const inicial = (precio * inicialPct) / 100
  const prestamo = precio - inicial
  const cuota = cuotaMensual(prestamo, e.tasaAnualPct, e.anios)
  const meses = Math.round(nonNeg(e.anios) * 12)
  const totalPagado = cuota * meses
  const rentaNetaAnual = (alquiler - gastos) * 12

  return {
    inicial,
    prestamo,
    cuota,
    totalPagado,
    totalIntereses: Math.max(0, totalPagado - prestamo),
    rentabilidadBruta: precio > 0 ? ((alquiler * 12) / precio) * 100 : 0,
    rentabilidadNeta: precio > 0 ? (rentaNetaAnual / precio) * 100 : 0,
    aniosRecuperacion: precio > 0 && rentaNetaAnual > 0 ? precio / rentaNetaAnual : null,
    flujoMensual: alquiler - gastos - cuota,
  }
}
