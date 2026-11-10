import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { Db } from "./db"
import { createApiHandler } from "./handler"
import { estadoDeEjecucion, githubDe, lanzarScraper, ultimasEjecuciones } from "./scraperPropio"

const cfg = { token: "github_pat_" + "x".repeat(30), repo: "Usuario/Repo" }

describe("scraperPropio", () => {
  it("lee token y repositorio del entorno y rechaza lo mal escrito", () => {
    expect(githubDe({ GITHUB_TOKEN: cfg.token, GITHUB_REPO: "Usuario/Repo" })).toEqual(cfg)
    expect(githubDe({ GITHUB_TOKEN: cfg.token })).toBeNull()
    expect(githubDe({ GITHUB_TOKEN: "corto", GITHUB_REPO: "a/b" })).toBeNull()
    expect(githubDe({ GITHUB_TOKEN: cfg.token, GITHUB_REPO: "https://github.com/a/b" })).toBeNull()
    expect(githubDe({ GITHUB_TOKEN: cfg.token, GITHUB_REPO: "../etc/passwd" })).toBeNull()
  })

  it("traduce el estado de GitHub Actions", () => {
    expect(estadoDeEjecucion("queued", null)).toBe("en_cola")
    expect(estadoDeEjecucion("in_progress", null)).toBe("en_curso")
    expect(estadoDeEjecucion("completed", "success")).toBe("completada")
    expect(estadoDeEjecucion("completed", "failure")).toBe("fallida")
    expect(estadoDeEjecucion("completed", "cancelled")).toBe("cancelada")
  })

  it("lista las ejecuciones y lanza el workflow con el token en la cabecera", async () => {
    const llamadas: { url: string; init: RequestInit }[] = []
    const fetchFn = (async (url: string, init: RequestInit) => {
      llamadas.push({ url, init })
      if (init.method === "POST") return new Response(null, { status: 204 })
      return new Response(
        JSON.stringify({
          workflow_runs: [
            { id: 11, status: "completed", conclusion: "success", event: "workflow_dispatch", html_url: "https://github.com/Usuario/Repo/actions/runs/11", run_started_at: "2026-11-10T14:00:00Z", updated_at: "2026-11-10T14:09:00Z" },
            { id: 12, status: "in_progress", conclusion: null, event: "schedule", html_url: "https://evil.example/x", created_at: "2026-11-11T14:00:00Z", updated_at: "2026-11-11T14:01:00Z" },
          ],
        }),
        { status: 200 }
      )
    }) as unknown as typeof fetch
    const e = await ultimasEjecuciones(cfg, fetchFn)
    expect(e.map(x => [x.id, x.estado, x.origen])).toEqual([[11, "completada", "manual"], [12, "en_curso", "programada"]])
    expect(e[1].url).toBe("https://github.com/Usuario/Repo/actions") // una dirección ajena a GitHub no se acepta
    expect((llamadas[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${cfg.token}`)
    expect(llamadas[0].url).toContain("/repos/Usuario/Repo/actions/workflows/scraper.yml/runs")

    await lanzarScraper(cfg, 7, fetchFn)
    expect(llamadas[1].url).toContain("/actions/workflows/scraper.yml/dispatches")
    expect(JSON.parse(String(llamadas[1].init.body))).toEqual({ ref: "main", inputs: { paginas: "7" } })
  })

  it("da mensajes claros cuando GitHub rechaza", async () => {
    const con = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch
    await expect(ultimasEjecuciones(cfg, con(401))).rejects.toThrow("token")
    await expect(ultimasEjecuciones(cfg, con(404))).rejects.toThrow("GITHUB_REPO")
    await expect(lanzarScraper(cfg, 5, con(403))).rejects.toThrow("permiso")
  })
})

describe("API /api/admin/scraper-propio", () => {
  const root = path.resolve(import.meta.dirname, "..")
  const pg = new PGlite({ extensions: { pgcrypto } })
  const db: Db = { query: async (text, params = []) => (await pg.query(text, params)).rows as never[] }
  let admin = ""
  let cliente = ""

  const llamar = async (env: Record<string, string>, method: string, url: string, token: string, body?: unknown) => {
    const handler = createApiHandler(() => db, { USD_TO_PEN_RATE: "3.75", ...env })
    const res = await handler(
      new Request(`http://localhost${url}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    )
    return { status: res.status, body: (await res.json()) as any }
  }
  const login = async (usuario: string, password: string) => {
    const res = await createApiHandler(() => db, {})(
      new Request("http://localhost/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario, password }) })
    )
    return ((await res.json()) as any).token as string
  }

  beforeAll(async () => {
    await pg.exec(fs.readFileSync(path.join(root, "db/001_schema.sql"), "utf8"))
    await pg.exec(`insert into usuarios (usuario, password_hash, rol) values ('admin','admin-pass-123','admin'),('cliente','cliente-pass-1','usuario');`)
    for (const f of ["002_auth", "003_account_ops", "004_price_history", "005_sessions_audit", "006_idle_timeout", "007_carga", "010_fuentes"]) await pg.exec(fs.readFileSync(path.join(root, `db/${f}.sql`), "utf8"))
    admin = await login("admin", "admin-pass-123")
    cliente = await login("cliente", "cliente-pass-1")
  }, 60000)

  afterEach(() => vi.restoreAllMocks())

  const ENV = { GITHUB_TOKEN: cfg.token, GITHUB_REPO: "Usuario/Repo" }
  const simular = (ejecuciones: unknown[], dispatch = 204) =>
    vi.spyOn(globalThis, "fetch").mockImplementation((async (_u: string, init?: RequestInit) =>
      init?.method === "POST" ? new Response(null, { status: dispatch }) : new Response(JSON.stringify({ workflow_runs: ejecuciones }), { status: 200 })) as unknown as typeof fetch)

  it("solo el administrador entra", async () => {
    expect((await llamar(ENV, "GET", "/api/admin/scraper-propio", cliente)).status).toBe(403)
    expect((await llamar(ENV, "POST", "/api/admin/scraper-propio/ejecutar", cliente, {})).status).toBe(403)
  })

  it("sin token de GitHub avisa que falta configurarlo y no deja ejecutar", async () => {
    const r = await llamar({}, "GET", "/api/admin/scraper-propio", admin)
    expect(r.body).toMatchObject({ configurado: false, ejecuciones: [] })
    expect(r.body.fuentes.map((f: any) => [f.id, f.propio])).toEqual([["adondevivir", false], ["urbania", false], ["infocasas", true], ["properati", false]])
    expect(r.body.fuentes.every((f: any) => f.apify)).toBe(true)
    expect((await llamar({}, "POST", "/api/admin/scraper-propio/ejecutar", admin, {})).status).toBe(501)
  })

  it("muestra las ejecuciones y lanza el workflow, dejando constancia en la auditoría", async () => {
    const espia = simular([{ id: 5, status: "completed", conclusion: "success", event: "workflow_dispatch", html_url: "https://github.com/Usuario/Repo/actions/runs/5", run_started_at: "2026-11-10T14:00:00Z", updated_at: "2026-11-10T14:09:00Z" }])
    const estado = await llamar(ENV, "GET", "/api/admin/scraper-propio", admin)
    expect(estado.body).toMatchObject({ configurado: true, repo: "Usuario/Repo", error: null })
    expect(estado.body.ejecuciones[0]).toMatchObject({ id: 5, estado: "completada" })
    expect(JSON.stringify(estado.body)).not.toContain(cfg.token)

    const r = await llamar(ENV, "POST", "/api/admin/scraper-propio/ejecutar", admin, { paginas: 3 })
    expect(r).toMatchObject({ status: 200, body: { ok: true, paginas: 3 } })
    const dispatch = espia.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === "POST")!
    expect(JSON.parse(String((dispatch[1] as RequestInit).body))).toEqual({ ref: "main", inputs: { paginas: "3" } })
    const aud = (await pg.query<any>("select accion, objetivo from public.auditoria where objetivo = 'scraper-propio'")).rows
    expect(aud).toEqual([{ accion: "carga.iniciar", objetivo: "scraper-propio" }])
  })

  it("no lanza otra ejecución si hay una en curso, y valida las páginas", async () => {
    simular([{ id: 6, status: "in_progress", conclusion: null, event: "workflow_dispatch" }])
    expect((await llamar(ENV, "POST", "/api/admin/scraper-propio/ejecutar", admin, {})).status).toBe(409)
    simular([])
    expect((await llamar(ENV, "POST", "/api/admin/scraper-propio/ejecutar", admin, { paginas: 99 })).status).toBe(400)
    expect((await llamar(ENV, "POST", "/api/admin/scraper-propio/ejecutar", admin, { paginas: "5; rm" })).status).toBe(400)
  })

  it("si GitHub rechaza el token, el panel recibe un mensaje claro y no revienta", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }))
    const r = await llamar(ENV, "GET", "/api/admin/scraper-propio", admin)
    expect(r.status).toBe(200)
    expect(r.body.error).toContain("token")
    expect((await llamar(ENV, "POST", "/api/admin/scraper-propio/ejecutar", admin, {})).status).toBe(502)
  })
})
