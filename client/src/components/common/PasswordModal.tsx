import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { ApiError } from '@/lib/api'
import {
  MIN_PASSWORD_LENGTH,
  changeOwnPassword,
  generatePassword,
  resetUserPassword,
} from '@/lib/password'

type PasswordModalProps = { onClose: () => void } & (
  | { mode: 'self' }
  | { mode: 'reset'; usuarioId: number; usuario: string }
)

/**
 * Cambio de contraseña. `self`: el usuario cambia la suya (pide la actual).
 * `reset`: el administrador fija una nueva a otro usuario (con generador de claves).
 */
export default function PasswordModal(props: PasswordModalProps) {
  const { onClose } = props
  const isReset = props.mode === 'reset'

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const generar = () => {
    const pwd = generatePassword()
    setNueva(pwd)
    setConfirmar(pwd)
    setVisible(true)
    setCopied(false)
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(nueva)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('No se pudo copiar al portapapeles', 'error')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')

    if (nueva.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!isReset && !actual) {
      setError('Ingresa tu contraseña actual')
      return
    }

    setBusy(true)
    try {
      if (props.mode === 'reset') {
        await resetUserPassword(props.usuarioId, nueva)
        addToast(`Contraseña de "${props.usuario}" restablecida. Sus sesiones se cerraron.`, 'success')
      } else {
        await changeOwnPassword(actual, nueva)
        addToast('Contraseña actualizada. Las demás sesiones se cerraron.', 'success')
      }
      onClose()
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0 && err.message
          ? err.message
          : 'No se pudo cambiar la contraseña'
      )
    } finally {
      setBusy(false)
    }
  }

  const type = visible ? 'text' : 'password'

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={isReset ? 'Restablecer contraseña' : 'Cambiar contraseña'}
        onSubmit={submit}
        className="animate-popIn card w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
        noValidate
      >
        <div className="mb-5 flex items-center gap-4">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-gold-soft ring-1 ring-gold/25">
            <KeyRound className="size-5 text-gold" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-text">
              {isReset ? 'Restablecer contraseña' : 'Cambiar contraseña'}
            </h3>
            <p className="text-sm text-text-muted">
              {props.mode === 'reset'
                ? `Usuario: ${props.usuario}`
                : 'Al cambiarla se cierran tus otras sesiones.'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {!isReset && (
            <div>
              <label htmlFor="pw-actual" className="field-label">Contraseña actual</label>
              <input
                id="pw-actual"
                type={type}
                value={actual}
                onChange={e => setActual(e.target.value)}
                className="field"
                autoComplete="current-password"
                disabled={busy}
                autoFocus
              />
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="pw-nueva" className="field-label !mb-0">Contraseña nueva</label>
              {isReset && (
                <button type="button" onClick={generar} className="btn btn-ghost btn-sm !h-7 text-gold">
                  <Wand2 className="size-3.5" />
                  Generar
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="pw-nueva"
                type={type}
                value={nueva}
                onChange={e => setNueva(e.target.value)}
                className="field mono pr-20"
                autoComplete="new-password"
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                disabled={busy}
                autoFocus={isReset}
              />
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5">
                {isReset && nueva && (
                  <button
                    type="button"
                    onClick={copiar}
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label="Copiar contraseña"
                  >
                    {copied ? <Check className="size-4 text-green" /> : <Copy className="size-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="pw-confirmar" className="field-label">Confirmar contraseña nueva</label>
            <input
              id="pw-confirmar"
              type={type}
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              className="field mono"
              autoComplete="new-password"
              disabled={busy}
            />
          </div>

          {error && (
            <p className="error-message rounded-xl border border-rose/25 bg-rose/10 px-3.5 py-2.5" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </div>
      </form>
    </div>
  )
}
