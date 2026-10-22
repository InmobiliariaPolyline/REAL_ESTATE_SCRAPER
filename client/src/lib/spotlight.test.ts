// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initSpotlight } from './spotlight'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  delete document.documentElement.dataset.motion
})

const mover = (el: Element, x: number, y: number) =>
  el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }))

describe('initSpotlight', () => {
  it('deja la posición del cursor en las variables CSS de la tarjeta', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (cb(0), 1))
    document.body.innerHTML = '<div class="card-interactive"><span id="hijo">x</span></div>'
    const card = document.querySelector<HTMLElement>('.card-interactive')!
    card.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect
    const stop = initSpotlight()
    mover(document.getElementById('hijo')!, 60, 90)
    expect(card.style.getPropertyValue('--mx')).toBe('50px')
    expect(card.style.getPropertyValue('--my')).toBe('70px')
    stop()
  })

  it('ignora lo que no es una tarjeta y respeta el movimiento reducido', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (cb(0), 1))
    document.body.innerHTML = '<div id="otro"></div><div class="card-interactive" id="c"></div>'
    const card = document.getElementById('c')!
    card.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect
    const stop = initSpotlight()
    mover(document.getElementById('otro')!, 5, 5)
    expect(card.style.getPropertyValue('--mx')).toBe('')
    document.documentElement.dataset.motion = 'reduced'
    mover(card, 5, 5)
    expect(card.style.getPropertyValue('--mx')).toBe('')
    stop()
  })

  it('con la preferencia del sistema de reducir movimiento no registra nada', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const add = vi.spyOn(document, 'addEventListener')
    initSpotlight()()
    expect(add).not.toHaveBeenCalledWith('pointermove', expect.anything(), expect.anything())
  })
})
