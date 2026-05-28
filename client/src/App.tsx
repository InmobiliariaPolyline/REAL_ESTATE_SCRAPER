import { useState, useEffect } from 'react'
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import ErrorBoundary from "./components/ErrorBoundary"
import { ThemeProvider } from "./contexts/ThemeContext"
import Login from './pages/Login'
import Vencido from './pages/Vencido'
import Portal from './pages/Portal'
import Admin from './pages/Admin'
import { useToast, ToastProvider } from './contexts/ToastContext'
import { supabase } from './lib/supabase'

interface AppState {
  vista: 'login' | 'admin' | 'portal' | 'vencido'
  usuario: any | null
  suscripcion: { fecha_vencimiento: string } | null
}

function Router() {
  const [state, setState] = useState<AppState>({ vista: 'login', usuario: null, suscripcion: null })
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('inmoda_session')
      if (savedSession) {
        const sessionData = JSON.parse(savedSession)
        if (sessionData && sessionData.usuario && sessionData.vista) {
          setState({
            vista: sessionData.vista,
            usuario: sessionData.usuario,
            suscripcion: sessionData.suscripcion || null
          })
        }
      }
    } catch (err) {
      console.error('Error al restaurar la sesión:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLoginSuccess = async (usuarioData: any) => {
    try {
      if (usuarioData.rol === 'admin') {
        // Admin va directo al panel
        const adminState: AppState = { vista: 'admin', usuario: usuarioData, suscripcion: null }
        setState(adminState)
        localStorage.setItem('inmoda_session', JSON.stringify({
          usuario: usuarioData,
          suscripcion: null,
          vista: 'admin'
        }))
        addToast('¡Bienvenido, administrador!', 'success')
      } else if (usuarioData.rol === 'usuario') {
        // Verificar suscripción
        const hoy = new Date().toISOString().split('T')[0]
        const { data: sub, error } = await supabase
          .from('suscripciones')
          .select('fecha_vencimiento, fecha_limite_eliminacion')
          .eq('usuario_id', usuarioData.id)
          .gte('fecha_limite_eliminacion', hoy)
          .single()

        if (!sub || error) {
          // Suscripción vencida o inexistente
          const vencidoState: AppState = { vista: 'vencido', usuario: usuarioData, suscripcion: null }
          setState(vencidoState)
          localStorage.setItem('inmoda_session', JSON.stringify({
            usuario: usuarioData,
            suscripcion: null,
            vista: 'vencido'
          }))
          addToast('Tu suscripción ha vencido', 'error')
        } else {
          // Suscripción activa
          const portalState: AppState = { vista: 'portal', usuario: usuarioData, suscripcion: sub }
          setState(portalState)
          localStorage.setItem('inmoda_session', JSON.stringify({
            usuario: usuarioData,
            suscripcion: sub,
            vista: 'portal'
          }))
          addToast(`¡Bienvenido, ${usuarioData.usuario}!`, 'success')
        }
      }
    } catch (err) {
      addToast('Error al verificar suscripción', 'error')
      console.error(err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('inmoda_session')
    setState({ vista: 'login', usuario: null, suscripcion: null })
    addToast('Sesión cerrada', 'info')
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen bg-black items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#C9A96E]"></div>
          <span className="text-sm font-medium tracking-wider text-[#F0EDE8]/60 uppercase" style={{ fontFamily: 'DM Sans' }}>
            Cargando sesión...
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {state.vista === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}
      {state.vista === 'vencido' && <Vencido onLogout={handleLogout} />}
      {state.vista === 'portal' && state.usuario && (
        <Portal
          usuario={state.usuario.usuario}
          usuarioId={state.usuario.id}
          fechaVencimiento={state.suscripcion?.fecha_vencimiento ?? '—'}
          planType="PREMIUM"
          onLogout={handleLogout}
        />
      )}
      {state.vista === 'admin' && state.usuario && (
        <Admin
          usuario={state.usuario.usuario}
          usuarioId={state.usuario.id}
          onLogout={handleLogout}
        />
      )}
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ToastProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
