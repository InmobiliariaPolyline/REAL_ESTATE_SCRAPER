import { useId } from "react"

interface SparklineProps {
  values: number[]
  className?: string
}

const W = 96
const H = 32
const PAD = 3

/** Mini gráfica de tendencia que se dibuja al aparecer. El color sale de `currentColor`. */
export default function Sparkline({ values, className }: SparklineProps) {
  const gradId = useId()
  if (values.length < 2) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2)
    return [x, y] as const
  })
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${H} L${points[0][0].toFixed(1)} ${H} Z`
  const [lx, ly] = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="Tendencia de los últimos días"
      fill="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} style={{ animation: "fillIn 1s ease 0.5s both" }} />
      <path
        d={line}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={200}
        strokeDasharray={200}
        style={{ ["--len" as string]: 200, animation: "drawLine 1.3s cubic-bezier(0.23,1,0.32,1) both" }}
      />
      <circle cx={lx} cy={ly} r="2.4" fill="currentColor" style={{ animation: "fillIn 0.4s ease 1.2s both" }} />
    </svg>
  )
}
