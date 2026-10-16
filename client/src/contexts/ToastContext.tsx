import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Toast, type ToastMessage } from "../components/common/Toast"

type ToastType = "success" | "error" | "info"

interface ToastContextType {
  toasts: ToastMessage[]
  addToast: (mensaje: string, tipo?: ToastType) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const TOAST_DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const counter = useRef(0)

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Identidad estable: se puede usar en dependencias de useEffect/useCallback sin re-disparos.
  const addToast = useCallback(
    (mensaje: string, tipo: ToastType = "info") => {
      counter.current += 1
      const id = `toast-${counter.current}`
      setToasts(prev => [...prev, { id, mensaje, tipo }])
      setTimeout(() => removeToast(id), TOAST_DURATION_MS)
    },
    [removeToast]
  )

  const value = useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
