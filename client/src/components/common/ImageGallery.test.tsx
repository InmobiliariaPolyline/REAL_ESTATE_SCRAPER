// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ImageGallery from './ImageGallery'

const fotos = (n: number) => Array.from({ length: n }, (_, i) => `https://img.test/${i + 1}.jpg`)
const principal = () => screen.getAllByRole('img').find(i => i.getAttribute('alt')?.includes('foto'))

describe('ImageGallery', () => {
  it('con una sola foto no muestra flechas ni miniaturas', () => {
    render(<ImageGallery images={fotos(1)} alt="Casa" />)
    expect(screen.getByRole('img', { name: 'Casa' })).toHaveAttribute('src', 'https://img.test/1.jpg')
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('sin fotos válidas muestra el marcador de posición', () => {
    render(<ImageGallery images={[null, 'javascript:alert(1)']} alt="Casa" />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('con muchas fotos se recorre con flechas, miniaturas y teclado, y da la vuelta', async () => {
    render(<ImageGallery images={fotos(8)} alt="Casa" />)
    expect(screen.getAllByRole('tab')).toHaveLength(8)
    expect(screen.getByText('1 / 8')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }))
    expect(screen.getByText('2 / 8')).toBeInTheDocument()
    expect(principal()).toHaveAttribute('src', 'https://img.test/2.jpg')

    await userEvent.click(screen.getByRole('tab', { name: 'Ver foto 6' }))
    expect(screen.getByText('6 / 8')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(screen.getByText('5 / 8')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Ver foto 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Foto anterior' }))
    expect(screen.getByText('8 / 8')).toBeInTheDocument() // da la vuelta
  })

  it('omite fotos repetidas y las que no cargan', () => {
    render(<ImageGallery images={[...fotos(3), 'https://img.test/1.jpg']} alt="Casa" />)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    fireEvent.error(principal()!)
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })
})
