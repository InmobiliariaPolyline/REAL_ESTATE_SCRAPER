import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'

interface Suscripcion {
  id: number
  usuario_id: number
  fecha_inicio: string
  fecha_vencimiento: string
  fecha_limite_eliminacion: string
}

interface Usuario {
  id: number
  usuario: string
  rol: string
  estado: string
  creado_en: string
  ultima_conexion: string
  // Enriquecido en memoria después de la consulta
  suscripcionActiva: Suscripcion | null
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0) // fuerza re-fetch cada vez que se incrementa

  const [showModal, setShowModal] = useState(false)
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null)
  const [modalAction, setModalAction] = useState<'premium' | 'banear' | 'activar' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Estados para nuevo usuario
  const [newUsuario, setNewUsuario] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRol, setNewRol] = useState('usuario')
  const [newEstado, setNewEstado] = useState('activo')
  const [newPlan, setNewPlan] = useState('GRATIS')
  const [creating, setCreating] = useState(false)

  const { addToast } = useToast()

  // ─────────────────────────────────────────────────────────────────────────────
  // CARGA DE DATOS: dos consultas separadas → usuarios + suscripciones activas
  // Así evitamos que RLS o join implícito bloquee la relación.
  // ─────────────────────────────────────────────────────────────────────────────
  const loadUsuarios = useCallback(async () => {
    try {
      setLoading(true)

      // 1. Traer todos los usuarios
      const { data: usersRaw, error: usersError } = await supabase
        .from('usuarios')
        .select('id, usuario, rol, estado, creado_en, ultima_conexion')
        .order('creado_en', { ascending: false })

      if (usersError) throw usersError
      if (!usersRaw || usersRaw.length === 0) {
        setUsuarios([])
        return
      }

      // 2. Traer todas las suscripciones de esos usuarios de una sola vez
      const hoy = new Date().toISOString().split('T')[0]
      const ids = usersRaw.map((u: any) => u.id)

      const { data: subsRaw } = await supabase
        .from('suscripciones')
        .select('id, usuario_id, fecha_inicio, fecha_vencimiento, fecha_limite_eliminacion')
        .in('usuario_id', ids)
        .gte('fecha_limite_eliminacion', hoy) // solo suscripciones no expiradas
        .order('fecha_vencimiento', { ascending: false })

      // 3. Construir un mapa usuario_id → suscripción más reciente activa
      const subsMap: Record<number, Suscripcion> = {}
      if (subsRaw) {
        for (const sub of subsRaw as Suscripcion[]) {
          // Como están ordenadas desc, la primera que encontramos por usuario es la más reciente
          if (!subsMap[sub.usuario_id]) {
            subsMap[sub.usuario_id] = sub
          }
        }
      }

      // 4. Enriquecer cada usuario con su suscripción activa
      const enriched: Usuario[] = (usersRaw as any[]).map((u) => ({
        ...u,
        suscripcionActiva: subsMap[u.id] ?? null,
      }))

      setUsuarios(enriched)
    } catch (err) {
      addToast('Error al cargar usuarios', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Ejecutar cuando el componente monta o cuando refreshKey cambia
  useEffect(() => {
    loadUsuarios()
  }, [loadUsuarios, refreshKey])

  // Función para disparar refresh inmediato desde cualquier acción
  const triggerRefresh = () => setRefreshKey((k) => k + 1)

  // ─────────────────────────────────────────────────────────────────────────────
  // CREAR USUARIO
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCreateUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsuario.trim() || !newPassword.trim()) {
      addToast('Por favor, completa el usuario y la contraseña', 'error')
      return
    }

    try {
      setCreating(true)

      // 1. Insertar usuario
      const { data: usuarioCreado, error: errorUsuario } = await supabase
        .from('usuarios')
        .insert({
          usuario: newUsuario.trim(),
          password_hash: newPassword, // en texto plano por ahora
          rol: newRol,
          estado: newEstado,
        })
        .select('id')
        .single()

      if (errorUsuario) throw errorUsuario

      // 2. Si el plan es PREMIUM, insertar suscripción
      if (newPlan === 'PREMIUM' && usuarioCreado?.id) {
        const hoy = new Date()
        const fechaInicio = hoy.toISOString().split('T')[0]

        const fechaVence = new Date(hoy)
        fechaVence.setDate(fechaVence.getDate() + 30)

        const fechaLimite = new Date(hoy)
        fechaLimite.setDate(fechaLimite.getDate() + 37)

        const { error: errorSub } = await supabase.from('suscripciones').insert({
          usuario_id: usuarioCreado.id,
          fecha_inicio: fechaInicio,
          fecha_vencimiento: fechaVence.toISOString().split('T')[0],
          fecha_limite_eliminacion: fechaLimite.toISOString().split('T')[0],
        })

        if (errorSub) throw errorSub
      }

      addToast(
        newPlan === 'PREMIUM'
          ? `✅ Usuario "${newUsuario.trim()}" creado con plan PREMIUM (+30 días)`
          : `✅ Usuario "${newUsuario.trim()}" creado exitosamente`,
        'success'
      )

      setNewUsuario('')
      setNewPassword('')
      setNewRol('usuario')
      setNewEstado('activo')
      setNewPlan('GRATIS')
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message || 'Error al crear usuario', 'error')
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCIONES DE TABLA (Premium / Banear / Activar)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleAction = async () => {
    if (!selectedUsuario || !modalAction) return

    try {
      setActionLoading(true)
      const hoy = new Date()
      const hoyStr = hoy.toISOString().split('T')[0]

      if (modalAction === 'premium') {
        const fechaVence = new Date(hoy)
        fechaVence.setDate(fechaVence.getDate() + 30)
        const fechaLimite = new Date(hoy)
        fechaLimite.setDate(fechaLimite.getDate() + 37)

        const { error } = await supabase.from('suscripciones').insert({
          usuario_id: selectedUsuario.id,
          fecha_inicio: hoyStr,
          fecha_vencimiento: fechaVence.toISOString().split('T')[0],
          fecha_limite_eliminacion: fechaLimite.toISOString().split('T')[0],
        })
        if (error) throw error
        addToast(`✅ Premium activado para "${selectedUsuario.usuario}" (+30 días)`, 'success')
      } else if (modalAction === 'banear') {
        const { error } = await supabase
          .from('usuarios')
          .update({ estado: 'baneado' })
          .eq('id', selectedUsuario.id)
        if (error) throw error
        addToast(`🚫 Usuario "${selectedUsuario.usuario}" baneado`, 'success')
      } else if (modalAction === 'activar') {
        const { error } = await supabase
          .from('usuarios')
          .update({ estado: 'activo' })
          .eq('id', selectedUsuario.id)
        if (error) throw error
        addToast(`✔️ Usuario "${selectedUsuario.usuario}" activado`, 'success')
      }

      // Cerrar modal y disparar re-fetch inmediato
      setShowModal(false)
      setSelectedUsuario(null)
      setModalAction(null)
      triggerRefresh()
    } catch (err) {
      addToast('Error al ejecutar acción', 'error')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (date: string) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('es-PE')
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
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
              onChange={(e) => setNewRol(e.target.value)}
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
              onChange={(e) => setNewPlan(e.target.value)}
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
              <option value="PREMIUM">Premium (+30 días)</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Estado
            </label>
            <select
              value={newEstado}
              onChange={(e) => setNewEstado(e.target.value)}
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
                        {/* Activar Premium — solo si NO tiene suscripción activa y no es admin */}
                        {!sub && user.rol !== 'admin' && (
                          <button
                            onClick={() => { setSelectedUsuario(user); setModalAction('premium'); setShowModal(true) }}
                            className="px-2 py-1 rounded text-xs font-medium transition hover:opacity-80"
                            style={{ backgroundColor: '#22C55E', color: 'white', fontFamily: 'DM Sans' }}
                          >
                            ✅ Premium
                          </button>
                        )}
                        {/* Banear — solo si está activo y no es admin */}
                        {user.estado === 'activo' && user.rol !== 'admin' && (
                          <button
                            onClick={() => { setSelectedUsuario(user); setModalAction('banear'); setShowModal(true) }}
                            className="px-2 py-1 rounded text-xs font-medium transition hover:opacity-80"
                            style={{ backgroundColor: '#EF4444', color: 'white', fontFamily: 'DM Sans' }}
                          >
                            🚫 Banear
                          </button>
                        )}
                        {/* Activar — solo si está baneado */}
                        {user.estado === 'baneado' && user.rol !== 'admin' && (
                          <button
                            onClick={() => { setSelectedUsuario(user); setModalAction('activar'); setShowModal(true) }}
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
      {showModal && selectedUsuario && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => !actionLoading && setShowModal(false)}
        >
          <div
            className="p-6 rounded max-w-sm w-full mx-4"
            style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#F0EDE8', fontFamily: 'DM Sans', fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {modalAction === 'premium' ? '¿Activar Premium?' : modalAction === 'banear' ? '¿Banear usuario?' : '¿Activar usuario?'}
            </h3>
            {modalAction === 'premium' && (
              <p style={{ color: '#6B6B6B', fontFamily: 'DM Sans', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Se asignarán 30 días de acceso premium desde hoy.
              </p>
            )}
            <p style={{ color: '#6B6B6B', fontFamily: 'DM Sans', marginBottom: '1.5rem' }}>
              Usuario: <strong style={{ color: '#F0EDE8' }}>{selectedUsuario.usuario}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ backgroundColor: 'transparent', border: '1px solid #2A2A2A', color: '#6B6B6B', fontFamily: 'DM Sans', opacity: actionLoading ? 0.5 : 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 rounded text-sm font-medium transition"
                style={{ backgroundColor: '#C9A96E', color: '#0F0F0F', fontFamily: 'DM Sans', opacity: actionLoading ? 0.6 : 1 }}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
