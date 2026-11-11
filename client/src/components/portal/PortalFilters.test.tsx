// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reiniciarFacetas } from '@/hooks/useFacetas'
import { DEFAULT_FILTERS, type FilterState } from '@/types'
import PortalFilters from './PortalFilters'

const fetchFacetas = vi.fn()
vi.mock('@/lib/facetas', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/facetas')>()), fetchFacetas: (...a: unknown[]) => fetchFacetas(...a) }))

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
/** El botón de la lista de sugerencias de distrito (no el de las etiquetas «con más avisos»). */
const sugerencia = async (nombre: RegExp) => {
  const todos = await screen.findAllByRole('button', { name: nombre })
  const dellista = todos.filter(b => !b.closest('[role=group]'))
  expect(dellista.length).toBeGreaterThan(0)
  return dellista[0]
}
const abrirTodo = () => userEvent.click(screen.getByRole('button', { name: /Desplegar todo/ }))
const TITULOS = ['Buscar por palabra', 'Operación', 'Tipo de inmueble', 'Ubicación', 'Precio', 'Ambientes y cocheras', 'Área construida', 'Antigüedad', 'Portales', 'Anunciante', 'Publicación']

beforeEach(() => {
  reiniciarFacetas()
  fetchFacetas.mockReset().mockResolvedValue(FACETAS)
})

describe('PortalFilters (ventana de filtros)', () => {
  it('los bloques son desglosables: lo esencial abierto, el resto recogido, y se puede desplegar todo', async () => {
    render(<Harness />)
    for (const t of TITULOS) expect(screen.getByRole('button', { name: new RegExp('^' + t) })).toBeInTheDocument()
    const abierto = (t: string) => screen.getByRole('button', { name: new RegExp('^' + t) }).getAttribute('aria-expanded')
    for (const t of ['Operación', 'Tipo de inmueble', 'Ubicación']) expect(abierto(t)).toBe('true')
    for (const t of ['Precio', 'Ambientes y cocheras', 'Área construida', 'Portales']) expect(abierto(t)).toBe('false')
    expect(screen.queryByLabelText('Mín. (m²)')).not.toBeVisible()

    await abrirTodo()
    for (const t of TITULOS) expect(abierto(t)).toBe('true')
    expect(screen.getByLabelText('Mín. (m²)')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /Recoger todo/ }))
    for (const t of TITULOS) expect(abierto(t)).toBe('false')
    expect(screen.getByText('Sin filtros')).toBeInTheDocument()
  })

  it('un bloque recogido con filtro activo muestra un resumen de lo elegido', async () => {
    render(<Harness inicial={{ ...DEFAULT_FILTERS, moneda: 'USD', precioMin: 100000, precioMax: 200000, dormitorios: '3', cocheras: '2+' }} />)
    expect(screen.getByRole('button', { name: /^Precio.*USD/ })).toHaveTextContent('USD 100,000 – 200,000')
    expect(screen.getByRole('button', { name: /^Ambientes y cocheras/ })).toHaveTextContent('3 dorm. · 2+ coch.')
    await userEvent.click(screen.getByRole('button', { name: /^Precio/ }))
    expect(screen.getByLabelText('Mín. (USD)')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Precio/ })).not.toHaveTextContent('100,000') // abierto: ya no hace falta el resumen
  })

  it('operación, dormitorios, baños, cocheras, antigüedad y publicación se eligen con fichas', async () => {
    render(<Harness />)
    await abrirTodo()
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
    await waitFor(() => expect(within(tipos).getByRole('button', { name: /Terreno/ })).toHaveTextContent('3'))
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
    await abrirTodo()
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
    await abrirTodo()
    await userEvent.click(screen.getByRole('button', { name: 'Hasta USD 700' }))
    expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ precioMax: 700, precioMin: '' }))
    await userEvent.click(screen.getByRole('button', { name: '50 a 100 m²' }))
    expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ areaMin: 50, areaMax: 100 }))
    expect(screen.getByLabelText('Mín. (m²)')).toHaveValue(50)
  })

  it('quitar un chip lo aplica al instante y «solo con precio» es una casilla', async () => {
    const onApply = vi.fn()
    render(<Harness inicial={{ ...DEFAULT_FILTERS, operacion: 'VENTA', banios: '2' }} onApply={onApply} />)
    await abrirTodo()
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
    await abrirTodo()
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: /Limpiar todo/ }))
    expect(onClear).toHaveBeenCalledWith(expect.objectContaining({ texto: '', operacion: 'todos' }))
    expect(screen.getByLabelText('Palabra clave')).toHaveValue('')
  })

  it('ofrece todo el Perú aunque el catálogo no tenga avisos de esos lugares ni de esos tipos', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /Solo con avisos/ })) // «Ver todo»
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
    await userEvent.click(screen.getByRole('button', { name: /Solo con avisos/ })) // «Ver todo»
    const provincia = screen.getByLabelText('Ciudad o provincia')
    for (const p of ['Cusco (0)', 'Urubamba (0)', 'Calca (0)']) expect(within(provincia).getByRole('option', { name: p })).toBeInTheDocument()
    expect(within(provincia).queryByRole('option', { name: /^Arequipa/ })).toBeNull() // otras regiones no
    await userEvent.type(screen.getByLabelText('Distrito'), 'wanch')
    expect(await screen.findByRole('button', { name: /Wanchaq/ })).toBeInTheDocument()
  })

  it('si no se puede cargar el catálogo, igual ofrece las listas completas', async () => {
    fetchFacetas.mockRejectedValue(new Error('sin red'))
    render(<Harness />)
    // Sin datos del servidor no se oculta nada: se ofrece todo el Perú.
    expect(within(screen.getByLabelText('Departamento')).getByRole('option', { name: 'Ucayali (0)' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Distrito'), 'mira')
    expect((await screen.findAllByRole('button', { name: /Miraflores/ })).length).toBeGreaterThan(0) // Lima y Arequipa tienen uno
  })
})

describe('PortalFilters: jerarquía geográfica', () => {
  const opciones = (etiqueta: string) => within(screen.getByLabelText(etiqueta)).getAllByRole('option').map(o => o.textContent)

  it('al elegir un departamento, las provincias son solo las suyas y se limpia lo que ya no corresponde', async () => {
    render(<Harness inicial={{ ...DEFAULT_FILTERS, departamento: 'Lima', provincia: 'Lima', distrito: 'Miraflores' }} />)
    await userEvent.selectOptions(screen.getByLabelText('Departamento'), 'Arequipa')
    expect(screen.getByLabelText('Ciudad o provincia')).toHaveValue('')
    expect(screen.getByLabelText('Distrito')).toHaveValue('')
    expect(opciones('Ciudad o provincia').some(o => /^Camaná/.test(o ?? ''))).toBe(true)
    expect(opciones('Ciudad o provincia').some(o => /^Huaral/.test(o ?? ''))).toBe(false) // es de Lima
  })

  it('al elegir una provincia se completa su departamento', async () => {
    render(<Harness />)
    await userEvent.selectOptions(screen.getByLabelText('Ciudad o provincia'), within(screen.getByLabelText('Ciudad o provincia')).getByRole('option', { name: /^Camaná/ }))
    expect(screen.getByLabelText('Departamento')).toHaveValue('Arequipa')
    expect(screen.getByLabelText('Lugar elegido')).toHaveTextContent('Arequipa')
    expect(screen.getByLabelText('Lugar elegido')).toHaveTextContent('Camaná')
  })

  it('al elegir un distrito de la lista se completan su provincia y su departamento', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Distrito'), 'cayma')
    await userEvent.click(await sugerencia(/Cayma/))
    expect(screen.getByLabelText('Distrito')).toHaveValue('Cayma')
    expect(screen.getByLabelText('Departamento')).toHaveValue('Arequipa')
    expect(screen.getByLabelText('Ciudad o provincia')).toHaveValue('Arequipa')
    expect(screen.getByLabelText('Lugar elegido')).toHaveTextContent('Arequipa')
  })

  it('el Callao es un solo departamento, con una sola provincia y sus distritos, sin repetirse', async () => {
    fetchFacetas.mockResolvedValue({
      departamentos: [{ valor: 'Lima', n: 10 }, { valor: 'Callao', n: 2 }],
      provincias: [{ valor: 'Callao', padre: 'Lima', n: 3 }, { valor: 'Callao', padre: 'Callao', n: 2 }],
      distritos: [{ valor: 'Callao', padre: 'Lima', provincia: 'Callao', n: 3 }, { valor: 'Callao', padre: 'Callao', provincia: 'Callao', n: 2 }],
    })
    render(<Harness inicial={{ ...DEFAULT_FILTERS, departamento: 'Callao' }} />)
    await within(screen.getByLabelText('Departamento')).findByRole('option', { name: 'Callao (2)' })
    expect(opciones('Departamento').filter(o => /^Callao/.test(o ?? ''))).toHaveLength(1)
    expect(opciones('Ciudad o provincia').filter(o => /^Callao/.test(o ?? ''))).toEqual(['Callao (5)'])
    await userEvent.type(screen.getByLabelText('Distrito'), 'call')
    await sugerencia(/^Callao/)
    expect((await screen.findAllByRole('button', { name: /^Callao/ })).filter(b => !b.closest('[role=group]'))).toHaveLength(1)
  })

  it('con un departamento elegido, los distritos sugeridos son solo los de ese lugar', async () => {
    render(<Harness inicial={{ ...DEFAULT_FILTERS, departamento: 'Arequipa' }} />)
    await userEvent.type(screen.getByLabelText('Distrito'), 'mira')
    // Miraflores existe en Lima y en Arequipa: solo se ofrece el de Arequipa.
    const botones = [await sugerencia(/Miraflores/)]
    expect((await screen.findAllByRole('button', { name: /Miraflores/ })).filter(b => !b.closest('[role=group]'))).toHaveLength(1)
    expect(botones[0]).toHaveTextContent('Arequipa')
  })
})

