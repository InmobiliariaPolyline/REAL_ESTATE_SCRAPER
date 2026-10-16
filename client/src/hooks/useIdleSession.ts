import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, KEEPALIVE_MS } from "@/lib/config"
import { getLastActivity, setLastActivity } from "@/lib/sessionStore"

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const
/** No se escribe en el almacenamiento más de una vez por este intervalo. */
const PERSIST_EVERY_MS = 5_000

interface Options {
  /** Solo se vigila mientras hay sesión iniciada. */
  active: boolean
  /** Se llama una sola vez al agotarse el plazo de inactividad. */
  onExpire: () => void
  idleMs?: number
  warningMs?: number
  keepAliveMs?: number
}

export interface IdleSession {
  /** `true` durante la cuenta atrás previa al cierre. */
  warning: boolean
  secondsLeft: number
  /** El usuario confirma que sigue ahí. */
  stay: () => void
}

/**
 * Cierra la sesión por inactividad: avisa `warningMs` antes y mantiene viva la sesión del
 * servidor (que también caduca por inactividad) mientras el usuario esté activo.
 */
export function useIdleSession({
  active,
  onExpire,
  idleMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
  keepAliveMs = KEEPALIVE_MS,
}: Options): IdleSession {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000))

  const last = useRef(Date.now())
  const persisted = useRef(0)
  const warningRef = useRef(false)
  const expired = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const mark = useCallback(() => {
    const now = Date.now()
    last.current = now
    if (now - persisted.current >= PERSIST_EVERY_MS) {
      persisted.current = now
      setLastActivity(now)
    }
  }, [])

  const stay = useCallback(() => {
    warningRef.current = false
    setWarning(false)
    mark()
    // Renueva también el plazo del servidor.
    api.get("/session").catch(() => {})
  }, [mark])

  useEffect(() => {
    if (!active) {
      warningRef.current = false
      expired.current = false
      setWarning(false)
      return
    }

    expired.current = false
    // Se parte de la última actividad guardada (recargar la página no reinicia el plazo).
    last.current = getLastActivity() ?? Date.now()

    const onActivity = () => {
      // Con el aviso abierto solo cuenta pulsar «Seguir conectado».
      if (!warningRef.current) mark()
    }
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))

    const check = () => {
      if (expired.current) return
      const idle = Date.now() - last.current
      if (idle >= idleMs) {
        expired.current = true
        warningRef.current = false
        setWarning(false)
        onExpireRef.current()
      } else if (idle >= idleMs - warningMs) {
        warningRef.current = true
        setWarning(true)
        setSecondsLeft(Math.max(1, Math.ceil((idleMs - idle) / 1000)))
      }
    }

    // Los temporizadores se frenan con la pestaña oculta: se revisa al volver.
    const onVisible = () => {
      if (document.visibilityState === "visible") check()
    }
    document.addEventListener("visibilitychange", onVisible)
    const tick = setInterval(check, 1000)

    const keepAlive = setInterval(() => {
      const recentlyActive = Date.now() - last.current < keepAliveMs
      if (recentlyActive && !warningRef.current) api.get("/session").catch(() => {})
    }, keepAliveMs)

    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onActivity))
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(tick)
      clearInterval(keepAlive)
    }
  }, [active, idleMs, warningMs, keepAliveMs, mark])

  return { warning, secondsLeft, stay }
}
