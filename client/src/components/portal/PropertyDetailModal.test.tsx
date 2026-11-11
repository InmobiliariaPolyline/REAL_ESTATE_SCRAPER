// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/contexts/ToastContext'

const fetchPropertyDetail = vi.fn()
vi.mock('@/lib/propertiesApi', () => ({ fetchPropertyDetail: (...a: unknown[]) => fetchPropertyDetail(...a) }))
vi.mock('@/components/properties/EnlacesPropiedad', () => ({ default: () => null }))
vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children?: unknown }) => children ?? null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

import PropertyDetailModal from './PropertyDetailModal'

const detalle = {
  propiedad: {
    id: 'urbania:1', portal: 'urbania', operacion: 'VENTA', inmueble: 'Casa', titulo: 'Casa linda',
    precio: 100000, precio_usd: 100000, moneda: 'USD', distrito: 'Miraflores', dormitorios: '3', banios: '2', area: '90 m2',
    imagen: 'https://img.test/1.jpg', imagenes: ['https://img.test/1.jpg', 'https://img.test/2.jpg'], url: 'https://urbania.pe/x',
  },
  historial: [],
}

beforeEach(() => fetchPropertyDetail.mockReset().mockResolvedValue(detalle))

describe('PropertyDetailModal', () => {
  const abrir = () =>
    render(
      // Un ancestro con transformación haría que `fixed` se midiera contra él.
      <div data-testid="pagina" style={{ transform: 'translateY(0)' }}>
        <ToastProvider>
          <PropertyDetailModal propertyId="urbania:1" moneda="USD" isFavorite={false} onToggleFavorite={() => {}}
            isCompared={false} compareDisabled={false} onClose={() => {}} />
        </ToastProvider>
      </div>
    )

  it('se dibuja directamente en <body>, no dentro de la página', async () => {
    abrir()
    const dialogo = await screen.findByRole('dialog')
    expect(screen.getByTestId('pagina').contains(dialogo)).toBe(false)
    expect(document.body.contains(dialogo)).toBe(true)
  })

  it('muestra la galería con todas las fotos y no ofrece comparar sin la función', async () => {
    abrir()
    expect(await screen.findAllByRole('tab')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Comparar/ })).toBeNull()
  })

  it('bloquea el scroll de la página mientras está abierta y lo devuelve al cerrar', async () => {
    const { unmount } = abrir()
    await screen.findByRole('dialog')
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('un aviso sin precio no muestra ningún símbolo de moneda ni «0»', async () => {
    fetchPropertyDetail.mockResolvedValue({ ...detalle, propiedad: { ...detalle.propiedad, precio: 0, precio_usd: 0 } })
    abrir()
    const dialogo = await screen.findByRole('dialog')
    expect(await screen.findByText('Sin precio')).toBeInTheDocument()
    expect(screen.getByText(/no publicó un precio/)).toBeInTheDocument()
    // Nada de «S/ 0», «USD 0» ni de conversiones: no hay monto que mostrar.
    expect(dialogo.textContent).not.toMatch(/(S\/|USD)\s?~?0/)
    expect(screen.getByText(/no se puede estimar la cuota/)).toBeInTheDocument()
  })

  it('con precio muestra el monto con su moneda', async () => {
    abrir()
    await screen.findByRole('dialog')
    expect(await screen.findByText('100,000')).toBeInTheDocument() // el monto, con su moneda en la etiqueta oscura
    expect(screen.getByText(/Venta · USD/)).toBeInTheDocument()
    expect(screen.queryByText('Sin precio')).toBeNull()
  })

  it('con muchas fotos la galería no ensancha su columna (las columnas llevan minmax(0, …))', async () => {
    const muchas = Array.from({ length: 12 }, (_, i) => `https://img.test/${i}.jpg`)
    fetchPropertyDetail.mockResolvedValue({ ...detalle, propiedad: { ...detalle.propiedad, imagenes: muchas } })
    abrir()
    const dialogo = await screen.findByRole('dialog')
    expect(await screen.findAllByRole('tab')).toHaveLength(12)
    const rejilla = dialogo.querySelector('[class*="lg:grid-cols-"]') as HTMLElement
    // Sin minmax(0, …) la tira de miniaturas fuerza el ancho de la columna y aplasta los datos de la derecha.
    expect(rejilla.className).toContain('minmax(0,1.3fr)')
    expect(rejilla.className).toContain('minmax(0,1fr)')
  })

  it('las acciones viven en una barra fija: la principal con texto y las secundarias como iconos con nombre', async () => {
    abrir()
    const dialogo = await screen.findByRole('dialog')
    expect(await screen.findByRole('link', { name: /Ver aviso original/ })).toHaveAttribute('href', 'https://urbania.pe/x')
    expect(screen.getByRole('button', { name: /Favorito/ })).toBeInTheDocument()
    for (const nombre of ['Copiar enlace', 'Compartir por WhatsApp', 'Copiar resumen', 'Enlaces de apoyo']) {
      expect(screen.getByLabelText(nombre)).toBeInTheDocument()
    }
    const barra = screen.getByRole('link', { name: /Ver aviso original/ }).parentElement as HTMLElement
    expect(barra.className).toContain('sticky')
    expect(dialogo.contains(barra)).toBe(true)
  })

  it('el precio principal es el publicado; la otra moneda va como equivalente aproximado', async () => {
    fetchPropertyDetail.mockResolvedValue({ ...detalle, propiedad: { ...detalle.propiedad, precio: 340000, precio_usd: 340000, moneda: 'USD' } })
    render(
      <ToastProvider>
        <PropertyDetailModal propertyId="urbania:1" moneda="PEN" isFavorite={false} onToggleFavorite={() => {}}
          isCompared={false} compareDisabled={false} onClose={() => {}} />
      </ToastProvider>
    )
    expect(await screen.findByText('340,000')).toBeInTheDocument()
    expect(screen.getByText(/Venta · USD/)).toBeInTheDocument()
    expect(screen.getByText(/≈ S\/ · aproximado/)).toBeInTheDocument()
  })

  const b34 = {
    id: 'infocasas:proyecto-b34', portal: 'infocasas', operacion: 'VENTA', inmueble: 'Proyecto', titulo: 'B34',
    precio: 108700, precio_usd: 108700, precio_max: 130600, precio_max_usd: 130600, moneda: 'USD', distrito: 'Surquillo', departamento: 'Lima',
    dormitorios: '1, 2, 3', banios: '1, 2', area: '54 – 66 m2', antiguedad: 'En construcción', imagen: 'https://img.test/1.jpg',
    imagenes: ['https://img.test/1.jpg'], url: 'https://www.infocasas.com.pe/proyectos/b34',
    unidades: [
      { codigo: '187065797', dormitorios: 1, banios: 1, area: 54, precio: 108700 },
      { codigo: '187068541', dormitorios: 2, banios: 2, area: 65, precio: 120580 },
      { codigo: '187068547', dormitorios: 3, banios: 2, area: 66, precio: 130600 },
    ],
  }

  it('un proyecto muestra el precio «Desde» y «Hasta», sus rangos y la lista de sus tipologías', async () => {
    fetchPropertyDetail.mockResolvedValue({ propiedad: b34, historial: [] })
    abrir()
    const dialogo = await screen.findByRole('dialog')
    const insignias = Array.from(dialogo.querySelectorAll('.sb')).map(e => e.textContent?.replace(/\s+/g, ' ').trim())
    expect(insignias).toEqual(expect.arrayContaining(['Tipo Proyecto', 'Desde · USD 108,700', 'Hasta · USD 130,600']))
    expect(insignias.some(t => t?.startsWith('Por m²'))).toBe(false) // con varios tamaños no hay un solo precio por m²
    expect(await screen.findByText('Tipologías del proyecto')).toBeInTheDocument()
    expect(screen.getByText('3 opciones, cada una con su tamaño y su precio')).toBeInTheDocument()
    expect(screen.getAllByText('1, 2, 3').length).toBeGreaterThan(0) // dormitorios
    expect(screen.getAllByText('54 – 66 m²').length).toBeGreaterThan(0)
    expect(screen.getByText('USD 120,580')).toBeInTheDocument()
    // No se compara un «desde» con la mediana de ventas de la zona.
    expect(dialogo.textContent).not.toMatch(/la mediana de Surquillo/)
  })

  it('un proyecto de una sola tipología no inventa un «Hasta»', async () => {
    fetchPropertyDetail.mockResolvedValue({ propiedad: { ...b34, precio_max: null, area: '164 m2', unidades: [b34.unidades[0]] }, historial: [] })
    abrir()
    const dialogo = await screen.findByRole('dialog')
    await screen.findByText('Tipologías del proyecto')
    expect(Array.from(dialogo.querySelectorAll('.sb')).some(e => e.textContent?.startsWith('Hasta'))).toBe(false)
    expect(screen.getByText('1 opción, cada una con su tamaño y su precio')).toBeInTheDocument()
  })

  it('un proyecto o un aviso sin área ni cantidades (nulos) se dibuja sin fallar', async () => {
    fetchPropertyDetail.mockResolvedValue({ propiedad: { ...b34, area: null, dormitorios: null, banios: null, unidades: null, precio_max: null }, historial: [] })
    abrir()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByText('B34')).toBeInTheDocument()
  })

  it('un aviso normal no muestra tipologías ni «Hasta»', async () => {
    abrir()
    const dialogo = await screen.findByRole('dialog')
    await screen.findAllByRole('tab')
    expect(screen.queryByText('Tipologías del proyecto')).toBeNull()
    expect(Array.from(dialogo.querySelectorAll('.sb')).some(e => e.textContent?.startsWith('Hasta'))).toBe(false)
  })
})
