import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems: number
  itemsPerPage: number
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  const startItem = currentPage * itemsPerPage + 1
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
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4"
      style={{ backgroundColor: '#1A1A1A', fontFamily: 'DM Sans' }}
    >
      {/* Contador */}
      <span style={{ color: '#6B6B6B', fontSize: '0.875rem' }} className="text-center sm:text-left">
        Mostrando <strong style={{ color: '#C9A96E' }}>{startItem}</strong>–
        <strong style={{ color: '#C9A96E' }}>{endItem}</strong> de{' '}
        <strong style={{ color: '#C9A96E' }}>{totalItems}</strong> propiedades
      </span>

      {/* Botones de paginación */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Anterior */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 0}
          aria-label="Página anterior"
          className="rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #2A2A2A',
            color: '#C9A96E',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          <ChevronLeft size={18} />
        </button>

        {/* Números de página */}
        {pageNumbers.map((page, idx) => {
          if (page === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="flex items-center justify-center text-sm font-medium"
                style={{
                  color: '#6B6B6B',
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                }}
              >
                ...
              </span>
            )
          }

          return (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              aria-label={`Ir a página ${page + 1}`}
              className="rounded text-sm font-medium transition flex items-center justify-center"
              style={{
                backgroundColor:
                  currentPage === page ? '#C9A96E' : 'transparent',
                color: currentPage === page ? '#0F0F0F' : '#6B6B6B',
                border: '1px solid #2A2A2A',
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
              }}
            >
              {page + 1}
            </button>
          )
        })}

        {/* Siguiente */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages - 1}
          aria-label="Página siguiente"
          className="rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #2A2A2A',
            color: '#C9A96E',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
