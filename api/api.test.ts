import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Db } from "./db"
import { createApiHandler } from "./handler"
import { runWatchdog } from "./watchdog"

/**
 * Pruebas de integración: la API completa contra un Postgres real (PGlite) con los scripts
 * db/001_schema.sql, db/002_auth.sql y db/003_account_ops.sql aplicados.
 */

const root = path.resolve(import.meta.dirname, "..")
const pg = new PGlite({ extensions: { pgcrypto } })

const db: Db = {
  query: async (text, params = []) => (await pg.query(text, params)).rows as never[],
}

const handler = createApiHandler(() => db, { USD_TO_PEN_RATE: "4" })

interface Res<T = any> {
  status: number
  body: T
}

async function call<T = any>(
  method: string,
  url: string,
  opts: { token?: string | null; body?: unknown } = {}
): Promise<Res<T>> {
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"
  const res = await handler(
    new Request(`http://localhost${url}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  )
  return { status: res.status, body: await res.json() }
}

const login = async (usuario: string, password: string) =>
  call("POST", "/api/login", { body: { usuario, password } })

let admin = ""
let member = ""
let noPlan = ""

beforeAll(async () => {
  await pg.exec(fs.readFileSync(path.join(root, "db/001_schema.sql"), "utf8"))

  // Datos previos en "modo legado" (texto plano) para comprobar la migración a bcrypt.
  await pg.exec(`
    insert into usuarios (usuario, password_hash, rol) values
      ('admin',  'admin-pass-123',   'admin'),
      ('cliente','cliente-pass-1',   'usuario'),
      ('sinplan','sinplan-pass-1',   'usuario');
    insert into propiedades (id, portal, operacion, inmueble, titulo, precio, precio_usd, moneda, distrito, dormitorios, creado_en) values
      ('a1','urbania',    'VENTA',   'Departamento','Depa San Martín', 400000, 100000, 'PEN','San Martín de Porres','2', now() - interval '1 hour'),
      ('a2','properati',  'ALQUILER','Casa',        'Casa Surco',        2000,    500, 'PEN','Santiago de Surco',   '12', now() - interval '2 hours'),
      ('a3','infocasas',  'VENTA',   'Departamento','Depa solo USD',        0,  50000, 'USD','Miraflores',          '4',  now() - interval '3 hours'),
      ('a4','urbania',    'VENTA',   'Departamento','Sin precio reciente',  0,      0, 'PEN','Lince',               '3',  now()),
      ('a5','babilonia',  'ALQUILER','Departamento','Barato',             800,    200, 'PEN','Lince',               '1',  now() - interval '4 hours');
  `)
  await pg.exec(fs.readFileSync(path.join(root, "db/002_auth.sql"), "utf8"))
  await pg.exec(fs.readFileSync(path.join(root, "db/003_account_ops.sql"), "utf8"))

  // El admin crea a "cliente" con Premium mediante la propia función SQL.
  admin = (await login("admin", "admin-pass-123")).body.token
  await call("POST", `/api/admin/usuarios/${(await pg.query<{ id: number }>("select id::int from usuarios where usuario='cliente'")).rows[0].id}/premium`, { token: admin })
  member = (await login("cliente", "cliente-pass-1")).body.token
  noPlan = (await login("sinplan", "sinplan-pass-1")).body.token
})

afterAll(async () => {
  await pg.close()
})

describe("autenticación", () => {
  it("las contraseñas heredadas pasaron a bcrypt", async () => {
    const rows = (await pg.query<{ h: string }>("select left(password_hash, 4) h from usuarios")).rows
    expect(rows.every(r => r.h === "$2a$")).toBe(true)
  })

  it("login incorrecto devuelve 401 genérico", async () => {
    const r = await login("admin", "mala")
    expect(r.status).toBe(401)
    expect(r.body.error).toBe("invalid")
    // No revela si el usuario existe.
    expect((await login("fantasma", "mala")).body).toEqual(r.body)
  })

  it("tras 5 fallos responde 429", async () => {
    for (let i = 0; i < 5; i++) await login("sinplan", `x${i}`)
    expect((await login("sinplan", "sinplan-pass-1")).status).toBe(429)
    await pg.exec("delete from login_intentos")
  })

  it("GET /api/session devuelve usuario y suscripción", async () => {
    const r = await call("GET", "/api/session", { token: member })
    expect(r.status).toBe(200)
    expect(r.body.usuario.usuario).toBe("cliente")
    expect(r.body.suscripcion.fecha_vencimiento).toBeTruthy()
    expect(r.body.token).toBeUndefined()
  })

  it("sin token o con token falso -> 401", async () => {
    expect((await call("GET", "/api/session")).status).toBe(401)
    expect((await call("GET", "/api/session", { token: "no-es-uuid" })).status).toBe(401)
    expect(
      (await call("GET", "/api/session", { token: "11111111-1111-1111-1111-111111111111" })).status
    ).toBe(401)
  })
})

describe("autorización", () => {
  it("portal: sin plan 403, con plan y admin 200", async () => {
    expect((await call("GET", "/api/propiedades")).status).toBe(401)
    expect((await call("GET", "/api/propiedades", { token: noPlan })).status).toBe(403)
    expect((await call("GET", "/api/propiedades", { token: member })).status).toBe(200)
    expect((await call("GET", "/api/propiedades", { token: admin })).status).toBe(200)
  })

  it("rutas admin: solo admin", async () => {
    expect((await call("GET", "/api/admin/usuarios", { token: member })).status).toBe(403)
    expect((await call("GET", "/api/admin/stats", { token: noPlan })).status).toBe(403)
    expect((await call("GET", "/api/admin/usuarios", { token: admin })).status).toBe(200)
  })

  it("rutas inexistentes y métodos no permitidos", async () => {
    expect((await call("GET", "/api/nada", { token: admin })).status).toBe(404)
    expect((await call("DELETE", "/api/session", { token: admin })).status).toBe(405)
  })
})

describe("portal /api/propiedades", () => {
  const list = (qs = "", token = member) => call("GET", `/api/propiedades${qs}`, { token })

  it("con precio primero y sin precio al final, estable entre páginas", async () => {
    const p1 = await list("?pageSize=2&page=0")
    const p2 = await list("?pageSize=2&page=1")
    const p3 = await list("?pageSize=2&page=2")
    const ids = [...p1.body.data, ...p2.body.data, ...p3.body.data].map((r: any) => r.id)
    expect(p1.body.count).toBe(5)
    expect(ids).toEqual(["a1", "a2", "a3", "a5", "a4"]) // a4 (sin precio, el más nuevo) al final
  })

  it("devuelve números, no strings", async () => {
    const r = await list("?pageSize=1")
    expect(typeof r.body.data[0].precio).toBe("number")
    expect(typeof r.body.data[0].precio_usd).toBe("number")
  })

  it("dormitorios: '2' no coincide con '12'; '4+' cubre 4 o más", async () => {
    const two = (await list("?dormitorios=2")).body.data.map((r: any) => r.id)
    expect(two).toEqual(["a1"])
    const fourPlus = (await list("?dormitorios=4%2B")).body.data.map((r: any) => r.id).sort()
    expect(fourPlus).toEqual(["a2", "a3"]) // 12 y 4
  })

  it("distrito ignora tildes y mayúsculas", async () => {
    const r = await list("?distrito=san%20martin")
    expect(r.body.data.map((x: any) => x.id)).toEqual(["a1"])
  })

  it("operación, portal y tipo", async () => {
    expect((await list("?operacion=ALQUILER")).body.count).toBe(2)
    expect((await list("?portales=urbania,babilonia")).body.count).toBe(3)
    expect((await list("?inmueble=Casa")).body.data.map((x: any) => x.id)).toEqual(["a2"])
  })

  it("rango de precio PEN incluye avisos solo-USD convertidos (tasa 4)", async () => {
    // a3 solo tiene USD 50000 => 200000 PEN con la tasa 4.
    const r = await list("?moneda=PEN&precioMin=150000&precioMax=250000")
    expect(r.body.data.map((x: any) => x.id)).toEqual(["a3"])
    // Avisos sin precio nunca entran cuando hay rango.
    const all = await list("?moneda=PEN&precioMin=1")
    expect(all.body.data.map((x: any) => x.id)).not.toContain("a4")
  })

  it("rango USD usa precio_usd y convierte los avisos solo-PEN", async () => {
    const r = await list("?moneda=USD&precioMin=90000&precioMax=110000")
    expect(r.body.data.map((x: any) => x.id)).toEqual(["a1"])
  })

  it("página fuera de rango devuelve vacío con el total correcto", async () => {
    const r = await list("?page=9&pageSize=2")
    expect(r.body.data).toEqual([])
    expect(r.body.count).toBe(5)
  })

  it("filtros inválidos -> 400", async () => {
    expect((await list("?dormitorios=9")).status).toBe(400)
    expect((await list("?precioMin=abc")).status).toBe(400)
    expect((await list("?page=1.5")).status).toBe(400)
  })

  it("no es inyectable por filtros", async () => {
    const r = await list(`?distrito=${encodeURIComponent("'; drop table propiedades; --")}`)
    expect(r.status).toBe(200)
    expect((await pg.query("select count(*)::int c from propiedades")).rows[0]).toEqual({ c: 5 })
  })
})

describe("enlaces", () => {
  let enlaceId = 0

  it("rechaza URLs no http(s) y tipos desconocidos", async () => {
    const bad = await call("POST", "/api/propiedades/a1/enlaces", {
      token: member,
      body: { titulo: "x", url: "javascript:alert(1)" },
    })
    expect(bad.status).toBe(400)
    const badTipo = await call("POST", "/api/propiedades/a1/enlaces", {
      token: member,
      body: { titulo: "x", url: "https://e.com", tipo: "HACK" },
    })
    expect(badTipo.status).toBe(400)
  })

  it("crear, listar, editar y borrar", async () => {
    const created = await call("POST", "/api/propiedades/a1/enlaces", {
      token: member,
      body: { titulo: "Ficha", url: "https://example.com/ficha", tipo: "DOCUMENTACION", descripcion: "d" },
    })
    expect(created.status).toBe(200)
    enlaceId = created.body.id
    expect(typeof enlaceId).toBe("number")

    const list = await call("GET", "/api/propiedades/a1/enlaces", { token: member })
    expect(list.body).toHaveLength(1)

    const upd = await call("PUT", `/api/enlaces/${enlaceId}`, {
      token: member,
      body: { titulo: "Ficha 2", url: "https://example.com/2", tipo: "OTRO", propiedad_id: "a2" },
    })
    expect(upd.body.titulo).toBe("Ficha 2")
    // Un suscriptor no puede mover el enlace a otra propiedad.
    expect(upd.body.propiedad_id).toBe("a1")

    const moved = await call("PUT", `/api/enlaces/${enlaceId}`, {
      token: admin,
      body: { titulo: "Ficha 2", url: "https://example.com/2", tipo: "OTRO", propiedad_id: "a2" },
    })
    expect(moved.body.propiedad_id).toBe("a2")

    const adminList = await call("GET", "/api/admin/enlaces", { token: admin })
    expect(adminList.body[0].propiedad.titulo).toBe("Casa Surco")

    expect((await call("DELETE", `/api/enlaces/${enlaceId}`, { token: member })).status).toBe(200)
    expect((await call("DELETE", `/api/enlaces/${enlaceId}`, { token: member })).status).toBe(404)
  })

  it("propiedad inexistente -> 404; sin plan -> 403", async () => {
    const body = { titulo: "x", url: "https://e.com" }
    expect((await call("POST", "/api/propiedades/zzz/enlaces", { token: member, body })).status).toBe(404)
    expect((await call("POST", "/api/propiedades/a1/enlaces", { token: noPlan, body })).status).toBe(403)
  })
})

describe("admin: usuarios y suscripciones", () => {
  it("crear usuario: duplicado 409, contraseña corta 400, éxito con Premium", async () => {
    const base = { usuario: "nuevo", password: "password-123", rol: "usuario", estado: "activo", premium: true }
    const ok = await call("POST", "/api/admin/usuarios", { token: admin, body: base })
    expect(ok.status).toBe(200)
    expect((await call("POST", "/api/admin/usuarios", { token: admin, body: base })).status).toBe(409)
    expect(
      (await call("POST", "/api/admin/usuarios", { token: admin, body: { ...base, usuario: "otro", password: "corta" } })).status
    ).toBe(400)

    const users = await call("GET", "/api/admin/usuarios", { token: admin })
    const nuevo = users.body.find((u: any) => u.usuario === "nuevo")
    expect(nuevo.suscripcionActiva.fecha_vencimiento).toBeTruthy()
    expect(typeof nuevo.id).toBe("number")
    expect(JSON.stringify(users.body)).not.toContain("password")
  })

  it("renovar Premium reutiliza la fila y suma 30 días", async () => {
    const id = (await pg.query<{ id: number }>("select id::int from usuarios where usuario='nuevo'")).rows[0].id
    const antes = (await pg.query<{ v: Date }>("select fecha_vencimiento v from suscripciones where usuario_id=$1", [id])).rows[0].v
    await call("POST", `/api/admin/usuarios/${id}/premium`, { token: admin })
    const rows = (await pg.query<{ v: Date }>("select fecha_vencimiento v from suscripciones where usuario_id=$1", [id])).rows
    expect(rows).toHaveLength(1)
    expect(Math.round((rows[0].v.getTime() - antes.getTime()) / 864e5)).toBe(30)
  })

  it("banear corta la sesión; no se puede banear a un admin", async () => {
    const tmp = await call("POST", "/api/admin/usuarios", {
      token: admin,
      body: { usuario: "temporal", password: "password-123", premium: true },
    })
    const tok = (await login("temporal", "password-123")).body.token
    expect((await call("GET", "/api/propiedades", { token: tok })).status).toBe(200)

    const ban = await call("PATCH", `/api/admin/usuarios/${tmp.body.id}/estado`, { token: admin, body: { estado: "baneado" } })
    expect(ban.status).toBe(200)
    expect((await call("GET", "/api/session", { token: tok })).status).toBe(401)
    expect((await login("temporal", "password-123")).status).toBe(403)

    const adminId = (await pg.query<{ id: number }>("select id::int from usuarios where usuario='admin'")).rows[0].id
    expect(
      (await call("PATCH", `/api/admin/usuarios/${adminId}/estado`, { token: admin, body: { estado: "baneado" } })).status
    ).toBe(403)
    expect((await call("PATCH", `/api/admin/usuarios/${tmp.body.id}/estado`, { token: admin, body: { estado: "x" } })).status).toBe(400)

    // Reactivar.
    await call("PATCH", `/api/admin/usuarios/${tmp.body.id}/estado`, { token: admin, body: { estado: "activo" } })
    expect((await login("temporal", "password-123")).status).toBe(200)
  })

  it("logout invalida el token", async () => {
    const tok = (await login("admin", "admin-pass-123")).body.token
    expect((await call("POST", "/api/logout", { token: tok })).status).toBe(200)
    expect((await call("GET", "/api/session", { token: tok })).status).toBe(401)
  })
})

describe("admin: propiedades, favoritos, historial y búsquedas", () => {
  it("búsqueda admin con filtros y paginación", async () => {
    const r = await call("GET", "/api/admin/propiedades?portal=urbania&pageSize=1", { token: admin })
    expect(r.body.count).toBe(2)
    expect(r.body.data).toHaveLength(1)
    const usd = await call("GET", "/api/admin/propiedades?moneda=USD", { token: admin })
    expect(usd.body.data.map((x: any) => x.id)).toEqual(["a3"])
    const range = await call("GET", "/api/admin/propiedades?minUsd=150&maxUsd=100000", { token: admin })
    expect(range.body.data.map((x: any) => x.id).sort()).toEqual(["a1", "a2", "a3", "a5"])
  })

  it("favoritos: agregar (idempotente), listar en orden y quitar", async () => {
    await call("POST", "/api/admin/favoritos", { token: admin, body: { propiedad_id: "a1" } })
    await call("POST", "/api/admin/favoritos", { token: admin, body: { propiedad_id: "a1" } })
    await call("POST", "/api/admin/favoritos", { token: admin, body: { propiedad_id: "a5" } })
    const list = await call("GET", "/api/admin/favoritos", { token: admin })
    expect(list.body.ids).toEqual(["a5", "a1"])
    expect(list.body.propiedades[0].id).toBe("a5")
    expect((await call("POST", "/api/admin/favoritos", { token: admin, body: { propiedad_id: "nope" } })).status).toBe(404)
    await call("DELETE", "/api/admin/favoritos/a5", { token: admin })
    expect((await call("GET", "/api/admin/favoritos", { token: admin })).body.ids).toEqual(["a1"])
  })

  it("historial: upsert y orden por más reciente", async () => {
    await call("PUT", "/api/admin/historial", { token: admin, body: { propiedad_id: "a1" } })
    await call("PUT", "/api/admin/historial", { token: admin, body: { propiedad_id: "a2" } })
    await call("PUT", "/api/admin/historial", { token: admin, body: { propiedad_id: "a1" } })
    const h = await call("GET", "/api/admin/historial", { token: admin })
    expect(h.body.propiedades.map((p: any) => p.id)).toEqual(["a1", "a2"])
    expect(h.body.ids.sort()).toEqual(["a1", "a2"])
  })

  it("búsquedas guardadas: crear, listar (números) y borrar", async () => {
    const created = await call("POST", "/api/admin/busquedas", {
      token: admin,
      body: { nombre: "Depas Lince", distrito: "Lince", operacion: "VENTA", portal: "todos", precio_min: 100, precio_max: null },
    })
    expect(created.status).toBe(200)
    const list = await call("GET", "/api/admin/busquedas", { token: admin })
    expect(list.body[0]).toMatchObject({ nombre: "Depas Lince", precio_min: 100, precio_max: null })
    expect((await call("POST", "/api/admin/busquedas", { token: admin, body: { nombre: "  " } })).status).toBe(400)
    expect((await call("DELETE", `/api/admin/busquedas/${created.body.id}`, { token: admin })).status).toBe(200)
    expect((await call("DELETE", "/api/admin/busquedas/no-uuid", { token: admin })).status).toBe(400)
  })

  it("buscador de propiedades para enlaces", async () => {
    const r = await call("GET", "/api/admin/propiedades-lookup?q=lince", { token: admin })
    expect(r.body.map((p: any) => p.id).sort()).toEqual(["a4", "a5"])
    expect((await call("GET", "/api/admin/propiedades-lookup?q=a", { token: admin })).body).toEqual([])
  })

  it("eliminar propiedad", async () => {
    expect((await call("DELETE", "/api/admin/propiedades/a5", { token: admin })).status).toBe(200)
    expect((await call("DELETE", "/api/admin/propiedades/a5", { token: admin })).status).toBe(404)
  })
})

describe("admin: métricas y utilidades", () => {
  it("stats con números y desglose por portal", async () => {
    const adminTok = (await login("admin", "admin-pass-123")).body.token
    const s = await call("GET", "/api/admin/stats", { token: adminTok })
    expect(s.status).toBe(200)
    expect(s.body.totalProps).toBe(4)
    expect(s.body.subsActivas).toBeGreaterThanOrEqual(2)
    expect(s.body.added24h).toBeGreaterThanOrEqual(1)
    expect(s.body.porPortal.find((p: any) => p.portal === "urbania").count).toBe(2)

    // Serie diaria: 30 días consecutivos, con ceros, que suman los avisos recientes.
    expect(s.body.porDia).toHaveLength(30)
    expect(s.body.porDia[0].dia < s.body.porDia[29].dia).toBe(true)
    expect(s.body.porDia.reduce((n: number, d: any) => n + d.total, 0)).toBe(4)

    const logs = await call("GET", "/api/admin/accesos", { token: adminTok })
    expect(logs.body[0]).toMatchObject({ usuario: expect.any(String) })
    expect(typeof logs.body[0].id).toBe("number")
  })

  it("scraper sin configurar -> 501", async () => {
    const t = (await login("admin", "admin-pass-123")).body.token
    expect((await call("POST", "/api/admin/scraper", { token: t })).status).toBe(501)
  })

  it("health diagnostica la causa sin filtrar secretos", async () => {
    const failing = (message: string) =>
      createApiHandler(
        () => ({
          query: async () => {
            throw new Error(message)
          },
        }),
        {}
      )
    const probe = async (message: string) => {
      const res = await failing(message)(new Request("http://localhost/api/health"))
      return { status: res.status, text: JSON.stringify(await res.json()) }
    }

    const noUrl = await probe("DATABASE_URL no está configurada")
    expect(noUrl.status).toBe(503)
    expect(noUrl.text).toContain("DATABASE_URL")

    const badPass = await probe('password authentication failed for user "neondb_owner" npg_SECRETO')
    expect(badPass.text).toContain("rechazó las credenciales")
    expect(badPass.text).not.toContain("neondb_owner")
    expect(badPass.text).not.toContain("npg_SECRETO")

    expect((await probe("getaddrinfo ENOTFOUND ep-x.neon.tech")).text).toContain("alcanzar")
    expect((await probe('relation "usuarios" does not exist')).text).toContain("db/")
    expect((await probe("algo raro")).text).toContain("desconocido")
  })

  it("errores internos no filtran detalles", async () => {
    const broken = createApiHandler(
      () => ({
        query: async () => {
          throw new Error("password authentication failed for user neondb_owner")
        },
      }),
      {}
    )
    const res = await broken(
      new Request("http://localhost/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: "a", password: "b" }),
      })
    )
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain("neondb_owner")
  })
})


describe("contraseñas y cuenta", () => {
  const create = (usuario: string, password: string) =>
    call("POST", "/api/admin/usuarios", {
      token: admin,
      body: { usuario, password, rol: "usuario", estado: "activo", premium: true },
    })

  it("cambiar la propia contraseña cierra las otras sesiones y la anterior deja de servir", async () => {
    await create("cuenta1", "clave-inicial-1")
    const s1 = (await login("cuenta1", "clave-inicial-1")).body.token
    const s2 = (await login("cuenta1", "clave-inicial-1")).body.token

    const r = await call("POST", "/api/account/password", {
      token: s1,
      body: { actual: "clave-inicial-1", nueva: "clave-nueva-22" },
    })
    expect(r.status).toBe(200)

    expect((await call("GET", "/api/session", { token: s1 })).status).toBe(200) // la actual sigue
    expect((await call("GET", "/api/session", { token: s2 })).status).toBe(401) // la otra se cerró
    expect((await login("cuenta1", "clave-inicial-1")).status).toBe(401)
    expect((await login("cuenta1", "clave-nueva-22")).status).toBe(200)
  })

  it("valida contraseña actual, longitud y que la nueva sea distinta", async () => {
    await create("cuenta2", "clave-inicial-2")
    const t = (await login("cuenta2", "clave-inicial-2")).body.token
    const change = (body: object) => call("POST", "/api/account/password", { token: t, body })

    const wrong = await change({ actual: "equivocada", nueva: "clave-nueva-22" })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error).toBe("password_actual")
    // Una contraseña actual incorrecta no debe cerrar la sesión (no es un 401).
    expect((await call("GET", "/api/session", { token: t })).status).toBe(200)

    expect((await change({ actual: "clave-inicial-2", nueva: "corta" })).status).toBe(400)
    expect((await change({ actual: "clave-inicial-2", nueva: "clave-inicial-2" })).status).toBe(400)
    expect((await call("POST", "/api/account/password", { body: { actual: "a", nueva: "b" } })).status).toBe(401)
  })

  it("el cambio de contraseña no permite adivinar la actual por fuerza bruta", async () => {
    await create("cuenta3", "clave-inicial-3")
    const t = (await login("cuenta3", "clave-inicial-3")).body.token
    let last = 0
    for (let i = 0; i < 6; i++) {
      last = (await call("POST", "/api/account/password", { token: t, body: { actual: `mala${i}`, nueva: "clave-nueva-33" } })).status
    }
    expect(last).toBe(429)
    // Incluso con la clave correcta queda bloqueado mientras dure el bloqueo.
    expect(
      (await call("POST", "/api/account/password", { token: t, body: { actual: "clave-inicial-3", nueva: "clave-nueva-33" } })).status
    ).toBe(429)
    await pg.exec("delete from login_intentos")
  })

  it("el admin restablece la contraseña de otro usuario y se cierran sus sesiones", async () => {
    const created = await create("cuenta4", "clave-inicial-4")
    const userTok = (await login("cuenta4", "clave-inicial-4")).body.token

    // Un usuario normal no puede restablecer.
    expect(
      (await call("POST", `/api/admin/usuarios/${created.body.id}/password`, { token: userTok, body: { password: "otra-clave-99" } })).status
    ).toBe(403)

    expect(
      (await call("POST", `/api/admin/usuarios/${created.body.id}/password`, { token: admin, body: { password: "corta" } })).status
    ).toBe(400)
    expect(
      (await call("POST", `/api/admin/usuarios/99999/password`, { token: admin, body: { password: "otra-clave-99" } })).status
    ).toBe(404)

    const ok = await call("POST", `/api/admin/usuarios/${created.body.id}/password`, { token: admin, body: { password: "clave-admin-44" } })
    expect(ok.status).toBe(200)
    expect((await call("GET", "/api/session", { token: userTok })).status).toBe(401)
    expect((await login("cuenta4", "clave-inicial-4")).status).toBe(401)
    expect((await login("cuenta4", "clave-admin-44")).status).toBe(200)
  })
})

describe("limpieza de avisos inactivos", () => {
  const days = (n: number) => `now() - interval '${n} days'`

  it("valida el rango de días y exige admin", async () => {
    expect((await call("GET", "/api/admin/limpieza?dias=3", { token: admin })).status).toBe(400)
    expect((await call("GET", "/api/admin/limpieza?dias=9999", { token: admin })).status).toBe(400)
    expect((await call("GET", "/api/admin/limpieza?dias=30", { token: member })).status).toBe(403)
    expect((await call("POST", "/api/admin/limpiar-inactivos", { token: member, body: { dias: 30 } })).status).toBe(403)
  })

  it("elimina solo los inactivos sin enlaces ni favoritos", async () => {
    await pg.exec(`delete from propiedades; delete from favoritos; delete from enlaces;`)
    await pg.exec(`
      insert into propiedades (id, portal, precio, ultima_vista_en) values
        ('fresca',   'urbania', 1, now()),
        ('vieja1',   'urbania', 1, ${days(40)}),
        ('vieja2',   'urbania', 1, ${days(60)}),
        ('conlink',  'urbania', 1, ${days(50)}),
        ('confav',   'urbania', 1, ${days(50)});
      insert into enlaces (propiedad_id, titulo, url) values ('conlink', 'x', 'https://e.com');
    `)
    const adminId = (await pg.query<{ id: number }>("select id::int from usuarios where usuario='admin'")).rows[0].id
    await pg.query("insert into favoritos (admin_id, propiedad_id) values ($1, 'confav')", [adminId])

    const preview = await call("GET", "/api/admin/limpieza?dias=30", { token: admin })
    expect(preview.body).toMatchObject({ total: 5, eliminables: 2, protegidas: 2, seguro: true })

    // Con 45 días solo cuentan las de 50+ (protegidas) y 60 (vieja2).
    const wider = await call("GET", "/api/admin/limpieza?dias=45", { token: admin })
    expect(wider.body).toMatchObject({ eliminables: 1, protegidas: 2 })

    const run = await call("POST", "/api/admin/limpiar-inactivos", { token: admin, body: { dias: 30 } })
    expect(run.status).toBe(200)
    expect(run.body).toMatchObject({ ok: true, eliminadas: 2, protegidas: 2 })

    const left = (await pg.query<{ id: string }>("select id from propiedades order by id")).rows.map(r => r.id)
    expect(left).toEqual(["confav", "conlink", "fresca"])
  })

  it("se niega a limpiar si el scraper no refrescó los datos recientemente", async () => {
    await pg.exec(`update propiedades set ultima_vista_en = ${days(10)}`)
    const preview = await call("GET", "/api/admin/limpieza?dias=7", { token: admin })
    expect(preview.body.seguro).toBe(false)
    expect(preview.body.motivo).toContain("scraper")

    const run = await call("POST", "/api/admin/limpiar-inactivos", { token: admin, body: { dias: 7 } })
    expect(run.status).toBe(409)
    expect((await pg.query("select count(*)::int c from propiedades")).rows[0]).toEqual({ c: 3 })
  })

  it("no permite borrar todos los avisos ni limpiar una base vacía", async () => {
    await pg.exec(`delete from enlaces; delete from favoritos; update propiedades set ultima_vista_en = now() where id='fresca'`)
    await pg.exec(`update propiedades set ultima_vista_en = ${days(40)} where id <> 'fresca'`)
    // Queda 'fresca' reciente: se pueden borrar las otras dos.
    expect((await call("GET", "/api/admin/limpieza?dias=30", { token: admin })).body).toMatchObject({ eliminables: 2, seguro: true })

    await pg.exec(`delete from propiedades`)
    const empty = await call("GET", "/api/admin/limpieza?dias=30", { token: admin })
    expect(empty.body.seguro).toBe(false)
  })
})

describe("watchdog del scraper", () => {
  const sent: { url: string; body: any }[] = []
  const fakeFetch = (ok = true) => async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) })
    return { ok, status: ok ? 200 : 500 }
  }
  const setActivity = (hoursAgo: number) =>
    pg.exec(`
      delete from propiedades;
      insert into propiedades (id, portal, creado_en, ultima_vista_en)
      values ('w1', 'urbania', now() - interval '${hoursAgo} hours', now() - interval '${hoursAgo} hours');
    `)
  const env = { ALERT_WEBHOOK_URL: "https://hooks.example.com/x", ALERT_STALE_HOURS: "24" }

  it("no alerta si aún no hay datos ni si el scraper está activo", async () => {
    await pg.exec("delete from propiedades; delete from app_alerts")
    expect(await runWatchdog(db, env, fakeFetch())).toMatchObject({ stale: false, reason: "sin_datos" })

    await setActivity(2)
    expect(await runWatchdog(db, env, fakeFetch())).toMatchObject({ stale: false, alerted: false })
    expect(sent).toHaveLength(0)
  })

  it("alerta una vez por incidente y vuelve a alertar solo tras 24 h", async () => {
    await setActivity(30)
    const first = await runWatchdog(db, env, fakeFetch())
    expect(first).toMatchObject({ stale: true, alerted: true })
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe(env.ALERT_WEBHOOK_URL)
    // Compatible con Slack (text) y Discord (content).
    expect(sent[0].body.text).toContain("30 h")
    expect(sent[0].body.content).toBe(sent[0].body.text)

    expect(await runWatchdog(db, env, fakeFetch())).toMatchObject({ alerted: false, reason: "ya_alertado" })
    expect(sent).toHaveLength(1)

    await pg.exec("update app_alerts set ultimo_envio = now() - interval '25 hours'")
    expect(await runWatchdog(db, env, fakeFetch())).toMatchObject({ alerted: true })
    expect(sent).toHaveLength(2)
  })

  it("al recuperarse limpia el incidente para alertar de inmediato en el siguiente", async () => {
    await setActivity(1)
    expect(await runWatchdog(db, env, fakeFetch())).toMatchObject({ stale: false, reason: "recuperado" })
    expect((await pg.query("select count(*)::int c from app_alerts")).rows[0]).toEqual({ c: 0 })

    await setActivity(40)
    expect(await runWatchdog(db, env, fakeFetch())).toMatchObject({ alerted: true })
  })

  it("sin webhook no envía nada y si el webhook falla no marca la alerta como enviada", async () => {
    await pg.exec("delete from app_alerts")
    await setActivity(50)
    expect(await runWatchdog(db, { ALERT_STALE_HOURS: "24" }, fakeFetch())).toMatchObject({
      stale: true,
      alerted: false,
      reason: "webhook_no_configurado",
    })

    await expect(runWatchdog(db, env, fakeFetch(false))).rejects.toThrow("500")
    expect((await pg.query("select count(*)::int c from app_alerts")).rows[0]).toEqual({ c: 0 })
  })

  it("la ruta interna exige CRON_SECRET", async () => {
    const call2 = async (envVars: object, secret?: string) => {
      const h = createApiHandler(() => db, envVars)
      const res = await h(
        new Request("http://localhost/api/internal/watchdog", {
          method: "POST",
          headers: secret ? { "x-cron-secret": secret } : {},
        })
      )
      return { status: res.status, body: await res.json() as any }
    }
    expect((await call2({})).status).toBe(501)
    expect((await call2({ CRON_SECRET: "s3creto" })).status).toBe(403)
    expect((await call2({ CRON_SECRET: "s3creto" }, "otro")).status).toBe(403)

    await pg.exec("delete from propiedades")
    const ok = await call2({ CRON_SECRET: "s3creto" }, "s3creto")
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ stale: false, reason: "sin_datos" })
  })
})
