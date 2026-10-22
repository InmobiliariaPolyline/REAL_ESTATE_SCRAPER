// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Reveal from './Reveal'

afterEach(() => vi.unstubAllGlobals())

describe('Reveal', () => {
  it('sin IntersectionObserver muestra el contenido de inmediato', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Reveal>Hola</Reveal>)
    expect(screen.getByText('Hola')).toHaveClass('is-visible')
  })

  it('aparece cuando entra en pantalla y deja de observar', () => {
    let callback: IntersectionObserverCallback = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb
        }
        observe() {}
        disconnect = disconnect
      }
    )
    render(<Reveal delay={120}>Contenido</Reveal>)
    const el = screen.getByText('Contenido')
    expect(el).toHaveClass('reveal')
    expect(el).not.toHaveClass('is-visible')
    expect(el.style.getPropertyValue('--reveal-delay')).toBe('120ms')

    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(el).toHaveClass('is-visible')
    expect(disconnect).toHaveBeenCalled()
  })
})
