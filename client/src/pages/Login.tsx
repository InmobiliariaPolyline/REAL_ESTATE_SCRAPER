import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase, ADMIN_WHATSAPP } from '@/lib/supabase'

interface LoginProps {
  onLoginSuccess: (usuario: any) => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Query a Supabase
      const { data, error: queryError } = await supabase
        .from('usuarios')
        .select('id, usuario, rol, estado')
        .eq('usuario', usuario)
        .eq('password_hash', password)
        .single()

      if (!data || queryError) {
        setError('Código de acceso incorrecto')
        setLoading(false)
        return
      }

      if (data.estado === 'baneado') {
        setError('Cuenta suspendida. Contacta al administrador.')
        setLoading(false)
        return
      }

      // Registrar acceso en historial_accesos
      await supabase.from('historial_accesos').insert({ usuario_id: data.id })

      // Actualizar ultima_conexion
      await supabase
        .from('usuarios')
        .update({ ultima_conexion: new Date().toISOString() })
        .eq('id', data.id)

      // Login exitoso
      onLoginSuccess(data)
    } catch (err) {
      setError('Error al conectar con el servidor')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-black">
      {/* Mitad izquierda — solo desktop */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&auto=format&fm=webp&q=80"
          alt="Lima"
          className="w-full h-full object-cover"
          decoding="async"
          fetchPriority="high"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/72"></div>

        {/* Contenido centrado */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <img
            src="/logo.png"
            alt="REAL ESTATE SCRAPER Logo"
            className="w-24 h-24 mb-6 object-contain"
            decoding="async"
          />
          <h1
            className="text-6xl font-bold mb-4"
            style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
          >
            REAL ESTATE SCRAPER
          </h1>
          <p
            className="text-base text-white"
            style={{ fontFamily: 'DM Sans' }}
          >
            El mercado inmobiliario peruano, en tiempo real.
          </p>
        </div>
      </div>

      {/* Mitad derecha — formulario */}
      <div className="w-full lg:w-1/2 bg-black flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Encabezado */}
          <h2
            className="text-4xl font-bold mb-8 text-center"
            style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
          >
            Bienvenido
          </h2>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Usuario */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: '#F0EDE8', fontFamily: 'DM Sans' }}
              >
                Usuario
              </label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="input-underline w-full"
                placeholder="Tu usuario"
                disabled={loading}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: '#F0EDE8', fontFamily: 'DM Sans' }}
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-underline w-full pr-10"
                  placeholder="Tu contraseña"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* Mensaje de error */}
            {error && <p className="error-message">{error}</p>}

            {/* Botón Ingresar */}
            <button
              type="submit"
              disabled={loading}
              className="btn-gold mt-8"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>

      {/* Botón WhatsApp flotante */}
      <a
        href={`https://wa.me/${ADMIN_WHATSAPP}?text=Hola, quiero información sobre Real Estate Scraper`}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-button"
        title="¿Quieres acceder? Contáctanos"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </a>
    </div>
  )
}
