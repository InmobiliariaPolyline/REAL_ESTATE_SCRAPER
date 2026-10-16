import { KeyRound, Laptop, Loader2, LogOut, MonitorSmartphone, ShieldCheck, Smartphone, UserCog, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Avatar from '@/components/common/Avatar'
import EmptyState from '@/components/common/EmptyState'
import PasswordForm from '@/components/common/PasswordForm'
import { useToast } from '@/contexts/ToastContext'
import {
  describeDevice,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  timeAgo,
  type SessionInfo,
} from '@/lib/account'
import { cn } from '@/lib/utils'
import { trapFocus } from '@/lib/focusTrap'

type Tab = 'password' | 'sessions'

export function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const { addToast } = useToast()

  const load = useCallback(async () => {
    try {
      setSessions(await listSessions())
    } catch (err) {
      console.error(err)
      addToast('No se pudieron cargar tus sesiones', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    load()
  }, [load])

  const cerrar = async (id: number) => {
    setBusy(true)
    try {
      await revokeSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      addToast('Sesión cerrada', 'success')
    } catch (err) {
      console.error(err)
      addToast('No se pudo cerrar la sesión', 'error')
    } finally {
      setBusy(false)
    }
  }

  const cerrarOtras = async () => {
    setBusy(true)
    try {
      const res = await revokeOtherSessions()
      addToast(
        res.cerradas > 0 ? `Se cerraron ${res.cerradas} sesiones` : 'No había otras sesiones abiertas',
        'success'
      )
      await load()
    } catch (err) {
      console.error(err)
      addToast('No se pudieron cerrar las sesiones', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
      </div>
    )
  }

  const others = sessions.filter(s => !s.actual).length

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">
        Dispositivos con la sesión abierta. Si no reconoces alguno, ciérralo y cambia tu contraseña.
      </p>

      {sessions.length === 0 ? (
        <EmptyState icon={MonitorSmartphone} title="Sin sesiones activas" />
      ) : (
        <ul className="space-y-2.5">
          {sessions.map(s => {
            const mobile = /Android|iOS/.test(describeDevice(s.user_agent))
            const Icon = mobile ? Smartphone : Laptop
            return (
              <li
                key={s.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border bg-surface-1 p-3.5',
                  s.actual ? 'border-gold/40' : 'border-line'
                )}
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-3">
                  <Icon className="size-5 text-text-muted" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                    {describeDevice(s.user_agent)}
                    {s.actual && <span className="badge badge-gold">Esta sesión</span>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {s.ip ? <span className="mono">{s.ip}</span> : 'IP desconocida'} · activa {timeAgo(s.ultimo_uso)}
                  </p>
                </div>
                {!s.actual && (
                  <button
                    onClick={() => cerrar(s.id)}
                    disabled={busy}
                    className="btn btn-danger btn-sm"
                    aria-label={`Cerrar la sesión de ${describeDevice(s.user_agent)}`}
                  >
                    <LogOut className="size-3.5" />
                    Cerrar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
        <button onClick={cerrarOtras} disabled={busy || others === 0} className="btn btn-secondary">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Cerrar las demás sesiones
        </button>
      </div>
    </div>
  )
}

interface AccountModalProps {
  usuario: string
  onClose: () => void
  initialTab?: Tab
}

/** "Mi cuenta": cambio de contraseña y sesiones activas del usuario autenticado. */
export default function AccountModal({ usuario, onClose, initialTab = 'password' }: AccountModalProps) {
  const [tab, setTab] = useState<Tab>(initialTab)

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
        ref={trapFocus}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Mi cuenta"
        className="animate-popIn card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={usuario} />
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-text">
                <UserCog className="size-4 text-gold" />
                Mi cuenta
              </h2>
              <p className="text-sm text-text-muted">{usuario}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <div className="border-b border-line px-6 py-3">
          <div className="segmented" role="tablist">
            {(
              [
                ['password', 'Contraseña', KeyRound],
                ['sessions', 'Sesiones activas', MonitorSmartphone],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className="segmented-option"
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-6">
          {tab === 'password' ? (
            <>
              <p className="mb-4 text-sm text-text-muted">
                Al cambiarla se cierran tus otras sesiones.
              </p>
              <PasswordForm mode="self" onDone={onClose} onCancel={onClose} />
            </>
          ) : (
            <SessionsPanel />
          )}
        </div>
      </div>
    </div>
  )
}
