import type { LucideIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

/** Abre el buscador global desde cualquier botón. */
export const openCommandPalette = () => window.dispatchEvent(new Event("open-command-palette"))

export interface CommandAction {
  id: string
  label: string
  group: string
  icon: LucideIcon
  /** Palabras extra que también encuentran la acción (sinónimos). */
  keywords?: string[]
  run: () => void
}

interface CommandPaletteProps {
  actions: CommandAction[]
}

/**
 * Buscador global: se abre con Ctrl+K (o ⌘K) o con el evento `open-command-palette`, y permite
 * saltar a cualquier sección o ejecutar acciones escribiendo unas letras.
 */
export default function CommandPalette({ actions }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("open-command-palette", onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("open-command-palette", onOpen)
    }
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, CommandAction[]>()
    for (const a of actions) map.set(a.group, [...(map.get(a.group) ?? []), a])
    return Array.from(map.entries())
  }, [actions])

  const run = (action: CommandAction) => {
    setOpen(false)
    // Tras cerrar el diálogo, para que el foco vuelva antes de abrir otro.
    setTimeout(action.run, 0)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Buscador"
      description="Escribe para saltar a una sección o ejecutar una acción"
      showCloseButton={false}
      className="max-w-lg border border-line bg-surface-2"
    >
      <CommandInput placeholder="¿Qué quieres hacer?" />
      <CommandList className="max-h-[22rem]">
        <CommandEmpty>No hay resultados.</CommandEmpty>
        {groups.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map(a => {
              const Icon = a.icon
              return (
                <CommandItem
                  key={a.id}
                  value={`${a.label} ${a.keywords?.join(" ") ?? ""}`}
                  onSelect={() => run(a)}
                >
                  <Icon className="text-gold" aria-hidden="true" />
                  {a.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
