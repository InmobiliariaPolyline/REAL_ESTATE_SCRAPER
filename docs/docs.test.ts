import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Que la documentación no se desactualice: lo que el README y las guías afirman sobre el repositorio (archivos, migraciones,
 * variables de entorno, comandos y enlaces) tiene que seguir siendo verdad. Si esta prueba falla, hay que actualizar el
 * documento que nombra (o el código, si el documento tenía razón).
 */
const root = path.resolve(import.meta.dirname, "..")
const leer = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8")
const existe = (rel: string) => fs.existsSync(path.join(root, rel))

const DOCUMENTOS = ["README.md", ...fs.readdirSync(path.join(root, "docs")).filter(f => f.endsWith(".md")).map(f => `docs/${f}`)]
const contenido = Object.fromEntries(DOCUMENTOS.map(d => [d, leer(d)]))

/** Texto de un documento sin los bloques de código (los comandos de ejemplo no son afirmaciones sobre el repositorio). */
const sinBloques = (s: string) => s.replace(/```[\s\S]*?```/g, "")

/** Dirección que GitHub genera para un título (minúsculas, sin signos, espacios a guiones). */
const ancla = (titulo: string) =>
  titulo.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s/g, "-")

const anclasDe = (md: string) => new Set([...sinBloques(md).matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => ancla(m[1])))

describe("documentación: enlaces", () => {
  for (const doc of DOCUMENTOS) {
    it(`${doc}: todos los enlaces e imágenes relativos existen (y sus secciones)`, () => {
      const texto = contenido[doc]
      const destinos = [...texto.matchAll(/\]\(([^)\s]+)\)/g), ...texto.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
      const rotos: string[] = []
      for (const d of destinos) {
        if (/^(https?:|mailto:)/.test(d)) continue
        const [archivo, seccion] = d.split("#")
        const destino = archivo ? path.join(path.dirname(path.join(root, doc)), archivo) : path.join(root, doc)
        if (!fs.existsSync(destino)) {
          rotos.push(`${d} (no existe)`)
          continue
        }
        if (seccion && destino.endsWith(".md") && !anclasDe(fs.readFileSync(destino, "utf8")).has(decodeURIComponent(seccion))) {
          rotos.push(`${d} (no hay esa sección)`)
        }
      }
      expect(rotos).toEqual([])
    })
  }
})

describe("documentación: archivos citados", () => {
  const RAICES = ["api/", "client/", "shared/", "db/", "scraper/", "netlify/", "server/", "scripts/", "docs/", ".github/"]
  const SUELTOS = new Set(["netlify.toml", "package.json", "README.md", ".env.example", "build-info.ts", "vitest.config.ts", "pnpm-lock.yaml"])

  for (const doc of DOCUMENTOS) {
    it(`${doc}: los archivos y carpetas que nombra existen`, () => {
      const citados = [...sinBloques(contenido[doc]).matchAll(/`([^`\s]+)`/g)].map(m => m[1])
      const faltan = citados
        .filter(t => (RAICES.some(r => t.startsWith(r)) || SUELTOS.has(t)) && !/[*<>{}|…]|AAAA|\.\.\./.test(t))
        .filter(t => !existe(t.replace(/\/$/, "")))
      expect(faltan).toEqual([])
    })
  }

  it("README: la estructura que dibuja existe en el repositorio", () => {
    const bloque = contenido["README.md"].split("## Estructura")[1].match(/```\n([\s\S]*?)```/)?.[1] ?? ""
    const rutas = bloque.split("\n").map(l => /^(\S+)/.exec(l)?.[1]).filter((r): r is string => !!r)
    expect(rutas.length).toBeGreaterThan(8)
    expect(rutas.filter(r => !existe(r.replace(/\/$/, "")))).toEqual([])
  })
})

describe("documentación: migraciones", () => {
  const archivos = fs.readdirSync(path.join(root, "db")).filter(f => /^\d+_.+\.sql$/.test(f))

  it("README lista todas las migraciones de db/ y ninguna que no exista", () => {
    const readme = contenido["README.md"]
    expect(archivos.filter(f => !readme.includes(`\`${f}\``))).toEqual([])
    const citadas = [...readme.matchAll(/`(\d{3}_[a-z_]+\.sql)`/g)].map(m => m[1])
    expect(citadas.filter(f => !archivos.includes(f))).toEqual([])
    expect(readme).toContain("optional/inmodata_readonly.sql")
  })

  it("las guías solo citan migraciones que existen", () => {
    for (const doc of DOCUMENTOS) {
      const citadas = [...contenido[doc].matchAll(/db\/(\d{3}_[a-z_]+\.sql)/g)].map(m => m[1])
      expect(citadas.filter(f => !archivos.includes(f)), doc).toEqual([])
    }
  })
})

