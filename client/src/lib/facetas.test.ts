import { describe, expect, it } from 'vitest'
import { DEPARTAMENTOS, DISTRITOS_PRINCIPALES, PROVINCIAS } from '@shared/ubicacion'
import { combinarFacetas } from './facetas'

describe('catálogo completo del Perú', () => {
  it('tiene 25 departamentos (24 más el Callao) y 196 provincias, cada una en su departamento', () => {
    expect(DEPARTAMENTOS).toHaveLength(25)
    expect(Object.keys(PROVINCIAS).sort()).toEqual([...DEPARTAMENTOS].sort())
    expect(Object.values(PROVINCIAS).reduce((n, l) => n + l.length, 0)).toBe(196)
    for (const dep of Object.keys(DISTRITOS_PRINCIPALES)) expect(DEPARTAMENTOS).toContain(dep as never)
  })
})

describe('combinarFacetas', () => {
  it('sin catálogo ofrece todo con 0 avisos', () => {
    const f = combinarFacetas(null)
    expect(f.departamentos).toHaveLength(25)
    expect(f.departamentos.every(d => d.n === 0)).toBe(true)
    expect(f.provincias).toHaveLength(196)
    expect(f.inmuebles.map(t => t.valor)).toEqual(expect.arrayContaining(['Departamento', 'Casa', 'Terreno', 'Oficina']))
    expect(f.distritos.map(d => d.valor)).toEqual(expect.arrayContaining(['Miraflores', 'Ventanilla', 'Cayma', 'Wanchaq']))
    expect(f.anunciantes).toEqual([])
  })

  it('suma las cantidades del catálogo y deja primero lo que tiene avisos', () => {
    const f = combinarFacetas({
      departamentos: [{ valor: 'Lima', n: 40 }, { valor: 'Arequipa', n: 6 }],
      provincias: [{ valor: 'Camaná', padre: 'Arequipa', n: 1 }],
      inmuebles: [{ valor: 'Local Comercial', n: 2 }, { valor: 'local comercial', n: 3 }, { valor: 'Casa', n: 10 }],
      distritos: [{ valor: 'Cayma', padre: 'Arequipa', n: 4 }, { valor: 'Miraflores', padre: null, n: 12 }],
      anunciantes: [{ valor: 'Prisma', n: 5 }],
    })
    expect(f.departamentos.slice(0, 2).map(d => [d.valor, d.n])).toEqual([['Lima', 40], ['Arequipa', 6]])
    expect(f.departamentos[2].valor).toBe('Amazonas') // el resto, por orden alfabético
    expect(f.provincias[0]).toMatchObject({ valor: 'Camaná', n: 1, padre: 'Arequipa' })
    // Distintas formas de escribir un tipo se suman en uno solo.
    expect(f.inmuebles.filter(t => /local comercial/i.test(t.valor))).toEqual([{ valor: 'Local comercial', n: 5, padre: null, provincia: null }])
    expect(f.inmuebles[0]).toMatchObject({ valor: 'Casa', n: 10 })
    // Un distrito sin departamento se une al del mismo nombre de la lista completa.
    expect(f.distritos.find(d => d.valor === 'Miraflores' && d.padre === 'Lima')!.n).toBe(12)
    expect(f.distritos.find(d => d.valor === 'Cayma')!.n).toBe(4)
    expect(f.anunciantes).toEqual([{ valor: 'Prisma', n: 5 }])
  })

  it('agrega los valores del catálogo que no están en la lista completa', () => {
    const f = combinarFacetas({ distritos: [{ valor: 'Lugar Nuevo', padre: 'Cusco', n: 2 }], inmuebles: [{ valor: 'Bóveda', n: 1 }] })
    expect(f.distritos.find(d => d.valor === 'Lugar Nuevo')).toMatchObject({ n: 2, padre: 'Cusco' })
    expect(f.inmuebles.find(t => t.valor === 'Bóveda')!.n).toBe(1)
  })

  it('el Callao no aparece dos veces aunque un portal lo publique dentro de «Lima»', () => {
    const f = combinarFacetas({
      departamentos: [{ valor: 'Lima', n: 50 }],
      provincias: [{ valor: 'Callao', padre: 'Lima', n: 3 }, { valor: 'Callao', padre: 'Callao', n: 2 }],
      distritos: [{ valor: 'Callao', padre: 'Lima', provincia: 'Callao', n: 3 }, { valor: 'Callao', padre: 'Callao', provincia: 'Callao', n: 2 }, { valor: 'Ventanilla', padre: 'Lima', provincia: 'Lima', n: 1 }],
    })
    expect(f.provincias.filter(p => p.valor === 'Callao')).toEqual([{ valor: 'Callao', n: 5, padre: 'Callao', provincia: null }])
    expect(f.distritos.filter(d => d.valor === 'Callao')).toHaveLength(1)
    expect(f.distritos.find(d => d.valor === 'Callao')).toMatchObject({ n: 5, padre: 'Callao', provincia: 'Callao' })
    // Ventanilla es del Callao aunque el portal diga «Lima».
    expect(f.distritos.find(d => d.valor === 'Ventanilla')).toMatchObject({ n: 1, padre: 'Callao', provincia: 'Callao' })
  })

  it('ningún valor se repite con el mismo nombre, departamento y provincia', () => {
    const f = combinarFacetas({ provincias: [{ valor: 'Lima', padre: 'Lima', n: 9 }], distritos: [{ valor: 'Miraflores', padre: 'Lima', provincia: 'Lima', n: 4 }, { valor: 'miraflores', padre: 'Lima', provincia: 'Lima', n: 1 }] })
    for (const lista of [f.departamentos, f.provincias, f.distritos]) {
      const claves = lista.map(x => `${x.valor.toLowerCase()}|${x.padre}|${x.provincia}`)
      expect(new Set(claves).size).toBe(claves.length)
    }
    expect(f.distritos.find(d => d.valor === 'Miraflores' && d.padre === 'Lima')!.n).toBe(5)
  })
})
