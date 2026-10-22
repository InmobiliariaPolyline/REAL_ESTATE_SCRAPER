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
})
