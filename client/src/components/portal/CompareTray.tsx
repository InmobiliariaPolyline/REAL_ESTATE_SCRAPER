import { Building2, Scale, X } from 'lucide-react'
import { safeHttpUrl } from '@/lib/url'
import type { Propiedad } from '@/types'

interface CompareTrayProps {
  items: Propiedad[]
  max: number
  onCompare: () => void
  onRemove: (id: string) => void
  onClear: () => void
}

/** Barra fija inferior con las propiedades elegidas para comparar. */
export default function CompareTray({ items, max, onCompare, onRemove, onClear }: CompareTrayProps) {
  if (items.length === 0) return null

  return (
    <div className="animate-popIn fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[min(52rem,calc(100vw-2rem))] flex-wrap items-center gap-3 rounded-2xl border border-line-strong bg-surface-2/95 p-3 pl-4 shadow-2xl backdrop-blur-xl">
      <span className="flex items-center gap-2 text-sm font-medium text-text">
        <Scale className="size-4 text-gold" />
        Comparar
        <span className="mono text-text-muted">
          {items.length}/{max}
        </span>
      </span>

      <ul className="flex flex-1 items-center gap-2 overflow-x-auto">
        {items.map(p => {
          const image = safeHttpUrl(p.imagen)
          return (
            <li
              key={p.id}
              className="relative flex shrink-0 items-center gap-2 rounded-xl border border-line bg-surface-3 py-1 pl-1 pr-7"
            >
              {image ? (
                <img src={image} alt="" className="size-8 rounded-lg object-cover" />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface-4">
                  <Building2 className="size-4 text-text-faint" />
                </span>
              )}
              <span className="max-w-[9rem] truncate text-xs text-text">{p.titulo}</span>
              <button
                onClick={() => onRemove(p.id)}
                className="absolute right-1 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-text-faint transition hover:bg-surface-4 hover:text-text"
                aria-label={`Quitar ${p.titulo}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center gap-2">
        <button onClick={onClear} className="btn btn-ghost btn-sm">
          Limpiar
        </button>
        <button onClick={onCompare} disabled={items.length < 2} className="btn btn-primary btn-sm">
          Comparar ahora
        </button>
      </div>
    </div>
  )
}
