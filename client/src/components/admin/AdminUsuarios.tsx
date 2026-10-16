import { Ban, Crown, KeyRound, Loader2, RefreshCw, ShieldCheck, UserCheck, UserPlus, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Avatar from '@/components/common/Avatar'
import ConfirmModal from '@/components/common/ConfirmModal'
import EmptyState from '@/components/common/EmptyState'
import PasswordModal from '@/components/common/PasswordModal'
import { useToast } from '@/contexts/ToastContext'
import { PREMIUM_DAYS } from '@/lib/config'
import { formatDate } from '@/lib/dates'
import {
  MIN_PASSWORD_LENGTH,
  activatePremium,
  apiErrorMessage,
  createUsuario,
  listUsuarios,
  setUsuarioEstado,
  type UsuarioRow,
} from '@/lib/usuariosAdmin'
import type { EstadoUsuario, Rol } from '@/types'

type Usuario = UsuarioRow
type ModalAction = 'premium' | 'banear' | 'activar'

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0) // fuerza re-fetch cada vez que se incrementa

  const [showModal, setShowModal] = useState(false)
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null)
  const [modalAction, setModalAction] = useState<ModalAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [passwordUser, setPasswordUser] = useState<Usuario | null>(null)

  // Estados para nuevo usuario
  const [newUsuario, setNewUsuario] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRol, setNewRol] = useState<Rol>('usuario')
  const [newEstado, setNewEstado] = useState<EstadoUsuario>('activo')
  const [newPlan, setNewPlan] = useState<'GRATIS' | 'PREMIUM'>('GRATIS')
  const [creating, setCreating] = useState(false)

  const { addToast } = useToast()

  // Carga usuarios + suscripciones vigentes (ver lib/usuariosAdmin.ts).
  const loadUsuarios = useCallback(async () => {
    try {
      setLoading(true)
      setUsuarios(await listUsuarios())
    } catch (err) {
      addToast('Error al cargar usuarios', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    loadUsuarios()
  }, [loadUsuarios, refreshKey])

  const triggerRefresh = () => setRefreshKey(k => k + 1)

  const openModal = (user: Usuario, action: ModalAction) => {
    setSelectedUsuario(user)
    setModalAction(action)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedUsuario(null)
    setModalAction(null)
  }

  // ───────────────────────────── CREAR USUARIO ─────────────────────────────
  const handleCreateUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creating) return

    const usuario = newUsuario.trim()
    if (!usuario || !newPassword) {
      addToast('Por favor, completa el usuario y la contraseña', 'error')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      addToast(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`, 'error')
      return
    }

    try {
      setCreating(true)
      await createUsuario({
        usuario,
        password: newPassword,
        rol: newRol,
        estado: newEstado,
        premium: newPlan === 'PREMIUM',
      })

      addToast(
        newPlan === 'PREMIUM'
          ? `Usuario "${usuario}" creado con plan Premium (+${PREMIUM_DAYS} días)`
          : `Usuario "${usuario}" creado correctamente`,
        'success'
      )

      setNewUsuario('')
      setNewPassword('')
      setNewRol('usuario')
      setNewEstado('activo')
      setNewPlan('GRATIS')
      triggerRefresh()
    } catch (err) {
      addToast(apiErrorMessage(err, 'Error al crear usuario'), 'error')
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  // ─────────────────── ACCIONES DE TABLA (Premium / Banear / Activar) ───────────────────
  const handleAction = async () => {
    if (!selectedUsuario || !modalAction || actionLoading) return

    try {
      setActionLoading(true)

      if (modalAction === 'premium') {
        await activatePremium(selectedUsuario.id)
        addToast(
          `Premium activo para "${selectedUsuario.usuario}" (+${PREMIUM_DAYS} días)`,
          'success'
        )
      } else if (modalAction === 'banear') {
        await setUsuarioEstado(selectedUsuario.id, 'baneado')
        addToast(`Usuario "${selectedUsuario.usuario}" baneado`, 'success')
      } else {
        await setUsuarioEstado(selectedUsuario.id, 'activo')
        addToast(`Usuario "${selectedUsuario.usuario}" activado`, 'success')
      }

      closeModal()
      triggerRefresh()
    } catch (err) {
      addToast(apiErrorMessage(err, 'Error al ejecutar la acción'), 'error')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const modalTitle = (user: Usuario, action: ModalAction) =>
    action === 'premium'
      ? user.suscripcionActiva
        ? '¿Renovar Premium?'
        : '¿Activar Premium?'
      : action === 'banear'
        ? '¿Banear usuario?'
        : '¿Activar usuario?'

  return (
    <div className="space-y-6">
      {/* Crear usuario */}
      <form onSubmit={handleCreateUsuario} className="card p-6" noValidate>
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gold-soft ring-1 ring-gold/25">
            <UserPlus className="size-5 text-gold" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text">Crear nuevo usuario</h2>
            <p className="text-sm text-text-muted">
              La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <label htmlFor="nu-usuario" className="field-label">Usuario</label>
            <input
              id="nu-usuario"
              type="text"
              value={newUsuario}
              onChange={e => setNewUsuario(e.target.value)}
              placeholder="Nombre de usuario"
              className="field"
              autoComplete="off"
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="nu-pass" className="field-label">Contraseña</label>
            <input
              id="nu-pass"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Contraseña"
              className="field"
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="nu-rol" className="field-label">Rol</label>
            <select
              id="nu-rol"
              value={newRol}
              onChange={e => setNewRol(e.target.value as Rol)}
              className="field"
              disabled={creating}
            >
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div>
            <label htmlFor="nu-plan" className="field-label">Plan</label>
            <select
              id="nu-plan"
              value={newPlan}
              onChange={e => setNewPlan(e.target.value as 'GRATIS' | 'PREMIUM')}
              className="field"
              disabled={creating}
            >
              <option value="GRATIS">Gratis</option>
              <option value="PREMIUM">Premium (+{PREMIUM_DAYS} días)</option>
            </select>
          </div>

          <div>
            <label htmlFor="nu-estado" className="field-label">Estado</label>
            <select
              id="nu-estado"
              value={newEstado}
              onChange={e => setNewEstado(e.target.value as EstadoUsuario)}
              className="field"
              disabled={creating}
            >
              <option value="activo">Activo</option>
              <option value="baneado">Baneado</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="submit" disabled={creating} className="btn btn-primary">
            {creating ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {creating ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>

      {/* Tabla de usuarios */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text">Usuarios registrados</h2>
            <p className="text-sm text-text-muted">
              {loading ? 'Cargando...' : `${usuarios.length} en total`}
            </p>
          </div>
          <button
            onClick={triggerRefresh}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            aria-label="Actualizar lista de usuarios"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table-modern min-w-[820px]">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Plan</th>
                <th>Vencimiento</th>
                <th>Última conexión</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando usuarios...
                    </div>
                  </td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Users}
                      title="Sin usuarios registrados"
                      description="Crea el primer usuario con el formulario de arriba."
                    />
                  </td>
                </tr>
              ) : (
                usuarios.map(user => {
                  const sub = user.suscripcionActiva
                  const isAdmin = user.rol === 'admin'
                  return (
                    <tr key={`${user.id}-${refreshKey}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={user.usuario} size="sm" />
                          <span className="font-medium text-text">{user.usuario}</span>
                        </div>
                      </td>
                      <td>
                        {isAdmin ? (
                          <span className="badge badge-gold">
                            <ShieldCheck className="size-3.5" />
                            Admin
                          </span>
                        ) : (
                          <span className="badge badge-muted">Usuario</span>
                        )}
                      </td>
                      <td>
                        <span className={user.estado === 'activo' ? 'badge badge-green' : 'badge badge-rose'}>
                          <span className="dot" />
                          {user.estado === 'activo' ? 'Activo' : 'Baneado'}
                        </span>
                      </td>
                      <td>
                        {sub ? (
                          <span className="badge badge-gold">
                            <Crown className="size-3.5" />
                            Premium
                          </span>
                        ) : (
                          <span className="badge badge-muted">Gratis</span>
                        )}
                      </td>
                      <td className="mono whitespace-nowrap text-sm">
                        {sub ? <span className="text-gold">{formatDate(sub.fecha_vencimiento)}</span> : <span className="text-text-faint">—</span>}
                      </td>
                      <td className="whitespace-nowrap text-text-muted">{formatDate(user.ultima_conexion)}</td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            onClick={() => setPasswordUser(user)}
                            className="btn btn-secondary btn-sm"
                            aria-label={`Restablecer contraseña de ${user.usuario}`}
                          >
                            <KeyRound className="size-3.5" />
                            Contraseña
                          </button>
                          {!isAdmin && (
                            <button
                              onClick={() => openModal(user, 'premium')}
                              className="btn btn-success btn-sm"
                            >
                              {sub ? <RefreshCw className="size-3.5" /> : <Crown className="size-3.5" />}
                              {sub ? 'Renovar' : 'Premium'}
                            </button>
                          )}
                          {user.estado === 'activo' && !isAdmin && (
                            <button
                              onClick={() => openModal(user, 'banear')}
                              className="btn btn-danger btn-sm"
                            >
                              <Ban className="size-3.5" />
                              Banear
                            </button>
                          )}
                          {user.estado === 'baneado' && !isAdmin && (
                            <button
                              onClick={() => openModal(user, 'activar')}
                              className="btn btn-secondary btn-sm"
                            >
                              <UserCheck className="size-3.5" />
                              Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {passwordUser && (
        <PasswordModal
          mode="reset"
          usuarioId={passwordUser.id}
          usuario={passwordUser.usuario}
          onClose={() => setPasswordUser(null)}
        />
      )}

      {showModal && selectedUsuario && modalAction && (
        <ConfirmModal
          title={modalTitle(selectedUsuario, modalAction)}
          busy={actionLoading}
          tone={modalAction === 'banear' ? 'danger' : 'gold'}
          onConfirm={handleAction}
          onCancel={closeModal}
        >
          {modalAction === 'premium' && (
            <p className="mb-2">
              {selectedUsuario.suscripcionActiva
                ? `Se sumarán ${PREMIUM_DAYS} días a partir del vencimiento actual.`
                : `Se asignarán ${PREMIUM_DAYS} días de acceso premium desde hoy.`}
            </p>
          )}
          <p>
            Usuario: <strong className="text-text">{selectedUsuario.usuario}</strong>
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}