describe('PortalFilters: solo lo disponible con los filtros activos', () => {
  const FACETAS_PROPERATI = {
    departamentos: [{ valor: 'Lima', n: 30 }],
    provincias: [{ valor: 'Lima', padre: 'Lima', n: 30 }],
    distritos: [{ valor: 'Miraflores', padre: 'Lima', provincia: 'Lima', n: 12 }, { valor: 'Santiago de Surco', padre: 'Lima', provincia: 'Lima', n: 18 }],
    inmuebles: [{ valor: 'Departamento', n: 25 }, { valor: 'Casa', n: 5 }],
    anunciantes: [],
  }
  const opciones = (etiqueta: string) => within(screen.getByLabelText(etiqueta)).getAllByRole('option').map(o => o.textContent)

  it('pide al servidor las opciones con los filtros elegidos y muestra solo lo que tiene avisos', async () => {
    fetchFacetas.mockImplementation((filtros?: FilterState) => Promise.resolve(filtros?.portales.includes('Properati') ? FACETAS_PROPERATI : FACETAS))
    render(<Harness inicial={{ ...DEFAULT_FILTERS, portales: ['Properati'] }} />)
    await waitFor(() => expect(opciones('Departamento')).toEqual(['Todos', 'Lima (30)']))
    expect(fetchFacetas).toHaveBeenLastCalledWith(expect.objectContaining({ portales: ['Properati'] }))
    // Ni Arequipa ni el resto del Perú, que con este portal no tienen avisos.
    expect(opciones('Departamento').some(o => /Arequipa|Callao|Cusco/.test(o ?? ''))).toBe(false)
    expect(opciones('Ciudad o provincia')).toEqual(['Todos', 'Lima (30)'])
  })

  it('al cambiar un filtro las opciones y sus cantidades se vuelven a calcular', async () => {
    fetchFacetas.mockImplementation((filtros?: FilterState) => Promise.resolve(filtros?.portales.includes('Properati') ? FACETAS_PROPERATI : FACETAS))
    render(<Harness />)
    await waitFor(() => expect(opciones('Departamento')).toContain('Arequipa (6)'))
    await abrirTodo()
    await userEvent.click(within(grupo('Dónde se publicó')).getByRole('button', { name: 'Properati' }))
    await waitFor(() => expect(opciones('Departamento')).toEqual(['Todos', 'Lima (30)']))
  })

  it('lo ya elegido se conserva aunque no tenga avisos con esos filtros, y «Ver todo» muestra también lo que no tiene', async () => {
    fetchFacetas.mockResolvedValue(FACETAS_PROPERATI)
    render(<Harness inicial={{ ...DEFAULT_FILTERS, departamento: 'Callao' }} />)
    await waitFor(() => expect(opciones('Departamento')).toContain('Lima (30)'))
    expect(screen.getByLabelText('Departamento')).toHaveValue('Callao') // sigue visible para poder quitarlo
    await userEvent.click(screen.getByRole('button', { name: /Solo con avisos/ }))
    expect(screen.getByRole('button', { name: /Ver todo/ })).toHaveAttribute('aria-pressed', 'false')
    expect(opciones('Departamento')).toContain('Cusco (0)')
  })

  it('los tipos y los distritos también se limitan a lo disponible', async () => {
    fetchFacetas.mockResolvedValue(FACETAS_PROPERATI)
    render(<Harness inicial={{ ...DEFAULT_FILTERS, portales: ['Properati'] }} />)
    const tipos = grupo('Tipo')
    await waitFor(() => expect(within(tipos).getByRole('button', { name: /Departamento/ })).toHaveTextContent('25'))
    expect(within(tipos).queryByRole('button', { name: /Oficina/ })).toBeNull()
    await userEvent.type(screen.getByLabelText('Distrito'), 'a')
    expect(await sugerencia(/Miraflores/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Wanchaq/ })).toBeNull() // otro lugar sin avisos
  })
})

describe('PortalFilters: total en vivo', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('cuenta los avisos un instante después del último cambio y muestra el total', async () => {
    const contar = vi.fn().mockResolvedValue(1234)
    render(<Harness contar={contar} />)
    await abrirTodo()
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
