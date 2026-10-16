import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  DEFAULT_PREFERENCES,
  applyPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
} from "@/lib/preferences"

interface PreferencesContextType {
  prefs: Preferences
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  reset: () => void
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences)

  useEffect(() => {
    applyPreferences(prefs)
    savePreferences(prefs)
  }, [prefs])

  const setPref = useCallback<PreferencesContextType["setPref"]>((key, value) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
  }, [])
  const reset = useCallback(() => setPrefs(DEFAULT_PREFERENCES), [])

  const value = useMemo(() => ({ prefs, setPref, reset }), [prefs, setPref, reset])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider")
  return ctx
}
