// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reiniciarFacetas } from '@/hooks/useFacetas'
import { EMPTY_ADMIN_SEARCH, type AdminSearchFilters } from '@/lib/propertiesApi'
import PropiedadesFilters from './PropiedadesFilters'

const fetchFacetas = vi.fn()
vi.mock('@/lib/facetas', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/facetas')>()), fetchFacetas: (...a: unknown[]) => fetchFacetas(...a) }))

const FACETAS = {
  departamentos: [{ valor: 'Lima', n: 40 }, { valor: 'Arequipa', n: 6 }],
  provincias: [{ valor: 'Lima', padre: 'Lima', n: 40 }, { valor: 'Camaná', padre: 'Arequipa', n: 1 }],
  distritos: [],
  inmuebles: [{ valor: 'Casa', n: 10 }, { valor: 'Terreno', n: 3 }],
  anunciantes: [{ valor: 'Inmobiliaria Prisma', n: 5 }],
}

function Harness({ onSearch = vi.fn(), onClear = vi.fn(), onChangeSpy, inicial = EMPTY_ADMIN_SEARCH }: { onSearch?: () => void; onClear?: () => void; onChangeSpy?: (f: AdminSearchFilters) => void; inicial?: AdminSearchFilters }) {
  const [filters, setFilters] = useState<AdminSearchFilters>(inicial)
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

const TITULOS = ['Buscar por palabra', 'Operación y portal', 'Tipo de inmueble', 'Ubicación', 'Precio', 'Ambientes y cocheras', 'Área construida', 'Antigüedad', 'Anunciante', 'Publicación']
const abrirTodo = () => userEvent.click(screen.getByRole('button', { name: /Desplegar todo/ }))
const abierto = (t: string) => screen.getByRole('button', { name: new RegExp('^' + t) }).getAttribute('aria-expanded')

beforeEach(() => {
  localStorage.clear()
  reiniciarFacetas()
  fetchFacetas.mockReset().mockResolvedValue(FACETAS)
})

describe('PropiedadesFilters (administración)', () => {
  it('los bloques son desglosables: lo esencial abierto, el resto recogido, y se puede desplegar todo', async () => {
    render(<Harness />)
    for (const t of TITULOS) expect(screen.getByRole('button', { name: new RegExp('^' + t) })).toBeInTheDocument()
    for (const t of ['Operación y portal', 'Tipo de inmueble', 'Ubicación']) expect(abierto(t)).toBe('true')
    for (const t of ['Buscar por palabra', 'Precio', 'Ambientes y cocheras', 'Área construida', 'Anunciante', 'Publicación']) expect(abierto(t)).toBe('false')
    expect(screen.getByLabelText('Mín. (m²)')).not.toBeVisible()

    await abrirTodo()
    for (const t of TITULOS) expect(abierto(t)).toBe('true')
    expect(screen.getByLabelText('Mín. (m²)')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /Recoger todo/ }))
    for (const t of TITULOS) expect(abierto(t)).toBe('false')
  })

  it('un bloque recogido con filtro activo muestra un resumen, y lo que se deja abierto se recuerda', async () => {
    const { unmount } = render(<Harness inicial={{ ...EMPTY_ADMIN_SEARCH, moneda: 'USD', precioMin: '100000', precioMax: '200000', dormitorios: '3', portal: 'Urbania' }} />)
    expect(screen.getByRole('button', { name: /^Precio/ })).toHaveTextContent('USD 100,000 – 200,000')
    expect(screen.getByRole('button', { name: /^Ambientes y cocheras/ })).toHaveTextContent('3 dorm.')
    expect(screen.getByRole('button', { name: /^Operación y portal/ })).not.toHaveTextContent('Urbania') // abierto: no hace falta el resumen
    await userEvent.click(screen.getByRole('button', { name: /^Precio/ }))
    expect(screen.getByLabelText('Mín. (USD)')).toBeVisible()
    unmount()
    render(<Harness />)
    expect(abierto('Precio')).toBe('true') // se recordó
  })

  it('las fichas y las listas del catálogo cambian los filtros', async () => {
    const spy = vi.fn()
    render(<Harness onChangeSpy={spy} />)
    await abrirTodo()
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Arequipa (6)' })
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    await userEvent.click(within(screen.getByRole('group', { name: 'Cocheras' })).getByRole('button', { name: '2+' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Operación' })).getByRole('button', { name: 'Venta' }))
    await userEvent.click(screen.getByLabelText('Solo avisos con precio publicado'))
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ departamento: 'Arequipa', cocheras: '2+', operacion: 'VENTA', soloConPrecio: true }))
    expect(screen.getByText('3 de detalle')).toBeInTheDocument()
  })

  it('las provincias se limitan al departamento elegido, al elegir una provincia se completa su departamento y el tipo sale del catálogo', async () => {
    render(<Harness />)
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Arequipa (6)' })
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    const provincia = screen.getByLabelText('Ciudad o provincia')
    expect(within(provincia).getByRole('option', { name: 'Camaná (1)' })).toBeInTheDocument()
    expect(within(provincia).queryByRole('option', { name: 'Lima (40)' })).toBeNull()
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Tipo' })).getByRole('button', { name: /Terreno/ })).toHaveTextContent('3'))
    await userEvent.selectOptions(provincia, 'Camaná (1)')
    expect(screen.getByLabelText('Lugar elegido')).toHaveTextContent('Camaná')
  })

  it('el rango de precio se escribe en soles por defecto, y cambiar a dólares limpia lo escrito', async () => {
    const spy = vi.fn()
    render(<Harness onChangeSpy={spy} />)
    await abrirTodo()
    expect(within(screen.getByRole('group', { name: 'Moneda del rango' })).getByRole('button', { name: /Soles/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByLabelText('Mín. (S/)'), '350000')
    await userEvent.click(within(screen.getByRole('group', { name: 'Moneda del rango' })).getByRole('button', { name: /Dólares/ }))
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ moneda: 'USD', precioMin: '', precioMax: '' }))
    expect(screen.getByLabelText('Mín. (USD)')).toHaveValue(null)
  })

  it('pide las opciones con los filtros activos (el portal elegido) y muestra solo lo disponible; «Ver todo» ofrece el resto', async () => {
    fetchFacetas.mockImplementation((f?: { portales: string[] }) =>
      Promise.resolve(f?.portales.includes('Properati') ? { ...FACETAS, departamentos: [{ valor: 'Lima', n: 30 }], provincias: [{ valor: 'Lima', padre: 'Lima', n: 30 }], inmuebles: [{ valor: 'Casa', n: 5 }] } : FACETAS)
    )
    render(<Harness inicial={{ ...EMPTY_ADMIN_SEARCH, portal: 'Properati' }} />)
    const opciones = () => within(screen.getByLabelText('Departamento')).getAllByRole('option').map(o => o.textContent)
    await waitFor(() => expect(opciones()).toEqual(['Todos', 'Lima (30)']))
    expect(fetchFacetas).toHaveBeenLastCalledWith(expect.objectContaining({ portales: ['Properati'] }))
    expect(within(screen.getByRole('group', { name: 'Tipo' })).queryByRole('button', { name: /Terreno/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Solo con avisos/ }))
    expect(opciones()).toHaveLength(26) // «Todos» + los 25 departamentos del Perú
    expect(opciones()).toContain('Cusco (0)')
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
    // Sin datos del servidor no se oculta nada: se ofrece todo el Perú.
    expect(within(screen.getByLabelText('Departamento')).getByRole('option', { name: 'Cusco (0)' })).toBeInTheDocument()
  })
})
