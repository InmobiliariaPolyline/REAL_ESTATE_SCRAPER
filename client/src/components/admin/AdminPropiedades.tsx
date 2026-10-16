import { Bookmark, BookmarkPlus, Building2, Eye, EyeOff, Heart, History, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import ConfirmModal from '@/components/common/ConfirmModal'
import EmptyState from '@/components/common/EmptyState'
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

export default function AdminPropiedades() {
  const p = useAdminPropiedades()

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

  const tabs: { id: PropiedadesTab; label: string; icon: typeof Search; count?: number }[] = [
    { id: 'buscar', label: 'Buscar', icon: Search },
    { id: 'favoritos', label: 'Favoritos', icon: Heart, count: p.favoritos.size },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'guardadas', label: 'Búsquedas guardadas', icon: Bookmark, count: p.busquedas.length },
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
      <div className="segmented w-fit max-w-full overflow-x-auto" role="tablist">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            role="tab"
            aria-selected={p.tab === id}
            onClick={() => p.setTab(id)}
            className="segmented-option !flex-none !px-4"
          >
            <Icon className="size-4" />
            {label}
            {!!count && count > 0 && (
              <span className="mono rounded-full bg-black/20 px-1.5 py-0.5 text-[0.6875rem]">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {p.tab === 'buscar' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setShowLimpieza(true)} className="btn btn-danger btn-sm">
              <Trash2 className="size-4" />
              Limpieza de inactivos
            </button>

            <button onClick={() => setShowGuardar(true)} className="btn btn-outline btn-sm">
              <BookmarkPlus className="size-4" />
              Guardar búsqueda
            </button>
          </div>

          <PropiedadesFilters
            filters={p.draft}
            onChange={p.setDraft}
            onSearch={p.buscar}
            onClear={p.limpiar}
          />

          {p.activeSavedSearch && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold-soft px-5 py-3.5">
              <span className="flex items-center gap-2 text-sm text-gold">
                <Bookmark className="size-4" />
                Mostrando resultados de una búsqueda guardada
                {p.cantidadOcultas > 0 &&
                  !p.showHidden &&
                  ` — ${p.cantidadOcultas} ya vistas ocultas`}
              </span>

              {p.cantidadOcultas > 0 && (
                <button
                  onClick={() => p.setShowHidden(!p.showHidden)}
                  className="btn btn-outline btn-sm"
                >
                  {p.showHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
          <p className="text-sm text-text-muted" aria-live="polite">
            {!p.loading && (
              <>
                Mostrando <strong className="mono font-medium text-text">{p.visibles.length}</strong> de{' '}
                <strong className="mono font-medium text-text">{p.totalCount}</strong> propiedades
              </>
            )}
          </p>

          {p.loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="skeleton h-[26rem]" />
              ))}
            </div>
          ) : p.visibles.length === 0 ? (
            <div className="card">
              <EmptyState icon={Building2} title={emptyMessage} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
