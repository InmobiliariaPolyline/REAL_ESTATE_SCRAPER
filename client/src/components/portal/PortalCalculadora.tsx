import { Calculator, PiggyBank, Percent, Wallet } from "lucide-react"
import { useMemo, useState } from "react"
import { analizar } from "@/lib/finance"
import { cn } from "@/lib/utils"

type Moneda = "PEN" | "USD"

const SIMBOLO: Record<Moneda, string> = { PEN: "S/", USD: "USD" }

/** Campo numérico: guarda el texto escrito y lo convierte al calcular. */
function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className={cn("field mono", suffix && "pr-12")}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-text-faint">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

const num = (s: string) => {
  const n = Number(s.replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

/** Calculadora de hipoteca y rentabilidad por alquiler. */
export default function PortalCalculadora() {
  const [moneda, setMoneda] = useState<Moneda>("USD")
  const [precio, setPrecio] = useState("150000")
  const [inicial, setInicial] = useState("20")
  const [tasa, setTasa] = useState("9")
  const [anios, setAnios] = useState("20")
  const [alquiler, setAlquiler] = useState("800")
  const [gastos, setGastos] = useState("100")

  const r = useMemo(
    () =>
      analizar({
        precio: num(precio),
        inicialPct: num(inicial),
        tasaAnualPct: num(tasa),
        anios: num(anios),
        alquilerMensual: num(alquiler),
        gastosMensuales: num(gastos),
      }),
    [precio, inicial, tasa, anios, alquiler, gastos]
  )

  const money = (n: number) => `${SIMBOLO[moneda]} ${Math.round(n).toLocaleString("es-PE")}`
  const pct = (n: number) => `${n.toLocaleString("es-PE", { maximumFractionDigits: 2 })} %`
  const flujoPositivo = r.flujoMensual >= 0

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="card p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <Calculator className="size-4 text-gold" aria-hidden="true" />
            Datos de la compra
          </h2>
          <div className="segmented" role="group" aria-label="Moneda">
            {(["USD", "PEN"] as const).map(m => (
              <button
                key={m}
                className="segmented-option !px-4"
                aria-pressed={moneda === m}
                onClick={() => setMoneda(m)}
              >
                {m === "USD" ? "Dólares" : "Soles"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="calc-precio" label={`Precio (${SIMBOLO[moneda]})`} value={precio} onChange={setPrecio} />
          <NumberField id="calc-inicial" label="Cuota inicial" value={inicial} onChange={setInicial} suffix="%" />
          <NumberField id="calc-tasa" label="Tasa anual" value={tasa} onChange={setTasa} suffix="%" hint="La tasa efectiva anual que te ofrezca el banco." />
          <NumberField id="calc-anios" label="Plazo" value={anios} onChange={setAnios} suffix="años" />
          <NumberField id="calc-alquiler" label={`Alquiler mensual (${SIMBOLO[moneda]})`} value={alquiler} onChange={setAlquiler} hint="Si lo pones en renta." />
          <NumberField id="calc-gastos" label={`Gastos mensuales (${SIMBOLO[moneda]})`} value={gastos} onChange={setGastos} hint="Mantenimiento, arbitrios, seguro." />
        </div>
        <p className="mt-5 text-xs text-text-faint">
          Es una estimación orientativa: no incluye comisiones, seguros del préstamo ni impuestos.
        </p>
      </section>

      <div className="space-y-6">
        <section className="card p-6" aria-live="polite">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <Wallet className="size-4 text-blue" aria-hidden="true" />
            Hipoteca
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface-3 p-4">
              <dt className="text-xs text-text-muted">Cuota mensual</dt>
              <dd className="mono mt-1 text-2xl font-semibold text-gold">{money(r.cuota)}</dd>
            </div>
            <div className="rounded-2xl bg-surface-3 p-4">
              <dt className="text-xs text-text-muted">Cuota inicial</dt>
              <dd className="mono mt-1 text-2xl font-semibold text-text">{money(r.inicial)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Préstamo</dt>
              <dd className="mono mt-1 text-base font-semibold text-text">{money(r.prestamo)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Intereses totales</dt>
              <dd className="mono mt-1 text-base font-semibold text-text">{money(r.totalIntereses)}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-6" aria-live="polite">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <PiggyBank className="size-4 text-green" aria-hidden="true" />
            Rentabilidad por alquiler
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface-3 p-4">
              <dt className="flex items-center gap-1 text-xs text-text-muted">
                <Percent className="size-3" aria-hidden="true" /> Bruta anual
              </dt>
              <dd className="mono mt-1 text-2xl font-semibold text-text">{pct(r.rentabilidadBruta)}</dd>
            </div>
            <div className="rounded-2xl bg-surface-3 p-4">
              <dt className="flex items-center gap-1 text-xs text-text-muted">
                <Percent className="size-3" aria-hidden="true" /> Neta anual
              </dt>
              <dd className="mono mt-1 text-2xl font-semibold text-green">{pct(r.rentabilidadNeta)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Años para recuperar la inversión</dt>
              <dd className="mono mt-1 text-base font-semibold text-text">
                {r.aniosRecuperacion === null
                  ? "—"
                  : `${r.aniosRecuperacion.toLocaleString("es-PE", { maximumFractionDigits: 1 })} años`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Flujo mensual (alquiler − gastos − cuota)</dt>
              <dd className={cn("mono mt-1 text-base font-semibold", flujoPositivo ? "text-green" : "text-rose")}>
                {flujoPositivo ? "+" : "−"}
                {money(Math.abs(r.flujoMensual))}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
