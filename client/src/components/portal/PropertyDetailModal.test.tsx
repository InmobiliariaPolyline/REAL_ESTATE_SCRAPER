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
})
