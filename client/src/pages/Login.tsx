import { BarChart3, Eye, EyeOff, Layers, Loader2, Lock, ShieldCheck, User } from "lucide-react"
import { useState } from "react"
import Logo from "@/components/common/Logo"
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

const HIGHLIGHTS = [
  { icon: Layers, title: "Todos los portales", text: "Properati, Urbania, Infocasas, Babilonia y Adondevivir en un solo lugar." },
  { icon: BarChart3, title: "Precios comparables", text: "Soles y dólares normalizados para comparar sin hacer cuentas." },
  { icon: ShieldCheck, title: "Acceso por suscripción", text: "Datos actualizados y protegidos para tu equipo." },
]

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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca (solo escritorio) */}
      <aside className="relative hidden overflow-hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600&auto=format&fm=webp&q=80"
          alt=""
          className="absolute inset-0 size-full object-cover"
          decoding="async"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgb(var(--app-rgb)/0.6)_0%,rgb(var(--app-rgb)/0.9)_55%,var(--app)_100%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div className="max-w-lg">
            <p className="eyebrow mb-4">Inteligencia inmobiliaria</p>
            <h2 className="font-display text-5xl font-semibold leading-[1.05] text-text">
              El mercado inmobiliario peruano, en tiempo real.
            </h2>
            <ul className="mt-10 space-y-5">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft ring-1 ring-gold/25">
                    <Icon className="size-5 text-gold" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-text">{title}</span>
                    <span className="block text-sm text-text-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-text-faint">Real Estate Scraper</p>
        </div>
      </aside>

      {/* Formulario */}
      <main id="contenido" className="flex items-center justify-center px-5 py-10">
        <div className="animate-slideInUp w-full max-w-md">
          <Logo className="mb-10 lg:hidden" />

          <div className="card p-8 sm:p-10">
            <p className="eyebrow mb-3">Acceso</p>
            <h1 className="font-display text-4xl font-semibold text-text">Bienvenido</h1>
            <p className="mt-2 text-sm text-text-muted">
              Ingresa con tu usuario y contraseña para continuar.
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5" noValidate>
              <div>
                <label htmlFor="login-usuario" className="field-label">
                  Usuario
                </label>
                <div className="field-icon">
                  <User className="size-4" />
                  <input
                    id="login-usuario"
                    type="text"
                    value={usuario}
                    onChange={e => setUsuario(e.target.value)}
                    className="field"
                    aria-invalid={!!error}
                    placeholder="Tu usuario"
                    autoComplete="username"
                    autoCapitalize="none"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="field-label">
                  Contraseña
                </label>
                <div className="field-icon">
                  <Lock className="size-4" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="field pr-11"
                    aria-invalid={!!error}
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-faint transition hover:bg-surface-4 hover:text-text"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  className="error-message rounded-xl border border-rose/25 bg-rose/10 px-3.5 py-2.5"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-text-faint">
            ¿No tienes acceso? Escríbenos con el botón de WhatsApp.
          </p>
        </div>
      </main>

      <WhatsAppFab />
    </div>
  )
}
