import { Loader2, RefreshCw, ScrollText, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Avatar from '@/components/common/Avatar'
import EmptyState from '@/components/common/EmptyState'
import Pagination from '@/components/properties/Pagination'
import { useToast } from '@/contexts/ToastContext'
import { AUDIT_LABELS, fetchAudit, type AuditEntry } from '@/lib/account'
import { formatDateTime } from '@/lib/dates'

const PAGE_SIZE = 25

/** Resumen corto del `detalle` de un registro (sin mostrar JSON crudo). */
function summarize(entry: AuditEntry): string {
  const d = entry.detalle
  if (!d) return ''
  const parts: string[] = []
  if (typeof d.estado === 'string') parts.push(`estado: ${d.estado}`)
  if (typeof d.rol === 'string') parts.push(`rol: ${d.rol}`)
  if (d.premium === true) parts.push('con Premium')
  if (typeof d.dias === 'number') parts.push(`${d.dias} días`)
  if (typeof d.eliminadas === 'number') parts.push(`${d.eliminadas} eliminados`)
  if (typeof d.protegidas === 'number') parts.push(`${d.protegidas} protegidos`)
  if (typeof d.cerradas === 'number') parts.push(`${d.cerradas} sesiones`)
  return parts.join(' · ')
}

export default function AdminAuditoria() {
  const [rows, setRows] = useState<AuditEntry[]>([])
  const [count, setCount] = useState(0)
  const [acciones, setAcciones] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [accion, setAccion] = useState('')
  const [usuario, setUsuario] = useState('')
  const [appliedUser, setAppliedUser] = useState('')
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()
  const requestId = useRef(0)

  const load = useCallback(
    async (targetPage: number, accionFilter: string, userFilter: string) => {
      const current = ++requestId.current
      setLoading(true)
      try {
        const res = await fetchAudit({
          page: targetPage,
          pageSize: PAGE_SIZE,
          accion: accionFilter || undefined,
          usuario: userFilter || undefined,
        })
        if (current !== requestId.current) return
        setRows(res.data)
        setCount(res.count)
        setAcciones(res.acciones)
        setPage(targetPage)
      } catch (err) {
        if (current !== requestId.current) return
        console.error(err)
        addToast('No se pudo cargar la auditoría', 'error')
      } finally {
        if (current === requestId.current) setLoading(false)
      }
    },
    [addToast]
  )

  useEffect(() => {
    load(0, accion, appliedUser)
  }, [load, accion, appliedUser])

  return (
    <div className="space-y-6">
      <form
        onSubmit={e => {
          e.preventDefault()
          setAppliedUser(usuario.trim())
        }}
        className="card flex flex-col gap-3 p-4 md:flex-row"
        role="search"
        aria-label="Filtros de auditoría"
      >
        <div className="field-icon flex-1">
          <Search className="size-4" />
          <input
            value={usuario}
            onChange={e => setUsuario(e.target.value)}
            placeholder="Filtrar por usuario que realizó la acción..."
            className="field"
            aria-label="Usuario"
          />
        </div>
        <select
          value={accion}
          onChange={e => setAccion(e.target.value)}
          className="field md:w-72"
          aria-label="Acción"
        >
          <option value="">Todas las acciones</option>
          {acciones.map(a => (
            <option key={a} value={a}>
              {AUDIT_LABELS[a] ?? a}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">
          <Search className="size-4" />
          Buscar
        </button>
        <button
          type="button"
          onClick={() => load(page, accion, appliedUser)}
          disabled={loading}
          className="btn btn-secondary btn-icon"
          aria-label="Actualizar"
          title="Actualizar"
        >
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
        </button>
      </form>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-modern min-w-[760px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Realizó</th>
                <th>Acción</th>
                <th>Sobre</th>
                <th>Detalle</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando auditoría...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ScrollText}
                      title="Sin registros"
                      description="Las acciones administrativas aparecerán aquí."
                    />
                  </td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id}>
                    <td className="mono whitespace-nowrap text-xs text-text-muted">
                      {formatDateTime(r.creado_en)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.usuario} size="sm" />
                        <span className="font-medium text-text">{r.usuario}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gold">{AUDIT_LABELS[r.accion] ?? r.accion}</span>
                    </td>
                    <td className="text-text">{r.objetivo ?? <span className="text-text-faint">—</span>}</td>
                    <td className="text-text-muted">{summarize(r) || <span className="text-text-faint">—</span>}</td>
                    <td className="mono text-xs text-text-muted">{r.ip ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!loading && count > PAGE_SIZE && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(count / PAGE_SIZE)}
          onPageChange={p => load(p, accion, appliedUser)}
          totalItems={count}
          itemsPerPage={PAGE_SIZE}
          noun="registros"
        />
      )}
    </div>
  )
}
