// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Tipologias, { ordenarTipologias } from './Tipologias'

const B34 = [
  { codigo: '3', dormitorios: 3, banios: 2, area: 66, precio: 130600 },
  { codigo: '1', dormitorios: 1, banios: 1, area: 54, precio: 108700 },
  { codigo: '2', dormitorios: 2, banios: 2, area: 65, precio: 120580 },
]

describe('Tipologias', () => {
  it('lista cada tipología con su tamaño, su precio por m² y su precio, de la más barata a la más cara', () => {
    render(<Tipologias unidades={B34} moneda="USD" />)
    const filas = screen.getAllByRole('row').slice(1)
    expect(filas).toHaveLength(3)
    const texto = (f: HTMLElement) => Array.from(f.querySelectorAll('td')).map(td => td.textContent)
    expect(texto(filas[0])).toEqual(['1', '1', '54 m²', 'USD 2,013', 'USD 108,700'])
    expect(texto(filas[1])).toEqual(['2', '2', '65 m²', 'USD 1,855', 'USD 120,580'])
    expect(texto(filas[2])).toEqual(['3', '2', '66 m²', 'USD 1,979', 'USD 130,600'])
  })

  it('usa soles cuando el proyecto se publicó en soles', () => {
    render(<Tipologias unidades={[{ dormitorios: 2, area: 50, precio: 250000 }]} moneda="PEN" />)
    expect(screen.getByText('S/ 250,000')).toBeInTheDocument()
    expect(screen.getByText('S/ 5,000')).toBeInTheDocument()
  })

  it('una tipología sin precio dice «Consultar» y va al final; sin dato no inventa nada', () => {
    render(<Tipologias unidades={[{ dormitorios: 1 }, { dormitorios: 2, area: 60, precio: 200000 }]} moneda="USD" />)
    const filas = screen.getAllByRole('row').slice(1)
    expect(within(filas[0]).getByText('USD 200,000')).toBeInTheDocument()
    expect(within(filas[1]).getByText('Consultar')).toBeInTheDocument()
    expect(within(filas[1]).getAllByText('—').length).toBeGreaterThanOrEqual(2) // baños, área y por m² vacíos
  })

  it('ordenarTipologias no cambia la lista original', () => {
    const copia = [...B34]
    expect(ordenarTipologias(B34).map(u => u.precio)).toEqual([108700, 120580, 130600])
    expect(B34).toEqual(copia)
  })
})
