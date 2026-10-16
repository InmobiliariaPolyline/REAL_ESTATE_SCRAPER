import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import ErrorBoundary from "./components/common/ErrorBoundary"
import FullScreenLoader from "./components/common/FullScreenLoader"
import { ThemeProvider } from "./contexts/ThemeContext"
import { ToastProvider, useToast } from "./contexts/ToastContext"
import { logout, restoreSession, type AuthSnapshot } from "./lib/auth"
import { formatDate } from "./lib/dates"

const Login = lazy(() => import("./pages/Login"))
const Vencido = lazy(() => import("./pages/Vencido"))
const Portal = lazy(() => import("./pages/Portal"))
const Admin = lazy(() => import("./pages/Admin"))

/** Intervalo mínimo entre revalidaciones de la sesión al volver a la pestaña. */
const REVALIDATE_MIN_INTERVAL_MS = 60 * 1000

function Router() {
  const [auth, setAuth] = useState<AuthSnapshot | null>(null)
  const [booting, setBooting] = useState(true)
  const { addToast } = useToast()
  const lastCheck = useRef(0)

  // Restaura la sesión guardada revalidándola contra el servidor.
  useEffect(() => {
    let cancelled = false
    restoreSession()
      .then(snapshot => {
        if (!cancelled) setAuth(snapshot)
      })
      .catch(err => {
        console.error("Error al restaurar la sesión:", err)
        if (!cancelled) addToast("No se pudo verificar tu sesión", "error")
      })
      .finally(() => {
        if (!cancelled) {
          lastCheck.current = Date.now()
          setBooting(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [addToast])

  const handleLogout = useCallback(
    async (message = "Sesión cerrada") => {
      await logout()
      setAuth(null)
      addToast(message, "info")
    },
    [addToast]
  )

  // Si el usuario fue baneado o su plan venció mientras la pestaña estaba abierta, se detecta
  // al volver a ella.
  useEffect(() => {
    if (!auth) return
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastCheck.current < REVALIDATE_MIN_INTERVAL_MS) return
      lastCheck.current = Date.now()
      try {
        const snapshot = await restoreSession()
        if (!snapshot) {
          await handleLogout("Tu sesión ya no es válida. Inicia sesión de nuevo.")
        } else if (snapshot.vista !== auth.vista) {
          setAuth(snapshot)
          if (snapshot.vista === "vencido") {
            addToast("Tu suscripción ha vencido", "error")
          }
        }
      } catch (err) {
        console.error("No se pudo revalidar la sesión:", err)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [auth, addToast, handleLogout])

  const handleLoginSuccess = (snapshot: AuthSnapshot) => {
    setAuth(snapshot)
    lastCheck.current = Date.now()
    if (snapshot.vista === "admin") {
      addToast("¡Bienvenido, administrador!", "success")
    } else if (snapshot.vista === "portal") {
      addToast(`¡Bienvenido, ${snapshot.user.usuario}!`, "success")
    } else {
      addToast(
        snapshot.vencidoMotivo === "vencida"
          ? "Tu suscripción ha vencido"
          : "No tienes una suscripción activa",
        "error"
      )
    }
  }

  if (booting) return <FullScreenLoader label="Cargando sesión..." />

  return (
    <Suspense fallback={<FullScreenLoader label="Cargando..." />}>
      {!auth && <Login onLoginSuccess={handleLoginSuccess} />}
      {auth?.vista === "vencido" && (
        <Vencido
          motivo={auth.vencidoMotivo ?? "vencida"}
          onLogout={() => handleLogout()}
        />
      )}
      {auth?.vista === "portal" && (
        <Portal
          usuario={auth.user.usuario}
          fechaVencimiento={
            auth.suscripcion ? formatDate(auth.suscripcion.fecha_vencimiento) : "—"
          }
          planType={auth.suscripcion ? "PREMIUM" : "GRATIS"}
          onLogout={() => handleLogout()}
        />
      )}
      {auth?.vista === "admin" && (
        <Admin
          usuario={auth.user.usuario}
          usuarioId={auth.user.id}
          onLogout={() => handleLogout()}
        />
      )}
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ToastProvider>
          <TooltipProvider>
            <Router />
          </TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
