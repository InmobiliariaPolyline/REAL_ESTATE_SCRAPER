// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FILTERS, type FilterState } from '@/types'
import { reiniciarFacetas } from '@/hooks/useFacetas'
import PortalFilters from './PortalFilters'

const fetchFacetas = vi.fn()
vi.mock('@/lib/facetas', () => ({ fetchFacetas: () => fetchFacetas() }))

const FACETAS = {
  departamentos: [{ valor: 'Lima', n: 40 }, { valor: 'Arequipa', n: 6 }],
  provincias: [{ valor: 'Lima', padre: 'Lima', n: 40 }, { valor: 'Arequipa', padre: 'Arequipa', n: 6 }, { valor: 'Camaná', padre: 'Arequipa', n: 1 }],
  distritos: [{ valor: 'Miraflores', padre: 'Lima', n: 12 }, { valor: 'Cayma', padre: 'Arequipa', n: 4 }],
  inmuebles: [{ valor: 'Departamento', n: 30 }, { valor: 'Casa', n: 10 }, { valor: 'Terreno', n: 3 }],
  anunciantes: [{ valor: 'Inmobiliaria Prisma', n: 5 }],
}

beforeEach(() => {
  reiniciarFacetas()
  fetchFacetas.mockReset().mockResolvedValue(FACETAS)
})

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

  it('las listas de departamento, provincia y tipo salen del catálogo, con su cantidad', async () => {
    render(<Harness />)
    const departamento = screen.getByLabelText('Departamento')
    expect(await within(departamento).findByRole('option', { name: 'Arequipa (6)' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Tipo de inmueble')).getByRole('option', { name: 'Terreno (3)' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Ciudad o provincia')).getByRole('option', { name: 'Camaná (1)' })).toBeInTheDocument()
  })

  it('al elegir un departamento las provincias se limitan a ese departamento y se limpia la anterior', async () => {
    render(<Harness inicial={{ ...DEFAULT_FILTERS, departamento: 'Lima', provincia: 'Lima' }} />)
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Arequipa (6)' })
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    expect(screen.getByLabelText('Ciudad o provincia')).toHaveValue('')
    expect(within(screen.getByLabelText('Ciudad o provincia')).queryByRole('option', { name: 'Lima (40)' })).toBeNull() // la provincia de Lima ya no se ofrece
    await userEvent.selectOptions(screen.getByLabelText('Ciudad o provincia'), 'Camaná')
    expect(screen.getByLabelText('Ciudad o provincia')).toHaveValue('Camaná')
  })

  it('el tipo de inmueble y «solo con precio» se aplican como chips', async () => {
    render(<Harness />)
    await within(screen.getByLabelText('Tipo de inmueble')).findByRole('option', { name: 'Terreno (3)' })
    await userEvent.selectOptions(screen.getByLabelText('Tipo de inmueble'), 'Terreno')
    await userEvent.click(screen.getByLabelText('Solo avisos con precio publicado'))
    const chips = screen.getByLabelText('Filtros aplicados')
    expect(within(chips).getByText('Terreno')).toBeInTheDocument()
    expect(within(chips).getByText('Con precio')).toBeInTheDocument()
  })

  it('cocheras y antigüedad máxima se eligen en el desglose', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /Más filtros/ }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Cocheras' })).getByRole('button', { name: '2+' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Máxima' })).getByRole('button', { name: 'Estreno' }))
    const chips = screen.getByLabelText('Filtros aplicados')
    expect(within(chips).getByText('2+ cocheras')).toBeInTheDocument()
    expect(within(chips).getByText('Estreno')).toBeInTheDocument()
  })

  it('sin datos de ubicación en el catálogo las listas salen vacías y el distrito sigue sugiriendo', async () => {
    fetchFacetas.mockResolvedValue({ departamentos: [], provincias: [], distritos: [], inmuebles: [], anunciantes: [] })
    render(<Harness />)
    expect(await screen.findAllByRole('option', { name: 'Sin datos aún' })).toHaveLength(2)
    await userEvent.type(screen.getByLabelText('Distrito'), 'mira')
    expect(await screen.findByRole('button', { name: 'Miraflores' })).toBeInTheDocument() // lista de respaldo
    expect(screen.getByRole('option', { name: 'Casa' })).toBeInTheDocument() // tipos de respaldo
  })

  it('si no se pueden cargar las facetas los filtros siguen funcionando', async () => {
    fetchFacetas.mockRejectedValue(new Error('sin red'))
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Palabra clave'), 'terraza')
    expect(screen.getByText('1 activo')).toBeInTheDocument()
  })
})
