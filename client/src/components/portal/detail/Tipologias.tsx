import { currencyLabel, type Currency } from '@/lib/prices'
import type { UnidadProyecto } from '@shared/proyectos'

const fmt = (n: number) => n.toLocaleString('es-PE')

/** Tipologías de un proyecto ordenadas por precio (las que no publican precio, al final). */
export const ordenarTipologias = (unidades: UnidadProyecto[]): UnidadProyecto[] =>
  [...unidades].sort(
    (a, b) =>
      (a.precio ?? Infinity) - (b.precio ?? Infinity) || (a.dormitorios ?? 0) - (b.dormitorios ?? 0) || (a.area ?? 0) - (b.area ?? 0)
  )

/**
 * Lista de las tipologías de un proyecto: dormitorios, baños, área, precio por m² y precio de cada una, en la moneda en
 * que se publicó el proyecto. Un proyecto no tiene un solo precio ni un solo tamaño; aquí se ve cada opción.
 */
export default function Tipologias({ unidades, moneda }: { unidades: UnidadProyecto[]; moneda: Currency }) {
  const lista = ordenarTipologias(unidades)
  const simbolo = currencyLabel(moneda)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] border-separate border-spacing-y-1.5 text-sm">
        <caption className="sr-only">Dormitorios, baños, área y precio de cada opción</caption>
        <thead>
          <tr className="text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
            <th scope="col" className="px-3 pb-1">Dormitorios</th>
            <th scope="col" className="px-3 pb-1">Baños</th>
            <th scope="col" className="px-3 pb-1">Área</th>
            <th scope="col" className="px-3 pb-1">Por m²</th>
            <th scope="col" className="px-3 pb-1 text-right">Precio</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((u, i) => (
            <tr key={u.codigo ?? i} className="mono bg-surface-3/50 text-text">
              <td className="rounded-l-xl px-3 py-2.5">{u.dormitorios ?? <span className="text-text-faint">—</span>}</td>
              <td className="px-3 py-2.5">{u.banios ?? <span className="text-text-faint">—</span>}</td>
              <td className="px-3 py-2.5">{u.area ? `${fmt(u.area)} m²` : <span className="text-text-faint">—</span>}</td>
              <td className="px-3 py-2.5 text-text-muted">
                {u.precio && u.area ? `${simbolo} ${fmt(Math.round(u.precio / u.area))}` : <span className="text-text-faint">—</span>}
              </td>
              <td className="rounded-r-xl px-3 py-2.5 text-right font-semibold text-green">
                {u.precio ? `${simbolo} ${fmt(u.precio)}` : <span className="font-normal text-text-muted">Consultar</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
