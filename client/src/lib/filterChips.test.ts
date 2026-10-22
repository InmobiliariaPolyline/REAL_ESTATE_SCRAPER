import { describe, expect, it } from 'vitest'
import { DEFAULT_PORTAL_FILTERS } from '@shared/savedSearch'
import { atajosDePrecio, filtrosActivos } from './filterChips'

const base = { ...DEFAULT_PORTAL_FILTERS, portales: [] as string[] }

describe('filtrosActivos', () => {
  it('sin cambios no hay chips', () => {
    expect(filtrosActivos(base)).toEqual([])
  })

  it('describe cada filtro y sabe cómo quitarlo', () => {
    const chips = filtrosActivos({
      ...base, texto: ' vista al mar ', distrito: 'Miraflores', operacion: 'VENTA', inmueble: 'Casa', portales: ['Urbania', 'Properati'],
      moneda: 'USD', precioMin: 100000, precioMax: 200000, dormitorios: '3', banios: '2', areaMin: 80, areaMax: '', publicado: 'semana',
    })
    expect(chips.map(c => c.etiqueta)).toEqual([
      '«vista al mar»', 'Miraflores', 'Venta', 'Casa', 'Urbania, Properati', 'USD 100,000 – 200,000', '3 dorm.', '2 baños', 'Desde 80 m²', 'Última semana',
    ])
    expect(chips.filter(c => c.avanzado).map(c => c.clave)).toEqual(['dormitorios', 'banios', 'area', 'publicado'])
    expect(chips.find(c => c.clave === 'precio')!.quitar).toEqual({ precioMin: '', precioMax: '' })
    expect(chips.find(c => c.clave === 'operacion')!.quitar).toEqual({ operacion: 'todos' })
  })

  it('un solo límite de precio o de área se dice con «Desde» / «Hasta»', () => {
    expect(filtrosActivos({ ...base, precioMax: 2500 })[0].etiqueta).toBe('Hasta S/ 2,500')
    expect(filtrosActivos({ ...base, areaMax: 60 })[0].etiqueta).toBe('Hasta 60 m²')
  })
})

describe('atajosDePrecio', () => {
  it('ofrece topes distintos según moneda y operación, de menor a mayor', () => {
    for (const m of ['PEN', 'USD'] as const) {
      for (const o of ['VENTA', 'ALQUILER', 'todos'] as const) {
        const a = atajosDePrecio(m, o)
        expect(a).toHaveLength(4)
        expect([...a].sort((x, y) => x - y)).toEqual(a)
      }
    }
    expect(atajosDePrecio('PEN', 'ALQUILER')[0]).toBeLessThan(atajosDePrecio('PEN', 'VENTA')[0])
  })
})
