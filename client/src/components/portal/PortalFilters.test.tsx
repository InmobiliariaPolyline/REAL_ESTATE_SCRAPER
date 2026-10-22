// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_FILTERS, type FilterState } from '@/types'
import PortalFilters from './PortalFilters'

function Harness({ inicial = DEFAULT_FILTERS, onApply = vi.fn(), onSearch = vi.fn(), onClear = vi.fn() }: { inicial?: FilterState; onApply?: (f: FilterState) => void; onSearch?: () => void; onClear?: (f: FilterState) => void }) {
  const [filters, setFilters] = useState<FilterState>({ ...inicial, portales: [...inicial.portales] })
  return <PortalFilters filters={filters} onFiltersChange={setFilters} onApply={onApply} onSearch={onSearch} onClear={onClear} />
}

describe('PortalFilters', () => {
  it('sin filtros lo dice y no muestra chips', () => {
    render(<Harness />)
    expect(screen.getByText(/Sin filtros: se muestran todos los avisos/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Filtros aplicados')?.querySelector('button')).toBeNull()
  })

  it('«Más filtros» despliega dormitorios, baños, área y publicación, y se oculta a los lectores al cerrarse', async () => {
    render(<Harness />)
    const boton = screen.getByRole('button', { name: /Más filtros/ })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(boton.getAttribute('aria-controls')!)).toHaveAttribute('inert')

    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(boton.getAttribute('aria-controls')!)).not.toHaveAttribute('inert')
    expect(screen.getByLabelText('Área mín. (m²)')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Baños' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Publicado en el sistema' })).toBeInTheDocument()
  })

  it('cada filtro cambiado aparece como chip con contador, y quitarlo lo aplica al instante', async () => {
    const onApply = vi.fn()
    render(<Harness inicial={{ ...DEFAULT_FILTERS, operacion: 'VENTA', banios: '2', areaMin: 80 }} onApply={onApply} />)
    expect(screen.getByText('3 activos')).toBeInTheDocument()
    // Hay filtros avanzados puestos: el desglose ya viene abierto.
    expect(screen.getByRole('button', { name: /Más filtros/ })).toHaveAttribute('aria-expanded', 'true')

    const chips = screen.getByLabelText('Filtros aplicados')
    expect(within(chips).getByText('Venta')).toBeInTheDocument()
    expect(within(chips).getByText('2 baños')).toBeInTheDocument()

    await userEvent.click(within(chips).getByRole('button', { name: 'Quitar filtro: 2 baños' }))
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ banios: 'todos', operacion: 'VENTA', areaMin: 80 }))
    expect(screen.getByText('2 activos')).toBeInTheDocument()
  })

  it('los atajos de precio fijan el tope máximo y buscan', async () => {
    const onApply = vi.fn()
    render(<Harness inicial={{ ...DEFAULT_FILTERS, moneda: 'USD', operacion: 'ALQUILER', precioMin: 100 }} onApply={onApply} />)
    await userEvent.click(screen.getByRole('button', { name: 'Hasta USD 700' }))
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ precioMax: 700, precioMin: '' }))
    expect(screen.getByLabelText('Precio máx. (USD)')).toHaveValue(700)
  })

  it('escribir una palabra clave y buscar; «Limpiar todo» restablece y avisa', async () => {
    const onSearch = vi.fn()
    const onClear = vi.fn()
    render(<Harness onSearch={onSearch} onClear={onClear} />)
    await userEvent.type(screen.getByLabelText('Palabra clave'), 'terraza')
    expect(screen.getByText('1 activo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(onSearch).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: /Limpiar todo/ }))
    expect(onClear).toHaveBeenCalledWith(expect.objectContaining({ texto: '', operacion: 'todos' }))
    expect(screen.getByLabelText('Palabra clave')).toHaveValue('')
  })
})
