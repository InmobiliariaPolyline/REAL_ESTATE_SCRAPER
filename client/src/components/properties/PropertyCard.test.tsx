// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PropertyCard from './PropertyCard'

vi.mock('./EnlacesPropiedad', () => ({ default: () => null }))

const base = {
  id: 'infocasas:1', portal: 'infocasas', operacion: 'VENTA', titulo: 'Departamento en Miraflores', precio: 300000, precioUsd: 80000, moneda: 'PEN' as const,
  monedaOriginal: 'PEN', distrito: 'Miraflores', dormitorios: '3', banios: '2', area: '100 m2', imagen: 'https://img.test/1.jpg', url: 'https://www.infocasas.com.pe/x', index: 0,
}

/** Texto completo de una insignia partida: «moneda monto», «etiqueta valor». */
const insignia = (container: HTMLElement) => Array.from(container.querySelectorAll('.sb')).map(e => e.textContent?.replace(/\s+/g, ' ').trim())

describe('PropertyCard', () => {
  it('muestra tipo, operación, precio con su precio por m² y las fichas como insignias partidas', () => {
    const { container } = render(<PropertyCard {...base} inmueble="Departamento" fotos={8} estacionamientos="2" antiguedad="Estreno" />)
    const todas = insignia(container)
    expect(todas).toEqual(expect.arrayContaining(['Tipo Departamento', 'Op. Venta', 'S/ 300,000', 'Por m² S/ 3,000', 'Dorm 3', 'Baños 2', 'Área 100 m²', 'Coch 2', 'Estado Estreno', '8 fotos']))
  })

  it('el precio es la parte de color y la moneda la etiqueta oscura', () => {
    const { container } = render(<PropertyCard {...base} inmueble="Casa" />)
    const precio = Array.from(container.querySelectorAll('.sb')).find(e => e.textContent === 'S/ 300,000') as HTMLElement
    expect(precio.className).toContain('sb-lg')
    expect(precio.querySelector('.sb-l')?.textContent).toBe('S/')
    expect(precio.querySelector('.sb-v')?.textContent).toBe('300,000')
  })

  it('un alquiler dice «/ mes», va en verde y no muestra precio por m²', () => {
    const { container } = render(<PropertyCard {...base} operacion="ALQUILER" precio={3500} precioUsd={930} inmueble="Casa" />)
    expect(insignia(container)).toEqual(expect.arrayContaining(['Op. Alquiler', 'S/ 3,500 / mes']))
    expect(insignia(container).some(t => t?.startsWith('Por m²'))).toBe(false)
    expect(container.querySelector('.sb-lg.sb-green')).not.toBeNull()
  })

  it('un proyecto dice «Desde» y muestra su estado de construcción', () => {
    const { container } = render(<PropertyCard {...base} inmueble="Proyecto" antiguedad="En construcción" />)
    expect(insignia(container)).toEqual(expect.arrayContaining(['Tipo Proyecto', 'Desde · S/ 300,000', 'Estado En construcción']))
  })

  it('un proyecto con varias tipologías muestra «Desde» y «Hasta», sus cantidades y su área como rango, sin un precio por m² engañoso', () => {
    // B34 (Surquillo): de 1 a 3 dormitorios, de 54 a 66 m², de US$ 108,700 a 130,600.
    const { container } = render(
      <PropertyCard {...base} inmueble="Proyecto" titulo="B34" precio={108700} precioUsd={108700} precioMax={130600} moneda="USD" monedaOriginal="USD"
        dormitorios="1, 2, 3" banios="1, 2" area="54 – 66 m2" antiguedad="En construcción" />
    )
    const todas = insignia(container)
    expect(todas).toEqual(expect.arrayContaining(['Tipo Proyecto', 'Desde · USD 108,700', 'Hasta · USD 130,600', 'Dorm 1, 2, 3', 'Baños 1, 2', 'Área 54 – 66 m²', 'Estado En construcción']))
    expect(todas.some(t => t?.startsWith('Por m²'))).toBe(false)
    expect(todas.some(t => t?.startsWith('Tipo Departamento'))).toBe(false)
  })

  it('el «Hasta» solo aparece en proyectos con un precio más alto que el «Desde»', () => {
    const sinRango = render(<PropertyCard {...base} inmueble="Proyecto" precioMax={null} />)
    expect(insignia(sinRango.container).some(t => t?.startsWith('Hasta'))).toBe(false)
    const igual = render(<PropertyCard {...base} inmueble="Proyecto" precioMax={300000} />)
    expect(insignia(igual.container).some(t => t?.startsWith('Hasta'))).toBe(false)
    // Un aviso que no es proyecto nunca muestra «Hasta».
    const normal = render(<PropertyCard {...base} inmueble="Departamento" precioMax={500000} />)
    expect(insignia(normal.container).some(t => t?.startsWith('Hasta'))).toBe(false)
  })

  it('sin precio no muestra símbolo de moneda ni «0»', () => {
    const { container } = render(<PropertyCard {...base} precio={0} precioUsd={0} inmueble="Casa" />)
    expect(insignia(container)).toContain('Precio Sin precio')
    expect(container.textContent).not.toMatch(/(S\/|USD)\s?~?0/)
    expect(insignia(container).some(t => t?.startsWith('Por m²') || t?.startsWith('≈'))).toBe(false)
  })

  it('«Nuevo» solo aparece en avisos recientes', () => {
    const { container, rerender } = render(<PropertyCard {...base} inmueble="Casa" creadoEn={new Date(Date.now() - 3_600_000).toISOString()} />)
    expect(insignia(container)).toContain('Nuevo')
    rerender(<PropertyCard {...base} inmueble="Casa" creadoEn={new Date(Date.now() - 30 * 86_400_000).toISOString()} />)
    expect(insignia(container)).not.toContain('Nuevo')
  })

  it('oculta las fichas sin dato y muestra el departamento cuando no es Lima', () => {
    const { container } = render(<PropertyCard {...base} inmueble="Terreno" dormitorios="" banios="" distrito="Cayma" departamento="Arequipa" />)
    expect(insignia(container).some(t => t?.startsWith('Dorm') || t?.startsWith('Baños'))).toBe(false)
    expect(screen.getByText('Cayma, Arequipa')).toBeInTheDocument()
  })

  it('el precio es el publicado, sin convertir: en dólares muestra USD y la conversión aparte', () => {
    const { container } = render(<PropertyCard {...base} precio={340000} precioUsd={340000} monedaOriginal="USD" moneda="PEN" inmueble="Departamento" />)
    const todas = insignia(container)
    expect(todas).toContain('USD 340,000')
    expect(todas).toContain('Por m² USD 3,400')
    expect(todas.some(t => t?.startsWith('≈ S/'))).toBe(true)
    expect(todas.some(t => /^S\/ ~/.test(t ?? ''))).toBe(false)
  })
})
