import { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '@/components/common/ConfirmModal'
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
      addToast(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
        'error'
      )
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
          ? `✅ Usuario "${usuario}" creado con plan PREMIUM (+${PREMIUM_DAYS} días)`
          : `✅ Usuario "${usuario}" creado exitosamente`,
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
          `✅ Premium activado para "${selectedUsuario.usuario}" (+${PREMIUM_DAYS} días)`,
          'success'
        )
      } else if (modalAction === 'banear') {
        await setUsuarioEstado(selectedUsuario.id, 'baneado')
        addToast(`🚫 Usuario "${selectedUsuario.usuario}" baneado`, 'success')
      } else {
        await setUsuarioEstado(selectedUsuario.id, 'activo')
        addToast(`✔️ Usuario "${selectedUsuario.usuario}" activado`, 'success')
      }

      closeModal()
      triggerRefresh()
    } catch (err) {
      addToast('Error al ejecutar acción', 'error')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Formulario Crear Nuevo Usuario ──────────────────────────────────── */}
      <form
        onSubmit={handleCreateUsuario}
        className="p-6 rounded space-y-4"
        style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}
      >
        <h3
          className="text-lg font-bold"
          style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
        >
          Crear Nuevo Usuario
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Usuario */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Usuario
            </label>
            <input
              type="text"
              value={newUsuario}
              onChange={(e) => setNewUsuario(e.target.value)}
              placeholder="Nombre de usuario"
              className="input-underline w-full text-sm"
              disabled={creating}
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Contraseña"
              className="input-underline w-full text-sm"
              disabled={creating}
            />
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Rol
            </label>
            <select
              value={newRol}
              onChange={(e) => setNewRol(e.target.value as Rol)}
              className="w-full px-3 py-2 rounded text-xs"
              style={{ backgroundColor: '#252525', color: '#F0EDE8', border: '1px solid #2A2A2A', fontFamily: 'DM Sans', height: '38px' }}
              disabled={creating}
            >
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {/* Plan */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Plan
            </label>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value as 'GRATIS' | 'PREMIUM')}
              className="w-full px-3 py-2 rounded text-xs"
              style={{
                backgroundColor: '#252525',
                color: newPlan === 'PREMIUM' ? '#C9A96E' : '#F0EDE8',
                border: newPlan === 'PREMIUM' ? '1px solid #C9A96E' : '1px solid #2A2A2A',
                fontFamily: 'DM Sans',
                fontWeight: newPlan === 'PREMIUM' ? '600' : '400',
                height: '38px',
              }}
              disabled={creating}
            >
              <option value="GRATIS">Gratis</option>
              <option value="PREMIUM">Premium (+{PREMIUM_DAYS} días)</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Estado
            </label>
            <select
              value={newEstado}
              onChange={(e) => setNewEstado(e.target.value as EstadoUsuario)}
              className="w-full px-3 py-2 rounded text-xs"
              style={{ backgroundColor: '#252525', color: '#F0EDE8', border: '1px solid #2A2A2A', fontFamily: 'DM Sans', height: '38px' }}
              disabled={creating}
            >
              <option value="activo">Activo</option>
              <option value="baneado">Baneado</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2 rounded font-medium transition"
            style={{
              backgroundColor: '#C9A96E',
              color: '#0F0F0F',
              fontFamily: 'DM Sans',
              fontSize: '0.875rem',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Creando...' : 'Crear Usuario'}
          </button>
        </div>
      </form>

      {/* ── Tabla de Usuarios ───────────────────────────────────────────────── */}
      <div className="rounded overflow-x-auto" style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}>
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans' }}>
          <thead>
            <tr style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid #2A2A2A' }}>
              {['Usuario', 'Rol', 'Estado', 'Plan', 'Vencimiento', 'Última conexión', 'Acciones'].map((col) => (
                <th
                  key={col}
                  className={`px-4 py-3 text-left font-semibold ${col === 'Acciones' ? 'text-center' : ''}`}
                  style={{ color: '#C9A96E' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#6B6B6B' }}>
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }}></span>
                    Cargando usuarios...
                  </div>
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#6B6B6B' }}>
                  Sin usuarios registrados
                </td>
              </tr>
            ) : (
              usuarios.map((user, idx) => {
                const sub = user.suscripcionActiva
                return (
                  <tr
                    key={`${user.id}-${refreshKey}`}
                    style={{
                      borderBottom: '1px solid #2A2A2A',
                      backgroundColor: idx % 2 === 0 ? '#0F0F0F' : '#111111',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    {/* Usuario */}
                    <td className="px-4 py-3" style={{ color: '#F0EDE8' }}>
                      {user.usuario}
                    </td>

                    {/* Rol */}
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{
                          backgroundColor: user.rol === 'admin' ? '#C9A96E' : '#2A2A2A',
                          color: user.rol === 'admin' ? '#0F0F0F' : '#F0EDE8',
                        }}
                      >
                        {user.rol}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{
                          backgroundColor: user.estado === 'activo' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: user.estado === 'activo' ? '#22C55E' : '#EF4444',
                          border: `1px solid ${user.estado === 'activo' ? '#22C55E44' : '#EF444444'}`,
                        }}
                      >
                        {user.estado}
                      </span>
                    </td>

                    {/* Plan — usa suscripcionActiva directamente */}
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{
                          backgroundColor: sub ? 'rgba(201,169,110,0.15)' : 'transparent',
                          color: sub ? '#C9A96E' : '#6B6B6B',
                          border: sub ? '1px solid #C9A96E44' : '1px solid #2A2A2A',
                        }}
                      >
                        {sub ? 'PREMIUM' : 'GRATIS'}
                      </span>
                    </td>

                    {/* Vencimiento — usa fecha_vencimiento real */}
                    <td className="px-4 py-3" style={{ color: sub ? '#C9A96E' : '#6B6B6B', fontFamily: sub ? 'JetBrains Mono' : 'DM Sans', fontSize: sub ? '0.8rem' : '0.875rem' }}>
                      {sub ? formatDate(sub.fecha_vencimiento) : '—'}
                    </td>

                    {/* Última conexión */}
                    <td className="px-4 py-3" style={{ color: '#6B6B6B' }}>
                      {formatDate(user.ultima_conexion)}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {/* Activar / renovar Premium — no aplica a administradores */}
                        {user.rol !== 'admin' && (
                          <button
                            onClick={() => openModal(user, 'premium')}
                            className="px-2 py-1 rounded text-xs font-medium transition hover:opacity-80"
                            style={{ backgroundColor: '#22C55E', color: 'white', fontFamily: 'DM Sans' }}
                          >
                            {sub ? '🔄 Renovar' : '✅ Premium'}
                          </button>
                        )}
                        {/* Banear — solo si está activo y no es admin */}
                        {user.estado === 'activo' && user.rol !== 'admin' && (
                          <button
                            onClick={() => openModal(user, 'banear')}
                            className="px-2 py-1 rounded text-xs font-medium transition hover:opacity-80"
                            style={{ backgroundColor: '#EF4444', color: 'white', fontFamily: 'DM Sans' }}
                          >
                            🚫 Banear
                          </button>
                        )}
                        {/* Activar — solo si está baneado */}
                        {user.estado === 'baneado' && user.rol !== 'admin' && (
                          <button
                            onClick={() => openModal(user, 'activar')}
                            className="px-2 py-1 rounded text-xs font-medium transition hover:opacity-80"
                            style={{ backgroundColor: '#60A5FA', color: 'white', fontFamily: 'DM Sans' }}
                          >
                            ✔️ Activar
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

      {/* ── Modal de Confirmación ────────────────────────────────────────────── */}
      {showModal && selectedUsuario && modalAction && (
        <ConfirmModal
          title={
            modalAction === 'premium'
              ? selectedUsuario.suscripcionActiva
                ? '¿Renovar Premium?'
                : '¿Activar Premium?'
              : modalAction === 'banear'
                ? '¿Banear usuario?'
                : '¿Activar usuario?'
          }
          busy={actionLoading}
          tone={modalAction === 'banear' ? 'danger' : 'gold'}
          onConfirm={handleAction}
          onCancel={closeModal}
        >
          {modalAction === 'premium' && (
            <p style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
              {selectedUsuario.suscripcionActiva
                ? `Se sumarán ${PREMIUM_DAYS} días a partir del vencimiento actual.`
                : `Se asignarán ${PREMIUM_DAYS} días de acceso premium desde hoy.`}
            </p>
          )}
          <p>
            Usuario: <strong style={{ color: '#F0EDE8' }}>{selectedUsuario.usuario}</strong>
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}
