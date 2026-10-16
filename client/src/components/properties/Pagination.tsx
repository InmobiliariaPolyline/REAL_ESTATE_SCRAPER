import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems: number
  itemsPerPage: number
  /** Sustantivo del contador (por defecto "propiedades"). */
  noun?: string
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  noun = 'propiedades',
}: PaginationProps) {
  const startItem = totalItems === 0 ? 0 : currentPage * itemsPerPage + 1
  const endItem = Math.min((currentPage + 1) * itemsPerPage, totalItems)

  const handlePageChange = (page: number) => {
    onPageChange(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    const leftLimit = currentPage - 1
    const rightLimit = currentPage + 1

    const showLeftEllipsis = leftLimit > 1
    const showRightEllipsis = rightLimit < totalPages - 2

    if (!showLeftEllipsis && showRightEllipsis) {
      for (let i = 0; i < 4; i++) {
        if (i < totalPages) pages.push(i)
      }
      pages.push('ellipsis')
      pages.push(totalPages - 1)
    } else if (showLeftEllipsis && !showRightEllipsis) {
      pages.push(0)
      pages.push('ellipsis')
      for (let i = totalPages - 4; i < totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(0)
      pages.push('ellipsis')
      pages.push(currentPage - 1)
      pages.push(currentPage)
      pages.push(currentPage + 1)
      pages.push('ellipsis')
      pages.push(totalPages - 1)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <nav
      aria-label="Paginación"
      className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row"
    >
      <span className="text-center text-sm text-text-muted sm:text-left">
        Mostrando <strong className="mono font-medium text-text">{startItem}</strong>–
        <strong className="mono font-medium text-text">{endItem}</strong> de{' '}
        <strong className="mono font-medium text-text">{totalItems}</strong> {noun}
      </span>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 0}
          aria-label="Página anterior"
          className="btn btn-secondary btn-icon"
        >
          <ChevronLeft className="size-4" />
        </button>

        {pageNumbers.map((page, idx) =>
          page === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex size-10 items-center justify-center text-sm text-text-faint"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              aria-label={`Ir a página ${page + 1}`}
              aria-current={currentPage === page ? 'page' : undefined}
              className={cn(
                'btn btn-icon mono',
                currentPage === page ? 'btn-primary' : 'btn-secondary'
              )}
            >
              {page + 1}
            </button>
          )
        )}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages - 1}
          aria-label="Página siguiente"
          className="btn btn-secondary btn-icon"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  )
}
