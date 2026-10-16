import { MIN_PASSWORD_LENGTH } from "@shared/constants"
import { ApiError, api } from "./api"
import type { EstadoUsuario, Rol, Suscripcion } from "@/types"

export { MIN_PASSWORD_LENGTH }

export interface UsuarioRow {
  id: number
  usuario: string
  rol: string
  estado: string
  creado_en: string
  ultima_conexion: string | null
  /** Suscripción vigente (la de mayor vencimiento que no ha vencido). */
  suscripcionActiva: Suscripcion | null
}

export interface NewUsuarioInput {
  usuario: string
  password: string
  rol: Rol
  estado: EstadoUsuario
  premium: boolean
}

export const listUsuarios = () => api.get<UsuarioRow[]>("/admin/usuarios")

export async function createUsuario(input: NewUsuarioInput): Promise<void> {
  await api.post("/admin/usuarios", input)
}

export async function setUsuarioEstado(id: number, estado: EstadoUsuario): Promise<void> {
  await api.patch(`/admin/usuarios/${id}/estado`, { estado })
}

/** Activa o renueva Premium: extiende desde el vencimiento vigente (no pierde días). */
export async function activatePremium(usuarioId: number): Promise<void> {
  await api.post(`/admin/usuarios/${usuarioId}/premium`)
}

/** Mensaje legible para un error de la API (usa el mensaje del servidor cuando existe). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status !== 0 && err.message) return err.message
  return fallback
}
