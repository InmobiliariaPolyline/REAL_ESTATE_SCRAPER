// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reiniciarFacetas } from '@/hooks/useFacetas'
import { EMPTY_ADMIN_SEARCH, type AdminSearchFilters } from '@/lib/propertiesApi'
import PropiedadesFilters from './PropiedadesFilters'

const fetchFacetas = vi.fn()
vi.mock('@/lib/facetas', () => ({ fetchFacetas: () => fetchFacetas() }))

const FACETAS = {
  departamentos: [{ valor: 'Lima', n: 40 }, { valor: 'Arequipa', n: 6 }],
  provincias: [{ valor: 'Lima', padre: 'Lima', n: 40 }, { valor: 'Camaná', padre: 'Arequipa', n: 1 }],
  distritos: [],
  inmuebles: [{ valor: 'Casa', n: 10 }, { valor: 'Terreno', n: 3 }],
  anunciantes: [{ valor: 'Inmobiliaria Prisma', n: 5 }],
}

function Harness({ onSearch = vi.fn(), onClear = vi.fn() }: { onSearch?: () => void; onClear?: () => void }) {
  const [filters, setFilters] = useState<AdminSearchFilters>(EMPTY_ADMIN_SEARCH)
  return <PropiedadesFilters filters={filters} onChange={setFilters} onSearch={onSearch} onClear={onClear} />
}

beforeEach(() => {
  reiniciarFacetas()
  fetchFacetas.mockReset().mockResolvedValue(FACETAS)
})

describe('PropiedadesFilters (administración)', () => {
  it('«Más filtros» está cerrado al inicio, se abre y cuenta lo que se elige', async () => {
    render(<Harness />)
    const boton = screen.getByRole('button', { name: /Más filtros/ })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(boton.getAttribute('aria-controls')!)).toHaveAttribute('inert')

    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Arequipa (6)' })
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    await userEvent.click(within(screen.getByRole('group', { name: 'Cocheras' })).getByRole('button', { name: '2+' }))
    await userEvent.click(screen.getByLabelText('Solo avisos con precio publicado'))
    expect(within(boton).getByText('3')).toBeInTheDocument()
  })

  it('las provincias se limitan al departamento elegido y el tipo sale del catálogo', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /Más filtros/ }))
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Arequipa (6)' })
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    const provincia = screen.getByLabelText('Ciudad o provincia')
    expect(within(provincia).getByRole('option', { name: 'Camaná (1)' })).toBeInTheDocument()
    expect(within(provincia).queryByRole('option', { name: 'Lima (40)' })).toBeNull()
    expect(within(screen.getByLabelText('Tipo de inmueble')).getByRole('option', { name: 'Terreno (3)' })).toBeInTheDocument()
  })

  it('buscar y limpiar siguen funcionando y no dependen de las facetas', async () => {
    fetchFacetas.mockRejectedValue(new Error('sin red'))
    const onSearch = vi.fn()
    const onClear = vi.fn()
    render(<Harness onSearch={onSearch} onClear={onClear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
