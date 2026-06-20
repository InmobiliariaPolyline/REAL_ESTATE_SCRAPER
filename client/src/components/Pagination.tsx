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

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage < 2) {
        for (let i = 0; i < maxVisible; i++) {
          pages.push(i)
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - maxVisible; i < totalPages; i++) {
          pages.push(i)
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pages.push(i)
        }
      }
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{ backgroundColor: '#1A1A1A', fontFamily: 'DM Sans' }}
    >
      {/* Contador */}
      <span style={{ color: '#6B6B6B', fontSize: '0.875rem' }}>
        Mostrando <strong style={{ color: '#C9A96E' }}>{startItem}</strong>–
        <strong style={{ color: '#C9A96E' }}>{endItem}</strong> de{' '}
        <strong style={{ color: '#C9A96E' }}>{totalItems}</strong> propiedades
      </span>

      {/* Botones de paginación */}
      <div className="flex items-center gap-2">
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
        {pageNumbers.map((page) => (
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
        ))}

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
