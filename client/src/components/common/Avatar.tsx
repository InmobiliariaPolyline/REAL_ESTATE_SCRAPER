import { cn } from "@/lib/utils"

interface AvatarProps {
  name: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-20 text-2xl",
}

// Paleta fija: el mismo nombre siempre produce el mismo color.
const TONES = [
  "from-[#d4b782] to-[#a88659] text-[#17130a]",
  "from-[#6ea8fe] to-[#4a7fd1] text-[#06142b]",
  "from-[#a78bfa] to-[#7c5fd6] text-[#150c33]",
  "from-[#4fd1b5] to-[#2f9d86] text-[#04211b]",
  "from-[#f5b454] to-[#d48a1f] text-[#2b1700]",
  "from-[#f2706b] to-[#c8433e] text-[#2b0807]",
]

function toneFor(name: string) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return TONES[hash % TONES.length]
}

/** Avatar con iniciales y degradado determinista. */
export default function Avatar({ name, size = "md", className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold ring-1 ring-white/10",
        SIZES[size],
        toneFor(name),
        className
      )}
    >
      {initials || "?"}
    </span>
  )
}