describe("documentación: variables de entorno y secretos", () => {
  const deApiEnv = [...leer("api/env.ts").matchAll(/^\s{2}([A-Z][A-Z0-9_]+)\??:/gm)].map(m => m[1])
  const deEjemplo = [...leer(".env.example").matchAll(/^#?\s?([A-Z][A-Z0-9_]+)=/gm)].map(m => m[1])
  const deFlujos = fs
    .readdirSync(path.join(root, ".github/workflows"))
    .flatMap(f => [...leer(`.github/workflows/${f}`).matchAll(/secrets\.([A-Z][A-Z0-9_]+)/g)].map(m => m[1]))
  // Las define Netlify o el servidor por su cuenta: no hace falta explicarlas.
  const AUTOMATICAS = new Set(["URL", "PUBLIC_URL"])

  it("todas las variables que lee la API están en el README y en .env.example", () => {
    expect(deApiEnv.length).toBeGreaterThan(15)
    const readme = contenido["README.md"]
    const ejemplo = leer(".env.example")
    const sinReadme = deApiEnv.filter(v => !AUTOMATICAS.has(v) && !readme.includes(v))
    const sinEjemplo = deApiEnv.filter(v => !AUTOMATICAS.has(v) && !ejemplo.includes(v))
    expect({ sinReadme, sinEjemplo }).toEqual({ sinReadme: [], sinEjemplo: [] })
  })

  it("todo lo que declara .env.example está en el README", () => {
    const readme = contenido["README.md"]
    expect(deEjemplo.filter(v => !readme.includes(v))).toEqual([])
  })

  it("los secretos de GitHub que usan los workflows están en el README", () => {
    const readme = contenido["README.md"]
    const propios = [...new Set(deFlujos)].filter(v => v !== "GITHUB_TOKEN")
    expect(propios.length).toBeGreaterThan(1)
    expect(propios.filter(v => !readme.includes(v))).toEqual([])
  })

  it("los nombres de variables que citan las guías existen de verdad (no quedan nombres viejos)", () => {
    const conocidos = new Set([...deApiEnv, ...deEjemplo, ...deFlujos, "PORT", "CSP_EXTRA_CONNECT_SRC", "INGESTA_URL"])
    const PREFIJOS = /^(APIFY_|CARGA_|INGESTA_|GITHUB_|CLOUDINARY_|ALERT_|CRON_|BACKUP_|VITE_|USD_|DATABASE_)/
    for (const doc of DOCUMENTOS) {
      const citadas = [...sinBloques(contenido[doc]).matchAll(/`([A-Z][A-Z0-9_]{3,})`/g)].map(m => m[1]).filter(v => PREFIJOS.test(v))
      expect(citadas.filter(v => !conocidos.has(v)), doc).toEqual([])
    }
  })
})

describe("documentación: comandos y tareas programadas", () => {
  it("los comandos pnpm que nombran las guías existen en package.json", () => {
    const scripts = Object.keys(JSON.parse(leer("package.json")).scripts as Record<string, string>)
    const DE_PNPM = new Set(["install", "exec", "audit", "dlx", "add", "run"])
    for (const doc of DOCUMENTOS) {
      const usados = [...contenido[doc].matchAll(/pnpm\s+([a-z:]+)/g)].map(m => m[1])
      expect(usados.filter(c => !scripts.includes(c) && !DE_PNPM.has(c)), doc).toEqual([])
    }
  })

  it("las tareas programadas que describe el README existen con ese horario", () => {
    const readme = contenido["README.md"]
    const cron = (rel: string) => /schedule:\s*"([^"]+)"/.exec(leer(rel))?.[1] ?? /cron:\s*"([^"]+)"/.exec(leer(rel))?.[1]
    for (const f of ["carga-semanal", "copiar-portadas", "scraper-watchdog"]) {
      expect(existe(`netlify/functions/${f}.ts`)).toBe(true)
      expect(readme).toContain(`netlify/functions/${f}.ts`)
    }
    // Lunes y jueves 09:00 en Lima = 14:00 UTC; respaldo 02:30 en Lima = 07:30 UTC; cada hora y cada 6 horas.
    expect(cron("netlify/functions/carga-semanal.ts")).toBe("0 14 * * 1,4")
    expect(cron(".github/workflows/scraper.yml")).toBe("0 14 * * 1,4")
    expect(cron(".github/workflows/backup.yml")).toBe("30 7 * * *")
    expect(cron("netlify/functions/copiar-portadas.ts")).toBe("15 * * * *")
    expect(cron("netlify/functions/scraper-watchdog.ts")).toBe("0 */6 * * *")
  })
})
