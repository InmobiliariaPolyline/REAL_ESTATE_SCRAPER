import {
  ArrowDownRight, ArrowUpRight, Bath, BedDouble, Building2, CalendarClock, Calculator, Car, Check, ChevronDown, Clock,
  Copy, ExternalLink, Eye, FileText, Gauge, Hammer, HandCoins, Hash, Heart, History, Home, KeyRound, Landmark, Layers,
  Link2, Loader2, Map, MapPin, MessageCircle, Minus, Percent, PiggyBank, Receipt, Ruler, Scale, Share2, ShieldCheck,
  Sparkles, Target, TrendingDown, TrendingUp, UserRound, Users, Wallet, X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ImageGallery from '@/components/common/ImageGallery'
import EnlacesPropiedad from '@/components/properties/EnlacesPropiedad'
import { useToast } from '@/contexts/ToastContext'
import { USD_TO_PEN_RATE } from '@/lib/config'
import { formatDate } from '@/lib/dates'
import { fetchPropertyDetail, type PropertyDetail } from '@/lib/propertiesApi'
import { getOperacionColor, getPortalColor } from '@/lib/portals'
import { currencyLabel, formatDisplayPrice, getDisplayPrice, type Currency } from '@/lib/prices'
import {
  HIPOTECA, MESES_GARANTIA, antiguedadTexto, baniosN, categoriaTamano, diasDesde, dormitoriosN, financiamiento, mapaUrl,
  posicionEnRango, posicionEnZona, precioPorM2, preciosDelAviso, resumenDelAviso, variacionDePrecio, whatsappUrl,
} from '@/lib/propertyInsights'
import { safeHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { trapFocus } from '@/lib/focusTrap'
import type { Propiedad } from '@/types'
import { BarraRango, Dato, Icono3D, Seccion } from './detail/Piezas'

const GOLD = 'var(--gold)'
const fmt = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 })
const shortDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
}
const NA = '—'
/** Diferencia relativa como porcentaje con signo; «0 %» en vez de «-0 %». */
const pct = (ratio: number) => {
  const n = Math.round(ratio * 100)
  return `${n > 0 ? '+' : ''}${n === 0 ? 0 : n} %`
}

interface PropertyDetailModalProps {
  propertyId: string
  moneda: Currency
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  isCompared: boolean
  compareDisabled: boolean
  /** Sin esta función no se ofrece comparar (p. ej. en el panel de administración). */
  onToggleCompare?: (propiedad: Propiedad) => void
  /** Abre otro aviso (los parecidos de la zona). */
  onOpenProperty?: (id: string) => void
  onClose: () => void
}

