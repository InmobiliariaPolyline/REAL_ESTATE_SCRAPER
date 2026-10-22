import { describe, expect, it } from 'vitest'
import {
  antiguedadTexto,
  categoriaTamano,
  diasDesde,
  financiamiento,
  mapaUrl,
  posicionEnRango,
  posicionEnZona,
  precioPorM2,
  preciosDelAviso,
  resumenDelAviso,
  variacionDePrecio,
  whatsappUrl,
  type MercadoZona,
} from './propertyInsights'
import type { Propiedad } from '@/types'

const mercado = (over: Partial<MercadoZona> = {}): MercadoZona => ({
  avisos: 20, mediana_usd: 100000, min_usd: 50000, max_usd: 250000, mediana_m2_usd: 1500, mas_baratos: 5, ...over,
})

describe('preciosDelAviso / precioPorM2', () => {
  it('completa la moneda que falta con el tipo de cambio', () => {
    expect(preciosDelAviso({ precio: 375000, precio_usd: 0, moneda: 'PEN' }, 3.75)).toMatchObject({ usd: 100000, pen: 375000 })
    expect(preciosDelAviso({ precio: 100000, precio_usd: 100000, moneda: 'USD' }, 3.75)).toMatchObject({ usd: 100000, pen: 375000 })
    expect(preciosDelAviso({ precio: 0, precio_usd: 0, moneda: 'PEN' })).toMatchObject({ usd: 0, pen: 0 })
  })

  it('divide entre los m² y tolera la falta de área', () => {
    const r = precioPorM2({ precio: 400000, precio_usd: 100000, moneda: 'PEN', area: '80 m2' })
    expect(r.m2).toBe(80)
    expect(r.usd).toBe(1250)
    expect(r.pen).toBe(5000)
    expect(precioPorM2({ precio: 400000, precio_usd: 100000, moneda: 'PEN', area: '' })).toMatchObject({ m2: null, usd: null, pen: null })
  })
})

describe('posicionEnZona', () => {
  it('clasifica barato, en rango y caro frente a la mediana', () => {
    expect(posicionEnZona(80000, mercado())).toMatchObject({ nivel: 'bajo', difPct: -20 })
    expect(posicionEnZona(105000, mercado())).toMatchObject({ nivel: 'rango' })
    expect(posicionEnZona(130000, mercado())).toMatchObject({ nivel: 'alto' })
    expect(posicionEnZona(80000, mercado())!.percentil).toBe(25)
  })

  it('sin datos suficientes no opina', () => {
    expect(posicionEnZona(80000, null)).toBeNull()
    expect(posicionEnZona(80000, mercado({ avisos: 2 }))).toBeNull()
    expect(posicionEnZona(0, mercado())).toBeNull()
    expect(posicionEnZona(80000, mercado({ mediana_usd: null }))).toBeNull()
  })

  it('ubica el marcador dentro del rango de la zona', () => {
    expect(posicionEnRango(150000, 50000, 250000)).toBe(50)
    expect(posicionEnRango(10, 50000, 250000)).toBe(0)
    expect(posicionEnRango(999999, 50000, 250000)).toBe(100)
    expect(posicionEnRango(100, 50, 50)).toBeNull()
  })
})

describe('financiamiento', () => {
  it('calcula inicial, préstamo, cuota e ingreso sugerido', () => {
    const f = financiamiento(100000)!
    expect(f.inicial).toBe(20000)
    expect(f.prestamo).toBe(80000)
    expect(f.cuota).toBeCloseTo(719.78, 0) // 80 000 a 20 años al 9 %
    expect(f.ingresoSugerido).toBeCloseTo(f.cuota / 0.3, 5)
    expect(f.totalIntereses).toBeGreaterThan(80000)
    expect(financiamiento(0)).toBeNull()
  })
})

describe('tiempo y variación', () => {
  const ahora = new Date('2026-10-22T12:00:00Z').getTime()

  it('cuenta los días y los dice en palabras', () => {
    expect(diasDesde('2026-10-22T08:00:00Z', ahora)).toBe(0)
    expect(diasDesde('2026-10-20T08:00:00Z', ahora)).toBe(2)
    expect(diasDesde('basura', ahora)).toBeNull()
    expect([0, 1, 5, 45, 400, null].map(d => antiguedadTexto(d))).toEqual(['hoy', 'ayer', 'hace 5 días', 'hace 1 mes', 'hace 1 año(s)', '—'])
  })

  it('resume el historial de precios', () => {
    expect(variacionDePrecio([100, 90, 120, 110])).toEqual({ primero: 100, ultimo: 110, minimo: 90, maximo: 120, cambioPct: 10, registros: 4 })
    expect(variacionDePrecio([100])).toBeNull()
    expect(variacionDePrecio([0, 0])).toBeNull()
  })

  it('clasifica el tamaño', () => {
    expect([30, 70, 150, 300, null].map(m => categoriaTamano(m))).toEqual(['compacto', 'medio', 'amplio', 'muy amplio', null])
  })
})

describe('enlaces y resumen', () => {
  const p = { id: 'x', portal: 'urbania', operacion: 'VENTA', inmueble: 'Casa', titulo: 'Casa linda', precio: 1, precio_usd: 1, moneda: 'USD', distrito: 'San Isidro', dormitorios: '3', banios: '2', area: '120 m2', imagen: null, url: 'https://urbania.pe/x' } as Propiedad

  it('arma el mapa por coordenadas o por dirección', () => {
    expect(mapaUrl({ distrito: 'Lince', latitud: -12.1, longitud: -77.03 })).toBe('https://www.google.com/maps/search/?api=1&query=-12.1,-77.03')
    expect(mapaUrl({ distrito: 'San Isidro', direccion: 'Av. Perú 123' })).toContain(encodeURIComponent('Av. Perú 123, San Isidro, Perú'))
    expect(mapaUrl({ distrito: '' })).toBeNull()
  })

  it('arma el resumen y el enlace de WhatsApp', () => {
    const r = resumenDelAviso(p, 'USD 100,000')
    expect(r).toBe('Casa linda\nUSD 100,000\n3 dorm. · 2 baños · 120 m2\nSan Isidro\nhttps://urbania.pe/x')
    expect(whatsappUrl(r)).toBe(`https://wa.me/?text=${encodeURIComponent(r)}`)
  })
})
