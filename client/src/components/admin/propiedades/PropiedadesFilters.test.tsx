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

function Harness({ onSearch = vi.fn(), onClear = vi.fn(), onChangeSpy }: { onSearch?: () => void; onClear?: () => void; onChangeSpy?: (f: AdminSearchFilters) => void }) {
  const [filters, setFilters] = useState<AdminSearchFilters>(EMPTY_ADMIN_SEARCH)
  return (
    <PropiedadesFilters
      filters={filters}
      onChange={f => {
        setFilters(f)
        onChangeSpy?.(f)
      }}
      onSearch={onSearch}
      onClear={onClear}
    />
  )
}

beforeEach(() => {
  reiniciarFacetas()
  fetchFacetas.mockReset().mockResolvedValue(FACETAS)
})

describe('PropiedadesFilters (administración)', () => {
  it('muestra todos los bloques a la vista, sin desglose', () => {
    render(<Harness />)
    for (const t of ['Buscar', 'Operación y portal', 'Tipo de inmueble', 'Ubicación', 'Precio', 'Ambientes y cocheras', 'Área construida', 'Antigüedad', 'Anunciante', 'Publicación']) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /Más filtros/ })).toBeNull()
  })

  it('las fichas y las listas del catálogo cambian los filtros', async () => {
    const spy = vi.fn()
    render(<Harness onChangeSpy={spy} />)
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Arequipa (6)' })
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    await userEvent.click(within(screen.getByRole('group', { name: 'Cocheras' })).getByRole('button', { name: '2+' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Operación' })).getByRole('button', { name: 'Venta' }))
    await userEvent.click(screen.getByLabelText('Solo avisos con precio publicado'))
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ departamento: 'Arequipa', cocheras: '2+', operacion: 'VENTA', soloConPrecio: true }))
    expect(screen.getByText('3 de detalle')).toBeInTheDocument()
  })

  it('las provincias se limitan al departamento elegido y el tipo sale del catálogo', async () => {
    render(<Harness />)
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Arequipa (6)' })
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    const provincia = screen.getByLabelText('Ciudad o provincia')
    expect(within(provincia).getByRole('option', { name: 'Camaná (1)' })).toBeInTheDocument()
    expect(within(provincia).queryByRole('option', { name: 'Lima (40)' })).toBeNull()
    expect(await within(screen.getByRole('group', { name: 'Tipo' })).findByRole('button', { name: /Terreno/ })).toHaveTextContent('3')
  })

  it('cambiar la moneda limpia los precios escritos', async () => {
    const spy = vi.fn()
    render(<Harness onChangeSpy={spy} />)
    await userEvent.type(screen.getByLabelText('Mín. (USD)'), '100000')
    await userEvent.click(within(screen.getByRole('group', { name: 'Moneda del rango' })).getByRole('button', { name: /Soles/ }))
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ moneda: 'PEN', precioMin: '', precioMax: '' }))
    expect(screen.getByLabelText('Mín. (S/)')).toHaveValue(null)
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
