import { useState } from 'react'
import ConfirmModal from '@/components/common/ConfirmModal'
import Pagination from '@/components/properties/Pagination'
import PropertyCard from '@/components/properties/PropertyCard'
import BusquedasGuardadasList, {
  type BusquedaGuardada,
} from './propiedades/BusquedasGuardadasList'
import GuardarBusquedaModal from './propiedades/GuardarBusquedaModal'
import PropiedadesFilters from './propiedades/PropiedadesFilters'
import {
  ITEMS_PER_PAGE,
  useAdminPropiedades,
  type PropiedadesTab,
} from './propiedades/useAdminPropiedades'

interface AdminPropiedadesProps {
  adminId: number
}

const muted = { color: '#6B6B6B', fontFamily: 'DM Sans' } as const

export default function AdminPropiedades({ adminId }: AdminPropiedadesProps) {
  const p = useAdminPropiedades(adminId)

  const [propiedadAEliminar, setPropiedadAEliminar] = useState<string | null>(null)
  const [busquedaAEliminar, setBusquedaAEliminar] = useState<BusquedaGuardada | null>(null)
  const [showLimpieza, setShowLimpieza] = useState(false)
  const [showGuardar, setShowGuardar] = useState(false)
  const [busy, setBusy] = useState(false)

  const withBusy = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: PropiedadesTab; label: string }[] = [
    { id: 'buscar', label: '🔍 Buscar propiedades' },
    {
      id: 'favoritos',
      label: `❤️ Mis favoritos${p.favoritos.size > 0 ? ` (${p.favoritos.size})` : ''}`,
    },
    { id: 'historial', label: '🕐 Historial' },
    {
      id: 'guardadas',
      label: `🔖 Búsquedas guardadas${p.busquedas.length > 0 ? ` (${p.busquedas.length})` : ''}`,
    },
  ]

  const emptyMessage =
    p.tab === 'favoritos'
      ? 'Aún no marcaste ninguna propiedad como favorita'
      : p.tab === 'historial'
        ? 'Aún no has visto ninguna propiedad'
        : p.cantidadOcultas > 0
          ? 'Todas las propiedades de esta búsqueda ya las viste antes'
          : 'Sin propiedades para estos filtros'

  return (
    <div className="space-y-6">
      {/* Pestañas */}
      <div className="flex gap-2 border-b flex-wrap" style={{ borderColor: '#2A2A2A' }} role="tablist">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={p.tab === id}
            onClick={() => p.setTab(id)}
            className="px-4 py-2 text-sm font-medium transition"
            style={{
              color: p.tab === id ? '#C9A96E' : '#6B6B6B',
              borderBottom: p.tab === id ? '2px solid #C9A96E' : '2px solid transparent',
              fontFamily: 'DM Sans',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {p.tab === 'buscar' && (
        <>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <button
              onClick={() => setShowLimpieza(true)}
              className="px-4 py-2 rounded text-sm font-medium transition"
              style={{
                backgroundColor: '#450a0a',
                border: '1px solid #7f1d1d',
                color: '#fca5a5',
                fontFamily: 'DM Sans',
              }}
            >
              ⚠️ Ejecutar Limpieza de Inactivos
            </button>

            <button
              onClick={() => setShowGuardar(true)}
              className="px-4 py-2 rounded text-sm font-medium transition"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #C9A96E',
                color: '#C9A96E',
                fontFamily: 'DM Sans',
              }}
            >
              🔖 Guardar esta búsqueda
            </button>
          </div>

          <PropiedadesFilters
            filters={p.draft}
            onChange={p.setDraft}
            onSearch={p.buscar}
            onClear={p.limpiar}
          />

          {p.activeSavedSearch && (
            <div
              className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 rounded"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}
            >
              <span style={{ color: '#C9A96E', fontFamily: 'DM Sans', fontSize: '0.875rem' }}>
                🔖 Mostrando resultados de una búsqueda guardada
                {p.cantidadOcultas > 0 &&
                  !p.showHidden &&
                  ` — ${p.cantidadOcultas} ya vistas ocultas`}
              </span>

              {p.cantidadOcultas > 0 && (
                <button
                  onClick={() => p.setShowHidden(!p.showHidden)}
                  className="px-3 py-1 rounded text-xs font-medium"
                  style={{ border: '1px solid #C9A96E', color: '#C9A96E', fontFamily: 'DM Sans' }}
                >
                  {p.showHidden ? 'Ocultar ya vistas' : 'Mostrar ya vistas también'}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {p.tab === 'guardadas' ? (
        <BusquedasGuardadasList
          busquedas={p.busquedas}
          onExecute={p.ejecutarBusqueda}
          onDelete={setBusquedaAEliminar}
        />
      ) : (
        <>
          <div style={{ ...muted, fontSize: '0.875rem' }}>
            {!p.loading &&
              `Mostrando ${p.visibles.length} de ${p.totalCount} propiedades`}
          </div>

          {p.loading ? (
            <div className="text-center py-12" style={muted}>
              Cargando propiedades...
            </div>
          ) : p.visibles.length === 0 ? (
            <div className="text-center py-12" style={muted}>
              {emptyMessage}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {p.visibles.map((prop, idx) => (
                <PropertyCard
                  key={prop.id}
                  id={prop.id}
                  portal={prop.portal}
                  operacion={prop.operacion}
                  titulo={prop.titulo}
                  precio={prop.precio}
                  precioUsd={prop.precio_usd}
                  moneda={prop.moneda === 'PEN' ? 'PEN' : 'USD'}
                  distrito={prop.distrito}
                  dormitorios={prop.dormitorios}
                  banios={prop.banios}
                  area={prop.area}
                  imagen={prop.imagen}
                  url={prop.url}
                  index={idx}
                  isFavorite={p.favoritos.has(prop.id)}
                  onToggleFavorite={p.toggleFavorite}
                  onView={p.registerView}
                  onDelete={setPropiedadAEliminar}
                />
              ))}
            </div>
          )}

          {p.tab === 'buscar' && !p.loading && p.propiedades.length > 0 && (
            <Pagination
              currentPage={p.page}
              totalPages={Math.ceil(p.totalCount / ITEMS_PER_PAGE)}
              onPageChange={p.cambiarPagina}
              totalItems={p.totalCount}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
        </>
      )}

      {propiedadAEliminar && (
        <ConfirmModal
          title="¿Confirmas eliminar esta propiedad?"
          confirmLabel="Eliminar"
          busyLabel="Eliminando..."
          tone="danger"
          busy={busy}
          onCancel={() => setPropiedadAEliminar(null)}
          onConfirm={() =>
            withBusy(async () => {
              if (await p.deletePropiedad(propiedadAEliminar)) setPropiedadAEliminar(null)
            })
          }
        >
          Se eliminará de la base de datos de forma permanente.
        </ConfirmModal>
      )}

      {showLimpieza && (
        <ConfirmModal
          title="¿Confirmas eliminar todos los registros inactivos?"
          tone="danger"
          busy={busy}
          onCancel={() => setShowLimpieza(false)}
          onConfirm={() =>
            withBusy(async () => {
              await p.runCleanup()
              setShowLimpieza(false)
            })
          }
        />
      )}

      {showGuardar && (
        <GuardarBusquedaModal
          busy={busy}
          onCancel={() => setShowGuardar(false)}
          onSave={nombre =>
            withBusy(async () => {
              if (await p.guardarBusqueda(nombre)) setShowGuardar(false)
            })
          }
        />
      )}

      {busquedaAEliminar && (
        <ConfirmModal
          title="¿Confirmas eliminar esta búsqueda guardada?"
          confirmLabel="Eliminar"
          busyLabel="Eliminando..."
          tone="danger"
          busy={busy}
          onCancel={() => setBusquedaAEliminar(null)}
          onConfirm={() =>
            withBusy(async () => {
              if (await p.eliminarBusqueda(busquedaAEliminar.id)) setBusquedaAEliminar(null)
            })
          }
        >
          {busquedaAEliminar.nombre}
        </ConfirmModal>
      )}
    </div>
  )
}
