// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/contexts/ToastContext'
import PasswordForm from './PasswordForm'

vi.mock('@/lib/password', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/password')>()),
  changeOwnPassword: vi.fn(),
  resetUserPassword: vi.fn(),
}))

const abrir = () =>
  render(
    <ToastProvider>
      <PasswordForm mode="self" onDone={() => {}} onCancel={() => {}} />
    </ToastProvider>
  )

const guardar = () => userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
const invalidos = () => [...document.querySelectorAll('[aria-invalid="true"]')].map(e => e.id)

describe('PasswordForm: errores', () => {
  it('sin contraseña actual lo dice, marca solo ese campo y lleva el cursor a él', async () => {
    abrir()
    await guardar()
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa tu contraseña actual')
    expect(invalidos()).toEqual(['pw-actual'])
    expect(document.activeElement?.id).toBe('pw-actual')
  })

  it('con una contraseña nueva corta marca la nueva y la enfoca', async () => {
    abrir()
    await userEvent.type(document.getElementById('pw-actual') as HTMLElement, 'la-actual-123')
    await userEvent.type(document.getElementById('pw-nueva') as HTMLElement, 'corta')
    await guardar()
    expect(screen.getByRole('alert')).toHaveTextContent('al menos')
    expect(invalidos()).toEqual(['pw-nueva'])
    expect(document.activeElement?.id).toBe('pw-nueva')
  })

  it('si no coinciden marca la confirmación y la enfoca', async () => {
    abrir()
    await userEvent.type(document.getElementById('pw-actual') as HTMLElement, 'la-actual-123')
    await userEvent.type(document.getElementById('pw-nueva') as HTMLElement, 'una-clave-larga-1')
    await userEvent.type(document.getElementById('pw-confirmar') as HTMLElement, 'otra-clave-larga-2')
    await guardar()
    expect(screen.getByRole('alert')).toHaveTextContent('no coinciden')
    expect(invalidos()).toContain('pw-confirmar')
    expect(document.activeElement?.id).toBe('pw-confirmar')
  })
})
