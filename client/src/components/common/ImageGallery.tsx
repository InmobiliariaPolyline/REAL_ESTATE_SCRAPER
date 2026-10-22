import { Building2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { safeHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'

interface ImageGalleryProps {
  /** Direcciones de las fotos, en orden; las que no sean http(s) o no carguen se omiten. */
  images: (string | null | undefined)[]
  alt: string
  /** Etiquetas superpuestas sobre la foto (portal, operación…). */
  children?: ReactNode
  className?: string
}

/**
 * Galería de fotos: foto principal, flechas, contador y tira de miniaturas que se desplaza
 * cuando hay muchas. También se maneja con las flechas del teclado.
 */
export default function ImageGallery({ images, alt, children, className }: ImageGalleryProps) {
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const [index, setIndex] = useState(0)
  const thumbs = useRef<HTMLDivElement>(null)

  const fotos = useMemo(() => {
    const vistas = new Set<string>()
    for (const f of images) {
      const u = safeHttpUrl(f)
      if (u && !broken.has(u)) vistas.add(u)
    }
    return [...vistas]
  }, [images, broken])

  const actual = Math.min(index, Math.max(0, fotos.length - 1))
  const ir = (i: number) => setIndex((i + fotos.length) % fotos.length)

  // La miniatura activa siempre queda a la vista.
  useEffect(() => {
    const el = thumbs.current?.children[actual] as HTMLElement | undefined
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [actual])

  const onKey = (e: KeyboardEvent) => {
    if (fotos.length < 2) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      ir(actual + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      ir(actual - 1)
    }
  }

  const marcarRota = (url: string) => setBroken(prev => new Set(prev).add(url))

  return (
    <div className={cn('flex flex-col bg-surface-3', className)}>
      <div
        className="relative min-h-[14rem] flex-1 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        tabIndex={fotos.length > 1 ? 0 : -1}
        onKeyDown={onKey}
        role="group"
        aria-roledescription="galería"
        aria-label={fotos.length > 1 ? `Fotos de la propiedad: ${actual + 1} de ${fotos.length}` : 'Foto de la propiedad'}
      >
        {fotos.length > 0 ? (
          <img
            key={fotos[actual]}
            src={fotos[actual]}
            alt={fotos.length > 1 ? `${alt} (foto ${actual + 1} de ${fotos.length})` : alt}
            className="animate-fadeIn absolute inset-0 size-full object-cover"
            onError={() => marcarRota(fotos[actual])}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 className="size-12 text-text-faint" strokeWidth={1.25} />
          </div>
        )}

        {children}

        {fotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => ir(actual - 1)}
              className="absolute left-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => ir(actual + 1)}
              className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="mono absolute bottom-2 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-md">
              {actual + 1} / {fotos.length}
            </span>
          </>
        )}
      </div>

      {fotos.length > 1 && (
        <div
          ref={thumbs}
          className="flex gap-2 overflow-x-auto bg-surface-2 p-2"
          role="tablist"
          aria-label="Miniaturas"
        >
          {fotos.map((url, i) => (
            <button
              key={url}
              type="button"
              role="tab"
              aria-selected={i === actual}
              aria-label={`Ver foto ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                'relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition',
                i === actual ? 'ring-gold' : 'opacity-70 ring-transparent hover:opacity-100'
              )}
            >
              <img src={url} alt="" loading="lazy" className="size-full object-cover" onError={() => marcarRota(url)} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
