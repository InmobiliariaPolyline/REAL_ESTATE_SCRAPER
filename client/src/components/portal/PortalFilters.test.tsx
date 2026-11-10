// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reiniciarFacetas } from '@/hooks/useFacetas'
import { DEFAULT_FILTERS, type FilterState } from '@/types'
import PortalFilters from './PortalFilters'

const fetchFacetas = vi.fn()
vi.mock('@/lib/facetas', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/facetas')>()), fetchFacetas: () => fetchFacetas() }))

const FACETAS = {
  departamentos: [{ valor: 'Lima', n: 40 }, { valor: 'Arequipa', n: 6 }],
  provincias: [{ valor: 'Lima', padre: 'Lima', n: 40 }, { valor: 'Arequipa', padre: 'Arequipa', n: 6 }, { valor: 'Camaná', padre: 'Arequipa', n: 1 }],
  distritos: [{ valor: 'Miraflores', padre: 'Lima', n: 12 }, { valor: 'Cayma', padre: 'Arequipa', n: 4 }],
  inmuebles: [{ valor: 'Departamento', n: 30 }, { valor: 'Casa', n: 10 }, { valor: 'Terreno', n: 3 }],
  anunciantes: [{ valor: 'Inmobiliaria Prisma', n: 5 }],
}

interface HarnessProps {
  inicial?: FilterState
  onApply?: (f: FilterState) => void
  onSearch?: () => void
  onClear?: (f: FilterState) => void
  contar?: (f: FilterState) => Promise<number>
}

function Harness({ inicial = DEFAULT_FILTERS, onApply = vi.fn(), onSearch = vi.fn(), onClear = vi.fn(), contar }: HarnessProps) {
  const [filters, setFilters] = useState<FilterState>({ ...inicial, portales: [...inicial.portales] })
  return <PortalFilters filters={filters} onFiltersChange={setFilters} onApply={onApply} onSearch={onSearch} onClear={onClear} contar={contar} />
}

const grupo = (nombre: string) => screen.getByRole('group', { name: nombre })

beforeEach(() => {
  reiniciarFacetas()
  fetchFacetas.mockReset().mockResolvedValue(FACETAS)
})

describe('PortalFilters (ventana de filtros)', () => {
  it('muestra todos los bloques a la vista, sin desglose que abrir', () => {
    render(<Harness />)
    for (const titulo of ['Buscar por palabra', 'Operación', 'Tipo de inmueble', 'Ubicación', 'Precio', 'Ambientes y cocheras', 'Área construida', 'Antigüedad', 'Portales', 'Anunciante', 'Publicación']) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /Más filtros/ })).toBeNull()
    expect(screen.getByLabelText('Mín. (m²)')).toBeInTheDocument()
    expect(screen.getByText('Sin filtros')).toBeInTheDocument()
  })

  it('operación, dormitorios, baños, cocheras, antigüedad y publicación se eligen con fichas', async () => {
    render(<Harness />)
    await userEvent.click(within(grupo('Qué buscas')).getByRole('button', { name: 'Venta' }))
    await userEvent.click(within(grupo('Dormitorios')).getByRole('button', { name: '3' }))
    await userEvent.click(within(grupo('Baños')).getByRole('button', { name: '2' }))
    await userEvent.click(within(grupo('Cocheras')).getByRole('button', { name: '2+' }))
    await userEvent.click(within(grupo('Años máximos')).getByRole('button', { name: 'Estreno' }))
    await userEvent.click(within(grupo('Publicado en el sistema')).getByRole('button', { name: '7 días' }))
    const chips = screen.getByLabelText('Filtros aplicados')
    for (const t of ['Venta', '3 dorm.', '2 baños', '2+ cocheras', 'Estreno', 'Última semana']) expect(within(chips).getByText(t)).toBeInTheDocument()
    expect(screen.getByText('6 activos')).toBeInTheDocument()
  })

  it('el tipo de inmueble sale del catálogo, con su cantidad y un icono', async () => {
    render(<Harness />)
    const tipos = grupo('Tipo')
    expect(await within(tipos).findByRole('button', { name: /Terreno/ })).toHaveTextContent('3')
    await userEvent.click(within(tipos).getByRole('button', { name: /Casa/ }))
    expect(within(screen.getByLabelText('Filtros aplicados')).getByText('Casa')).toBeInTheDocument()
  })

  it('las listas de departamento y provincia salen del catálogo y se enlazan entre sí', async () => {
    render(<Harness inicial={{ ...DEFAULT_FILTERS, departamento: 'Lima', provincia: 'Lima' }} />)
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Arequipa (6)' })
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    const provincia = screen.getByLabelText('Ciudad o provincia')
    expect(provincia).toHaveValue('')
    expect(within(provincia).getByRole('option', { name: 'Camaná (1)' })).toBeInTheDocument()
    expect(within(provincia).queryByRole('option', { name: 'Lima (40)' })).toBeNull()
  })

  it('los distritos con más avisos se eligen con un clic y se quitan con otro', async () => {
    const onApply = vi.fn()
    render(<Harness onApply={onApply} />)
    const populares = await screen.findByRole('group', { name: 'Distritos con más avisos' })
    await userEvent.click(within(populares).getByRole('button', { name: /Miraflores/ }))
    expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ distrito: 'Miraflores' }))
    expect(screen.getByLabelText('Distrito')).toHaveValue('Miraflores')
    await userEvent.click(within(populares).getByRole('button', { name: /Miraflores/ }))
    expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ distrito: '' }))
  })

  it('los portales se activan como etiquetas, varios a la vez', async () => {
    render(<Harness />)
    const portales = grupo('Dónde se publicó')
    await userEvent.click(within(portales).getByRole('button', { name: 'Urbania' }))
    await userEvent.click(within(portales).getByRole('button', { name: 'Infocasas' }))
    expect(within(portales).getByRole('button', { name: 'Urbania' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByLabelText('Filtros aplicados')).getByText('Urbania, Infocasas')).toBeInTheDocument()
    await userEvent.click(within(portales).getByRole('button', { name: 'Urbania' }))
    expect(within(screen.getByLabelText('Filtros aplicados')).getByText('Infocasas')).toBeInTheDocument()
  })

  it('los atajos de precio y de área aplican al instante', async () => {
    const onApply = vi.fn()
    render(<Harness inicial={{ ...DEFAULT_FILTERS, moneda: 'USD', operacion: 'ALQUILER', precioMin: 100 }} onApply={onApply} />)
    await userEvent.click(screen.getByRole('button', { name: 'Hasta USD 700' }))
    expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ precioMax: 700, precioMin: '' }))
    await userEvent.click(screen.getByRole('button', { name: '50 a 100 m²' }))
    expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ areaMin: 50, areaMax: 100 }))
    expect(screen.getByLabelText('Mín. (m²)')).toHaveValue(50)
  })

  it('quitar un chip lo aplica al instante y «solo con precio» es una casilla', async () => {
    const onApply = vi.fn()
    render(<Harness inicial={{ ...DEFAULT_FILTERS, operacion: 'VENTA', banios: '2' }} onApply={onApply} />)
    await userEvent.click(screen.getByLabelText('Solo avisos con precio publicado'))
    const chips = screen.getByLabelText('Filtros aplicados')
    expect(within(chips).getByText('Con precio')).toBeInTheDocument()
    await userEvent.click(within(chips).getByRole('button', { name: 'Quitar filtro: 2 baños' }))
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ banios: 'todos', operacion: 'VENTA', soloConPrecio: true }))
  })

  it('buscar y limpiar todo avisan al padre y no dependen de las facetas', async () => {
    fetchFacetas.mockRejectedValue(new Error('sin red'))
    const onSearch = vi.fn()
    const onClear = vi.fn()
    render(<Harness inicial={{ ...DEFAULT_FILTERS, texto: 'terraza' }} onSearch={onSearch} onClear={onClear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: /Limpiar todo/ }))
    expect(onClear).toHaveBeenCalledWith(expect.objectContaining({ texto: '', operacion: 'todos' }))
    expect(screen.getByLabelText('Palabra clave')).toHaveValue('')
  })

  it('ofrece todo el Perú aunque el catálogo no tenga avisos de esos lugares ni de esos tipos', async () => {
    render(<Harness />)
    const departamento = screen.getByLabelText('Departamento')
    // Hay avisos de Lima y Arequipa, pero también se ofrece el resto, con 0 avisos.
    expect(await within(departamento).findByRole('option', { name: 'Arequipa (6)' })).toBeInTheDocument()
    for (const d of ['Cusco (0)', 'Amazonas (0)', 'Tumbes (0)', 'La Libertad (0)']) expect(within(departamento).getByRole('option', { name: d })).toBeInTheDocument()
    expect(within(departamento).getAllByRole('option')).toHaveLength(26) // «Todos» + 25
    // Los tipos que no están en el catálogo también aparecen.
    const tipos = grupo('Tipo')
    for (const t of ['Oficina', 'Local comercial', 'Proyecto', 'Edificio']) expect(within(tipos).getByRole('button', { name: new RegExp(t) })).toBeInTheDocument()
  })

  it('al elegir un departamento sin avisos se ofrecen igual sus provincias y distritos', async () => {
    render(<Harness inicial={{ ...DEFAULT_FILTERS, departamento: 'Cusco' }} />)
    const provincia = screen.getByLabelText('Ciudad o provincia')
    for (const p of ['Cusco (0)', 'Urubamba (0)', 'Calca (0)']) expect(within(provincia).getByRole('option', { name: p })).toBeInTheDocument()
    expect(within(provincia).queryByRole('option', { name: /^Arequipa/ })).toBeNull() // otras regiones no
    await userEvent.type(screen.getByLabelText('Distrito'), 'wanch')
    expect(await screen.findByRole('button', { name: /Wanchaq/ })).toBeInTheDocument()
  })

  it('si no se puede cargar el catálogo, igual ofrece las listas completas', async () => {
    fetchFacetas.mockRejectedValue(new Error('sin red'))
    render(<Harness />)
    expect(within(screen.getByLabelText('Departamento')).getByRole('option', { name: 'Ucayali (0)' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Distrito'), 'mira')
    expect((await screen.findAllByRole('button', { name: /Miraflores/ })).length).toBeGreaterThan(0) // Lima y Arequipa tienen uno
  })
})

describe('PortalFilters: total en vivo', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('cuenta los avisos un instante después del último cambio y muestra el total', async () => {
    const contar = vi.fn().mockResolvedValue(1234)
    render(<Harness contar={contar} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(contar).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('1,234')).toBeInTheDocument()

    await userEvent.click(within(grupo('Qué buscas')).getByRole('button', { name: 'Venta' }))
    await userEvent.click(within(grupo('Cocheras')).getByRole('button', { name: '1+' }))
    expect(contar).toHaveBeenCalledTimes(1) // todavía no pasó el instante de espera
    contar.mockResolvedValue(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(contar).toHaveBeenCalledTimes(2)
    expect(contar).toHaveBeenLastCalledWith(expect.objectContaining({ operacion: 'VENTA', cocheras: '1+' }))
    await vi.waitFor(() => expect(document.querySelector('footer strong')).toHaveTextContent('1'))
    expect(document.querySelector('footer p')?.textContent).toBe('1 aviso') // singular
  })

  it('si no se puede contar, no muestra ningún total', async () => {
    const contar = vi.fn().mockRejectedValue(new Error('fallo'))
    render(<Harness contar={contar} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(contar).toHaveBeenCalled()
    expect(document.querySelector('footer strong')).toBeNull()
  })
})
