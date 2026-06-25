import { createClient } from '@supabase/supabase-js'

// ── Configuración (el usuario reemplaza estos valores) ──
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://TU_PROJECT.supabase.co"
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "TU_ANON_KEY"
const ADMIN_WHATSAPP = "519438102536" // sin + ni espacios

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export { ADMIN_WHATSAPP }
