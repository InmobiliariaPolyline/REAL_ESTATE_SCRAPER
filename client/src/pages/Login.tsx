import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import WhatsAppFab from "@/components/common/WhatsAppFab"
import { login, type AuthSnapshot, type LoginFailure } from "@/lib/auth"

interface LoginProps {
  onLoginSuccess: (snapshot: AuthSnapshot) => void
}

const ERROR_MESSAGES: Record<LoginFailure, string> = {
  invalid: "Usuario o contraseña incorrectos",
  banned: "Cuenta suspendida. Contacta al administrador.",
  locked: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
  unknown_role: "Tu cuenta no tiene un rol válido. Contacta al administrador.",
  network: "Error al conectar con el servidor",
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError("")

    setLoading(true)
    try {
      const outcome = await login(usuario, password)
      if (!outcome.ok) {
        setError(ERROR_MESSAGES[outcome.reason])
        return
      }
      onLoginSuccess(outcome.snapshot)
    } catch (err) {
      console.error(err)
      setError(ERROR_MESSAGES.network)
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
            style={{ fontFamily: "Cormorant Garamond", color: "#C9A96E" }}
          >
            REAL ESTATE SCRAPER
          </h1>
          <p className="text-base text-white" style={{ fontFamily: "DM Sans" }}>
            El mercado inmobiliario peruano, en tiempo real.
          </p>
        </div>
      </div>

      {/* Mitad derecha — formulario */}
      <div className="w-full lg:w-1/2 bg-black flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h2
            className="text-4xl font-bold mb-8 text-center"
            style={{ fontFamily: "Cormorant Garamond", color: "#C9A96E" }}
          >
            Bienvenido
          </h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="login-usuario"
                className="block text-sm font-medium mb-2"
                style={{ color: "#F0EDE8", fontFamily: "DM Sans" }}
              >
                Usuario
              </label>
              <input
                id="login-usuario"
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                className="input-underline w-full"
                placeholder="Tu usuario"
                autoComplete="username"
                autoCapitalize="none"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium mb-2"
                style={{ color: "#F0EDE8", fontFamily: "DM Sans" }}
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-underline w-full pr-10"
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold mt-8"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>

      <WhatsAppFab />
    </div>
  )
}
