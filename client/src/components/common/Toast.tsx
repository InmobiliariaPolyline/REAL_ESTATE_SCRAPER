import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export interface ToastMessage {
  id: string
  mensaje: string
  tipo: 'success' | 'error' | 'info'
}

interface ToastProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

export function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 px-4 py-3 rounded backdrop-blur-sm animate-slideInUp"
          style={{
            backgroundColor:
              toast.tipo === 'success'
                ? 'rgba(34, 197, 94, 0.15)'
                : toast.tipo === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(96, 165, 250, 0.15)',
            borderLeft: `3px solid ${
              toast.tipo === 'success'
                ? '#22C55E'
                : toast.tipo === 'error'
                  ? '#EF4444'
                  : '#60A5FA'
            }`,
            color:
              toast.tipo === 'success'
                ? '#22C55E'
                : toast.tipo === 'error'
                  ? '#EF4444'
                  : '#60A5FA',
            fontFamily: 'DM Sans',
            fontSize: '0.875rem',
          }}
        >
          <span className="flex-1">{toast.mensaje}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-current hover:opacity-70"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
