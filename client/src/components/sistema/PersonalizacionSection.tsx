import { Check, Moon, Palette, RotateCcw, Ruler, Sparkles, Sun, Wind } from "lucide-react"
import { useState } from "react"
import Sparkline from "@/components/common/Sparkline"
import Switch from "@/components/common/Switch"
import { useTheme } from "@/contexts/ThemeContext"
import { usePreferences } from "@/contexts/PreferencesContext"
import { ACCENTS, SCALES, DEFAULT_PREFERENCES } from "@/lib/preferences"
import { cn } from "@/lib/utils"

const MUESTRA = [3, 5, 4, 7, 6, 9, 8, 12, 10, 14]

export default function PersonalizacionSection() {
  const { theme, toggleTheme } = useTheme()
  const { prefs, setPref, reset } = usePreferences()
  // Recuerda cuál muestra de color se acaba de elegir para animarla.
  const [pulsado, setPulsado] = useState<string | null>(null)

  const esDefault = JSON.stringify(prefs) === JSON.stringify(DEFAULT_PREFERENCES)

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Tema */}
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <Sun className="size-4 text-gold" aria-hidden="true" />
              Tema
            </h2>
            <p className="mb-4 mt-1 text-sm text-text-muted">Claro u oscuro. Se recuerda en este navegador.</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["light", "Claro", Sun],
                  ["dark", "Oscuro", Moon],
                ] as const
              ).map(([id, label, Icon]) => {
                const activo = theme === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => !activo && toggleTheme?.()}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-300",
                      activo ? "border-gold bg-gold-soft" : "border-line bg-surface-1 hover:border-line-strong hover:bg-surface-3"
                    )}
                  >
                    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface-3 text-gold">
                      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-text">{label}</span>
                    {activo && <Check className="size-4 text-gold" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Acento */}
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <Palette className="size-4 text-gold" aria-hidden="true" />
              Color de acento
            </h2>
            <p className="mb-4 mt-1 text-sm text-text-muted">Botones, enlaces activos, gráficos y detalles de la interfaz.</p>
            <div className="flex flex-wrap gap-3" role="group" aria-label="Color de acento">
              {ACCENTS.map(a => {
                const activo = prefs.accent === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={activo}
                    aria-label={a.label}
                    title={a.label}
                    onClick={() => {
                      setPref("accent", a.id)
                      setPulsado(a.id)
                    }}
                    className={cn(
                      "relative inline-flex size-12 items-center justify-center rounded-2xl ring-2 ring-offset-2 ring-offset-surface-2 transition-all duration-300 hover:scale-110",
                      activo ? "ring-text" : "ring-transparent"
                    )}
                    style={{ background: a.swatch }}
                  >
                    {activo && (
                      <Check
                        key={pulsado === a.id ? "pop" : "idle"}
                        className={cn("size-5 text-black/70", pulsado === a.id && "animate-swatch")}
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Tamaño */}
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <Ruler className="size-4 text-gold" aria-hidden="true" />
              Tamaño de la interfaz
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3" role="group" aria-label="Tamaño de la interfaz">
              {SCALES.map(s => {
                const activo = prefs.scale === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setPref("scale", s.id)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all duration-300",
                      activo ? "border-gold bg-gold-soft" : "border-line bg-surface-1 hover:border-line-strong hover:bg-surface-3"
                    )}
                  >
                    <span className="block text-sm font-medium text-text">{s.label}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">{s.hint}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Movimiento */}
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <Sparkles className="size-4 text-gold" aria-hidden="true" />
              Movimiento
            </h2>
            <ul className="mt-4 divide-y divide-line">
              <li className="flex items-center gap-4 py-3.5">
                <Wind className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">Reducir animaciones</p>
                  <p className="text-xs text-text-muted">Desactiva transiciones y efectos. Útil si te marean o para ahorrar batería.</p>
                </div>
                <Switch
                  label="Reducir animaciones"
                  checked={prefs.motion === "reduced"}
                  onChange={v => setPref("motion", v ? "reduced" : "auto")}
                />
              </li>
              <li className="flex items-center gap-4 py-3.5">
                <Sparkles className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">Luz ambiental</p>
                  <p className="text-xs text-text-muted">El resplandor suave que se mueve detrás de la interfaz.</p>
                </div>
                <Switch label="Luz ambiental" checked={prefs.ambient} onChange={v => setPref("ambient", v)} />
              </li>
            </ul>
          </section>
        </div>

        {/* Vista previa */}
        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="card p-6">
            <h2 className="text-base font-semibold text-text">Vista previa</h2>
            <p className="mb-5 mt-1 text-sm text-text-muted">Así se ve con tus cambios.</p>

            <div className="space-y-4 rounded-2xl border border-line bg-surface-1 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-xl font-semibold text-text">Departamento en Miraflores</p>
                <span className="badge badge-gold">Nuevo</span>
              </div>
              <p className="text-sm text-text-muted">3 dormitorios · 2 baños · 120 m²</p>

              <div className="flex items-end justify-between gap-3">
                <p className="mono text-2xl font-semibold text-gold">USD 245,000</p>
                <Sparkline values={MUESTRA} className="h-9 w-24 text-gold" />
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="bar-grow h-full w-2/3 rounded-full bg-gold" />
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm">Principal</button>
                <button type="button" className="btn btn-outline btn-sm">Contorno</button>
                <button type="button" className="btn btn-secondary btn-sm">Secundario</button>
              </div>
            </div>

            <button type="button" onClick={reset} disabled={esDefault} className="btn btn-ghost btn-sm mt-5">
              <RotateCcw className="size-4" aria-hidden="true" />
              Restablecer valores
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
