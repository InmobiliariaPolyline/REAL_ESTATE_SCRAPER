import { KeyRound } from 'lucide-react'
import { useEffect } from 'react'
import PasswordForm from './PasswordForm'

interface PasswordModalProps {
  usuarioId: number
  usuario: string
  onClose: () => void
}

/** El administrador fija una contraseña nueva a otro usuario (cierra todas sus sesiones). */
export default function PasswordModal({ usuarioId, usuario, onClose }: PasswordModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Restablecer contraseña"
        className="animate-popIn card w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-4">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-gold-soft ring-1 ring-gold/25">
            <KeyRound className="size-5 text-gold" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-text">Restablecer contraseña</h3>
            <p className="text-sm text-text-muted">Usuario: {usuario}</p>
          </div>
        </div>

        <PasswordForm
          mode="reset"
          usuarioId={usuarioId}
          usuario={usuario}
          onDone={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