/** Detalle de un aviso: fotos, precio, características, financiamiento, mercado de la zona e historial. */
export default function PropertyDetailModal({
  propertyId,
  moneda,
  isFavorite,
  onToggleFavorite,
  isCompared,
  compareDisabled,
  onToggleCompare,
  onOpenProperty,
  onClose,
}: PropertyDetailModalProps) {
  const [detail, setDetail] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLinks, setShowLinks] = useState(false)
  const [mon, setMon] = useState<Currency>(moneda)
  const [descripcionAbierta, setDescripcionAbierta] = useState(false)
  const [copiado, setCopiado] = useState<'enlace' | 'resumen' | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDescripcionAbierta(false)
    fetchPropertyDetail(propertyId)
      .then(d => !cancelled && setDetail(d))
      .catch(err => {
        console.error(err)
        if (!cancelled) {
          addToast('No se pudo cargar el detalle de la propiedad', 'error')
          onClose()
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [propertyId, addToast, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showLinks) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showLinks])

  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previo
    }
  }, [])

  const p = detail?.propiedad
  const mercado = detail?.mercado ?? null
  const factor = mon === 'USD' ? 1 : USD_TO_PEN_RATE
  const sym = currencyLabel(mon)
  const money = useCallback((n: number | null | undefined) => (n && n > 0 ? `${sym} ${fmt(n)}` : NA), [sym])

  const price = p ? getDisplayPrice(p.precio, p.precio_usd, mon) : null
  const precios = useMemo(() => (p ? preciosDelAviso(p) : null), [p])
  const enMoneda = mon === 'USD' ? precios?.usd ?? 0 : precios?.pen ?? 0
  const otra = mon === 'USD' ? precios?.pen ?? 0 : precios?.usd ?? 0
  const m2 = useMemo(() => (p ? precioPorM2(p) : null), [p])
  const m2Moneda = mon === 'USD' ? m2?.usd : m2?.pen
  const m2Otra = mon === 'USD' ? m2?.pen : m2?.usd

  const esVenta = p?.operacion?.toUpperCase() === 'VENTA'
  const posicion = useMemo(() => posicionEnZona(precios?.usd ?? 0, mercado), [precios, mercado])
  const enRango = posicionEnRango(precios?.usd ?? 0, mercado?.min_usd ?? null, mercado?.max_usd ?? null)
  const fin = esVenta ? financiamiento(enMoneda) : null
  const dorm = p ? dormitoriosN(p) : null
  const banos = p ? baniosN(p) : null
  const mantenimiento = typeof p?.mantenimiento === 'number' ? p.mantenimiento : null
  const mantenimientoMon =
    mantenimiento && p
      ? p.moneda === 'USD'
        ? mantenimiento * (mon === 'USD' ? 1 : USD_TO_PEN_RATE)
        : mantenimiento / (mon === 'USD' ? USD_TO_PEN_RATE : 1)
      : null

  // Serie de precios en la moneda elegida (con conversión si el aviso solo tiene la otra).
  const series = useMemo(
    () => (detail?.historial ?? []).map(h => ({ fecha: h.registrado_en, precio: getDisplayPrice(h.precio, h.precio_usd, mon).amount })),
    [detail, mon]
  )
  const variacion = useMemo(() => variacionDePrecio(series.map(s => s.precio)), [series])
  const hasHistory = series.length >= 2

  const diasCreado = diasDesde(p?.creado_en)
  const diasVisto = diasDesde(p?.ultima_vista_en)
  const url = safeHttpUrl(p?.url)
  const fotos = p ? (p.imagenes && p.imagenes.length > 0 ? p.imagenes : [p.imagen]) : []
  const nFotos = fotos.filter(Boolean).length
  const mapa = p ? mapaUrl(p) : null
  const precioTexto = price ? formatDisplayPrice(price) : ''

  const copiar = async (que: 'enlace' | 'resumen') => {
    if (!p) return
    const texto = que === 'enlace' ? (url ?? '') : resumenDelAviso(p, precioTexto)
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(que)
      setTimeout(() => setCopiado(null), 1800)
      addToast(que === 'enlace' ? 'Enlace copiado' : 'Resumen copiado', 'success')
    } catch {
      addToast('No se pudo copiar', 'error')
    }
  }

  // Se dibuja directamente en <body>: dentro de la página, un ancestro con transformación o animación
  // haría que `fixed` se midiera contra él y la vista previa quedara fuera de la pantalla.
  return createPortal(
    <>
      <div
        className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-5"
        role="presentation"
        onClick={onClose}
      >
        <div
          ref={trapFocus}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de la propiedad"
          className="animate-popIn card flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 sm:px-6">
            <p className="eyebrow">Detalle de la propiedad</p>
            <div className="flex items-center gap-2">
              {p && (
                <div className="segmented !w-auto" role="group" aria-label="Moneda de los montos">
                  {(['PEN', 'USD'] as const).map(m => (
                    <button key={m} type="button" aria-pressed={mon === m} onClick={() => setMon(m)} className="segmented-option !px-3">
                      {m === 'PEN' ? 'Soles' : 'Dólares'}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
          </div>

          {loading || !p || !price ? (
            <div className="flex items-center justify-center gap-2 p-20 text-text-muted">
              <Loader2 className="size-5 animate-spin" />
              Cargando...
            </div>
          ) : (
            <div className="overflow-y-auto">
              {/* ── Portada: fotos + resumen ─────────────────────────────── */}
              <div className="grid gap-0 lg:grid-cols-[1.3fr_1fr]">
                <ImageGallery images={fotos} alt={p.titulo} className="lg:min-h-[30rem]">
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium capitalize text-white backdrop-blur-md">
                    <span className="dot" style={{ color: getPortalColor(p.portal) }} />
                    {p.portal}
                  </span>
                  <span
                    className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[#10131a]"
                    style={{ backgroundColor: getOperacionColor(p.operacion) }}
                  >
                    {p.operacion}
                  </span>
                </ImageGallery>

                <div className="flex flex-col gap-5 p-5 sm:p-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-muted"><Home className="size-3.5" />{p.inmueble || 'Inmueble'}</span>
                    <span className="badge badge-muted"><Hash className="size-3.5" />{p.id.split(':').slice(1).join(':') || p.id}</span>
                    <span className="badge badge-blue"><Clock className="size-3.5" />Publicado {antiguedadTexto(diasCreado)}</span>
                    {nFotos > 1 && <span className="badge badge-gold"><Layers className="size-3.5" />{nFotos} fotos</span>}
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold leading-snug text-text [text-wrap:balance]">{p.titulo}</h2>
                    {p.distrito && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
                        <MapPin className="size-4 text-gold" strokeWidth={1.75} />
                        {p.distrito}
                      </p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-line bg-surface-3/50 p-4">
                    <p className="mono text-gradient-gold text-[2.1rem] font-semibold leading-none tracking-tight">{formatDisplayPrice(price)}</p>
                    <p className="mt-2 text-sm text-text-muted">
                      {otra > 0 ? `≈ ${currencyLabel(mon === 'USD' ? 'PEN' : 'USD')} ${fmt(otra)}` : 'Sin precio publicado'}
                      {price.approximate && ' · conversión aproximada'}
                    </p>
                    {posicion && (
                      <p
                        className={cn(
                          'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                          posicion.nivel === 'bajo' ? 'bg-green/10 text-green' : posicion.nivel === 'alto' ? 'bg-rose/10 text-rose' : 'bg-blue/10 text-blue'
                        )}
                      >
                        {posicion.nivel === 'bajo' ? <TrendingDown className="size-3.5" /> : posicion.nivel === 'alto' ? <TrendingUp className="size-3.5" /> : <Minus className="size-3.5" />}
                        {posicion.nivel === 'bajo' ? 'Por debajo' : posicion.nivel === 'alto' ? 'Por encima' : 'En línea con'} la mediana de {p.distrito}
                        {' '}({posicion.difPct > 0 ? '+' : ''}{posicion.difPct.toFixed(0)} %)
                      </p>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-3">
                    <Dato icon={BedDouble} tono="violet" label="Dormitorios" value={p.dormitorios || NA} />
                    <Dato icon={Bath} tono="blue" label="Baños" value={p.banios || NA} />
                    <Dato icon={Ruler} tono="green" label="Área" value={p.area || NA} hint={categoriaTamano(m2?.m2 ?? null) ? `Tamaño ${categoriaTamano(m2?.m2 ?? null)}` : undefined} />
                    <Dato icon={Car} tono="amber" label="Cocheras" value={p.estacionamientos || NA} />
                    <Dato icon={Hammer} tono="rose" label="Antigüedad" value={p.antiguedad || NA} />
                    <Dato icon={Building2} tono="gold" label="Tipo" value={p.inmueble || NA} />
                  </dl>
                </div>
              </div>

              <div className="space-y-6 border-t border-line p-5 sm:p-6">
                {/* ── Acciones ───────────────────────────────────────────── */}
                <div className="flex flex-wrap gap-2.5">
                  <a
                    href={url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!url}
                    className={cn('btn btn-primary', !url && 'pointer-events-none opacity-50')}
                  >
                    <ExternalLink className="size-4" />
                    Ver aviso original
                  </a>
                  <button onClick={() => copiar('enlace')} disabled={!url} className="btn btn-secondary">
                    {copiado === 'enlace' ? <Check className="size-4 text-green" /> : <Copy className="size-4" />}
                    Copiar enlace
                  </button>
                  <a href={whatsappUrl(resumenDelAviso(p, precioTexto))} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                    <MessageCircle className="size-4" />
                    Compartir
                  </a>
                  <button onClick={() => copiar('resumen')} className="btn btn-secondary">
                    {copiado === 'resumen' ? <Check className="size-4 text-green" /> : <Share2 className="size-4" />}
                    Copiar resumen
                  </button>
                  {mapa && (
                    <a href={mapa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                      <Map className="size-4" />
                      Ver en el mapa
                    </a>
                  )}
                  <button onClick={() => setShowLinks(true)} className="btn btn-secondary">
                    <Link2 className="size-4" />
                    Enlaces de apoyo
                  </button>
                  <button onClick={() => onToggleFavorite(p.id)} aria-pressed={isFavorite} className="btn btn-secondary">
                    <Heart className={cn('size-4', isFavorite && 'fill-rose text-rose')} />
                    {isFavorite ? 'En favoritos' : 'Favorito'}
                  </button>
                  {onToggleCompare && (
                    <button
                      onClick={() => onToggleCompare(p)}
                      disabled={compareDisabled && !isCompared}
                      aria-pressed={isCompared}
                      className={cn('btn', isCompared ? 'btn-primary' : 'btn-secondary')}
                    >
                      <Scale className="size-4" />
                      {isCompared ? 'Quitar de la comparación' : 'Comparar'}
                    </button>
                  )}
                </div>

                {/* ── Precio, financiamiento y mercado ───────────────────── */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Seccion
                    icon={esVenta ? Landmark : KeyRound}
                    tono="green"
                    title={esVenta ? 'Financiamiento de referencia' : 'Costos del alquiler'}
                    subtitle={
                      esVenta
                        ? `${HIPOTECA.inicialPct} % de inicial, ${HIPOTECA.anios} años, ${HIPOTECA.tasaAnualPct} % anual`
                        : `Estimación con ${MESES_GARANTIA} meses de garantía`
                    }
                  >
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <Dato icon={Wallet} tono="gold" label="Precio por m²" value={money(m2Moneda)} hint={m2Otra ? `≈ ${currencyLabel(mon === 'USD' ? 'PEN' : 'USD')} ${fmt(m2Otra)}` : undefined} />
                      {fin ? (
                        <>
                          <Dato icon={Calculator} tono="green" label="Cuota mensual" value={money(fin.cuota)} hint="Capital más intereses" />
                          <Dato icon={PiggyBank} tono="amber" label="Inicial" value={money(fin.inicial)} hint={`${HIPOTECA.inicialPct} % del precio`} />
                          <Dato icon={Landmark} tono="blue" label="Préstamo" value={money(fin.prestamo)} />
                          <Dato icon={HandCoins} tono="violet" label="Ingreso sugerido" value={money(fin.ingresoSugerido)} hint={`La cuota no pasa del ${HIPOTECA.ingresoCuotaPct} %`} />
                          <Dato icon={Percent} tono="rose" label="Intereses totales" value={money(fin.totalIntereses)} />
                        </>
                      ) : (
                        <>
                          <Dato icon={CalendarClock} tono="green" label="Alquiler anual" value={money(enMoneda * 12)} hint="12 meses" />
                          <Dato icon={ShieldCheck} tono="amber" label="Garantía" value={money(enMoneda * MESES_GARANTIA)} hint={`${MESES_GARANTIA} meses por adelantado`} />
                          <Dato icon={Receipt} tono="violet" label="Primer pago" value={money(enMoneda * (MESES_GARANTIA + 1))} hint="Garantía más el primer mes" />
                          <Dato icon={HandCoins} tono="blue" label="Ingreso sugerido" value={money(enMoneda / 0.3)} hint="El alquiler no pasa del 30 %" />
                        </>
                      )}
                      {mantenimientoMon && (
                        <Dato icon={Receipt} tono="rose" label="Mantenimiento" value={money(mantenimientoMon)} hint="Cuota mensual del edificio" />
                      )}
                      {mantenimientoMon && (fin || enMoneda > 0) && (
                        <Dato icon={Wallet} tono="gold" label="Costo mensual total" value={money((fin ? fin.cuota : enMoneda) + mantenimientoMon)} hint={fin ? 'Cuota más mantenimiento' : 'Alquiler más mantenimiento'} />
                      )}
                    </dl>
                  </Seccion>

                  <Seccion icon={Gauge} tono="blue" title={`Mercado en ${p.distrito || 'la zona'}`} subtitle={mercado ? `${mercado.avisos} avisos de ${p.operacion.toLowerCase()} con precio` : 'Aún no hay avisos para comparar'}>
                    {mercado && mercado.avisos >= 1 ? (
                      <div className="space-y-5">
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <Dato icon={Target} tono="blue" label="Mediana de la zona" value={money((mercado.mediana_usd ?? 0) * factor)} />
                          <Dato
                            icon={posicion && posicion.difPct < 0 ? TrendingDown : TrendingUp}
                            tono={posicion ? (posicion.nivel === 'bajo' ? 'green' : posicion.nivel === 'alto' ? 'rose' : 'blue') : 'blue'}
                            label="Frente a la mediana"
                            value={posicion ? `${posicion.difPct > 0 ? '+' : ''}${posicion.difPct.toFixed(1)} %` : NA}
                          />
                          <Dato icon={Ruler} tono="green" label="Mediana por m²" value={money((mercado.mediana_m2_usd ?? 0) * factor)} hint={m2Moneda && mercado.mediana_m2_usd ? `Este aviso: ${pct(m2Moneda / (mercado.mediana_m2_usd * factor) - 1)}` : undefined} />
                          <Dato icon={Users} tono="violet" label="Avisos comparados" value={fmt(mercado.avisos)} />
                          <Dato icon={Sparkles} tono="amber" label="Más barato que" value={posicion ? `${posicion.percentil} %` : NA} hint="De los avisos de la zona" />
                          <Dato icon={Layers} tono="gold" label="Rango de precios" value={`${money((mercado.min_usd ?? 0) * factor)} – ${money((mercado.max_usd ?? 0) * factor)}`} />
                        </dl>
                        <BarraRango
                          posicion={enRango}
                          min={money((mercado.min_usd ?? 0) * factor)}
                          mediana={money((mercado.mediana_usd ?? 0) * factor)}
                          max={money((mercado.max_usd ?? 0) * factor)}
                        />
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-text-muted">
                        Cuando haya más avisos en esta zona verás aquí cómo se compara el precio.
                      </p>
                    )}
                  </Seccion>
                </div>

                {/* ── Características, tiempo y ubicación ────────────────── */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <Seccion icon={Layers} tono="violet" title="Características">
                    <dl className="grid gap-3">
                      <Dato icon={BedDouble} tono="violet" label="Área por dormitorio" value={dorm && m2?.m2 ? `${(m2.m2 / dorm).toFixed(0)} m²` : NA} />
                      <Dato icon={Bath} tono="blue" label="Baños por dormitorio" value={dorm && banos ? (banos / dorm).toFixed(1) : NA} />
                      <Dato icon={Wallet} tono="gold" label="Precio por dormitorio" value={dorm && enMoneda ? money(enMoneda / dorm) : NA} />
                      <Dato icon={Ruler} tono="green" label="Tamaño" value={categoriaTamano(m2?.m2 ?? null) ?? NA} />
                    </dl>
                  </Seccion>

                  <Seccion icon={CalendarClock} tono="amber" title="Tiempo en el sistema">
                    <dl className="grid gap-3">
                      <Dato icon={CalendarClock} tono="amber" label="Publicado" value={antiguedadTexto(diasCreado)} hint={p.creado_en ? formatDate(p.creado_en) : undefined} />
                      <Dato icon={Eye} tono="blue" label="Visto por última vez" value={antiguedadTexto(diasVisto)} hint={p.ultima_vista_en ? formatDate(p.ultima_vista_en) : undefined} />
                      <Dato icon={Clock} tono="violet" label="Días en el sistema" value={diasCreado === null ? NA : fmt(diasCreado)} />
                      <Dato icon={History} tono="gold" label="Cambios de precio" value={variacion ? String(variacion.registros - 1) : '0'} />
                    </dl>
                  </Seccion>

                  <Seccion icon={MapPin} tono="rose" title="Ubicación y anunciante">
                    <dl className="grid gap-3">
                      <Dato icon={MapPin} tono="rose" label="Distrito" value={p.distrito || NA} />
                      <Dato icon={Home} tono="amber" label="Dirección" value={p.direccion || NA} />
                      <Dato icon={UserRound} tono="blue" label="Publica" value={p.publicador || NA} />
                      <Dato icon={Link2} tono="green" label="Portal de origen" value={<span className="capitalize">{p.portal}</span>} />
                    </dl>
                  </Seccion>
                </div>

                {/* ── Descripción ────────────────────────────────────────── */}
                {p.descripcion && (
                  <Seccion icon={FileText} tono="gold" title="Descripción del aviso">
                    <p className={cn('whitespace-pre-line text-sm leading-relaxed text-text-muted', !descripcionAbierta && 'line-clamp-5')}>{p.descripcion}</p>
                    {p.descripcion.length > 320 && (
                      <button type="button" onClick={() => setDescripcionAbierta(v => !v)} className="btn btn-ghost btn-sm mt-3">
                        <ChevronDown className={cn('size-4 transition', descripcionAbierta && 'rotate-180')} />
                        {descripcionAbierta ? 'Ver menos' : 'Ver más'}
                      </button>
                    )}
                  </Seccion>
                )}

                {/* ── Historial de precio ────────────────────────────────── */}
                <Seccion
                  icon={TrendingUp}
                  tono="gold"
                  title="Historial de precio"
                  subtitle={hasHistory ? `${series.length} registros, en ${sym}` : 'Aún no se han registrado cambios de precio'}
                >
                  {variacion && (
                    <span className={cn('badge mb-4', variacion.cambioPct < 0 ? 'badge-green' : variacion.cambioPct > 0 ? 'badge-rose' : 'badge-muted')}>
                      {variacion.cambioPct < 0 ? <ArrowDownRight className="size-3.5" /> : variacion.cambioPct > 0 ? <ArrowUpRight className="size-3.5" /> : <Minus className="size-3.5" />}
                      {variacion.cambioPct > 0 ? '+' : ''}
                      {variacion.cambioPct.toFixed(1)}% desde el primer registro
                    </span>
                  )}
                  {hasHistory ? (
                    <>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                            <defs>
                              <linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="var(--line)" vertical={false} />
                            <XAxis dataKey="fecha" tickFormatter={shortDate} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                            <YAxis domain={['dataMin', 'dataMax']} tickFormatter={v => fmt(Number(v))} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-faint)', fontSize: 11 }} width={64} />
                            <Tooltip
                              cursor={{ stroke: 'var(--line-strong)' }}
                              content={({ active, payload }) =>
                                active && payload?.length ? (
                                  <div className="rounded-xl border border-line-strong bg-surface-3 px-3 py-2 text-xs shadow-xl">
                                    <p className="text-text-muted">{new Date(String(payload[0].payload.fecha)).toLocaleDateString('es-PE')}</p>
                                    <p className="mono mt-0.5 text-sm font-semibold text-gold">{sym} {fmt(Number(payload[0].value))}</p>
                                  </div>
                                ) : null
                              }
                            />
                            <Area type="stepAfter" dataKey="precio" stroke={GOLD} strokeWidth={2} fill="url(#detailFill)" dot={{ r: 3, fill: GOLD, stroke: 'var(--app)', strokeWidth: 2 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      {variacion && (
                        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                          <Dato icon={Sparkles} tono="blue" label="Primer precio" value={money(variacion.primero)} />
                          <Dato icon={Target} tono="gold" label="Precio actual" value={money(enMoneda || variacion.ultimo)} />
                          <Dato icon={TrendingDown} tono="green" label="Mínimo" value={money(variacion.minimo)} />
                          <Dato icon={TrendingUp} tono="rose" label="Máximo" value={money(variacion.maximo)} />
                        </dl>
                      )}
                    </>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-text-muted">El gráfico aparecerá cuando el aviso cambie de precio.</p>
                  )}
                </Seccion>

                {/* ── Parecidos ──────────────────────────────────────────── */}
                {onOpenProperty && (detail?.similares?.length ?? 0) > 0 && (
                  <Seccion icon={Sparkles} tono="violet" title="Parecidos en la zona" subtitle="Misma operación y distrito, con un precio cercano">
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {detail!.similares!.map(s => {
                        const sp = getDisplayPrice(s.precio, s.precio_usd, mon)
                        const foto = safeHttpUrl(s.imagen)
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => onOpenProperty(s.id)}
                              className="card-interactive group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface-3/40 text-left"
                            >
                              <span className="relative block aspect-[16/10] overflow-hidden bg-surface-3">
                                {foto ? (
                                  <img src={foto} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                                ) : (
                                  <span className="flex size-full items-center justify-center"><Icono3D icon={Building2} tono="gold" size="sm" /></span>
                                )}
                              </span>
                              <span className="flex flex-col gap-1 p-3.5">
                                <span className="mono text-base font-semibold text-gold">{formatDisplayPrice(sp)}</span>
                                <span className="line-clamp-2 text-xs leading-snug text-text">{s.titulo}</span>
                                <span className="text-xs text-text-muted">{[s.dormitorios && `${s.dormitorios} dorm.`, s.area].filter(Boolean).join(' · ')}</span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </Seccion>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLinks && p && <EnlacesPropiedad propiedadId={p.id} onClose={() => setShowLinks(false)} />}
    </>,
    document.body
  )
}
