// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PropertyCard from './PropertyCard'

vi.mock('./EnlacesPropiedad', () => ({ default: () => null }))

const base = {
  id: 'infocasas:1', portal: 'infocasas', operacion: 'VENTA', titulo: 'Departamento en Miraflores', precio: 300000, precioUsd: 80000, moneda: 'PEN' as const,
  monedaOriginal: 'PEN', distrito: 'Miraflores', dormitorios: '3', banios: '2', area: '100 m2', imagen: 'https://img.test/1.jpg', url: 'https://www.infocasas.com.pe/x', index: 0,
}

describe('PropertyCard', () => {
  it('muestra el tipo, la operación, el precio con su precio por m² y las fichas con su unidad', () => {
    render(<PropertyCard {...base} inmueble="Departamento" fotos={8} estacionamientos="2" antiguedad="Estreno" />)
    expect(screen.getAllByText('Departamento').length).toBeGreaterThan(0)
    expect(screen.getByText('Venta')).toBeInTheDocument()
    expect(screen.getByText('S/ 300,000')).toBeInTheDocument()
    expect(screen.getByText('S/ 3,000 por m²')).toBeInTheDocument()
    expect(screen.getByText('dorm.')).toBeInTheDocument()
    expect(screen.getByText('baños')).toBeInTheDocument()
    expect(screen.getByText('100 m²')).toBeInTheDocument()
    expect(screen.getByText('cocheras')).toBeInTheDocument()
    expect(screen.getByText('Estreno')).toBeInTheDocument()
    expect(screen.getByTitle('8 fotos')).toBeInTheDocument()
  })

  it('un alquiler dice «al mes» y no muestra precio por m²', () => {
    render(<PropertyCard {...base} operacion="ALQUILER" precio={3500} precioUsd={930} inmueble="Casa" />)
    expect(screen.getByText('Alquiler')).toBeInTheDocument()
    expect(screen.getByText('al mes')).toBeInTheDocument()
    expect(screen.queryByText(/por m²/)).toBeNull()
  })

  it('un proyecto dice «Desde» y muestra su estado de construcción', () => {
    render(<PropertyCard {...base} inmueble="Proyecto" antiguedad="En construcción" />)
    expect(screen.getByText('Desde')).toBeInTheDocument()
    expect(screen.getAllByText('Proyecto').length).toBeGreaterThan(0)
    expect(screen.getByText('En construcción')).toBeInTheDocument()
  })

  it('sin precio no muestra símbolo de moneda ni «0»', () => {
    const { container } = render(<PropertyCard {...base} precio={0} precioUsd={0} inmueble="Casa" />)
    expect(screen.getByText('Sin precio')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/(S\/|USD)\s?~?0/)
    expect(screen.queryByText(/por m²/)).toBeNull()
    expect(screen.queryByText('Desde')).toBeNull()
  })

  it('«Nuevo» solo aparece en avisos recientes', () => {
    const { rerender } = render(<PropertyCard {...base} inmueble="Casa" creadoEn={new Date(Date.now() - 3_600_000).toISOString()} />)
    expect(screen.getByText('Nuevo')).toBeInTheDocument()
    rerender(<PropertyCard {...base} inmueble="Casa" creadoEn={new Date(Date.now() - 30 * 86_400_000).toISOString()} />)
    expect(screen.queryByText('Nuevo')).toBeNull()
  })

  it('oculta las fichas sin dato y muestra el departamento cuando no es Lima', () => {
    render(<PropertyCard {...base} inmueble="Terreno" dormitorios="" banios="" distrito="Cayma" departamento="Arequipa" />)
    expect(screen.queryByText('dorm.')).toBeNull()
    expect(screen.queryByText('baños')).toBeNull()
    expect(screen.getByText('Cayma, Arequipa')).toBeInTheDocument()
  })
})
