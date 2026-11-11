// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/contexts/ToastContext'

const fetchAudit = vi.fn()
vi.mock('@/lib/account', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/account')>()), fetchAudit: (...a: unknown[]) => fetchAudit(...a) }))

import AdminAuditoria from './AdminAuditoria'

const REGISTRO = {
  id: 1, usuario: 'admin', accion: 'premium_activado', objetivo: 'cliente', detalle: { dias: 30 }, ip: '200.1.2.3', creado_en: '2026-11-11T22:48:59Z',
}

let ancho = 1000
let avisar: ((e: { contentRect: { width: number } }[]) => void) | null = null

beforeEach(() => {
  fetchAudit.mockReset().mockResolvedValue({ data: [REGISTRO], count: 1, acciones: ['premium_activado'] })
  ancho = 1000
  avisar = null
  // jsdom no mide: se simula el observador de tamaño.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: (e: { contentRect: { width: number } }[]) => void) {
        avisar = cb
      }
      observe() {
        avisar?.([{ contentRect: { width: ancho } }])
      }
      disconnect() {}
    }
  )
})
afterEach(() => vi.unstubAllGlobals())

const abrir = () =>
  render(
    <ToastProvider>
      <AdminAuditoria />
    </ToastProvider>
  )

describe('AdminAuditoria', () => {
  it('con espacio suficiente se muestra como tabla', async () => {
    abrir()
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('200.1.2.3')).toBeInTheDocument()
  })

  it('con poco espacio (celular, o escritorio con la barra lateral y el submenú) pasa a lista y no oculta el detalle ni la IP', async () => {
    ancho = 430
    abrir()
    expect(await screen.findByText('IP 200.1.2.3')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('cliente')).toBeInTheDocument() // sobre quién
    expect(screen.getByText(/30 días/)).toBeInTheDocument() // detalle
  })

  it('al cambiar el ancho alterna entre lista y tabla', async () => {
    ancho = 430
    abrir()
    await screen.findByText('IP 200.1.2.3')
    act(() => avisar?.([{ contentRect: { width: 1100 } }]))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})
