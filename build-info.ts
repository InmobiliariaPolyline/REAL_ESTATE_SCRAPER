import fs from "node:fs"
import path from "node:path"

/**
 * Constantes de compilación compartidas por Vite y Vitest (se inyectan como globales):
 *   __APP_VERSION__  versión de package.json
 *   __BUILD_DATE__   fecha de la compilación (ISO)
 *   __BUILD_COMMIT__ commit corto (Netlify lo da en COMMIT_REF; en local queda "local")
 */
export function buildInfo(root: string) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version: string }
  return {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify((process.env.COMMIT_REF ?? "").slice(0, 7) || "local"),
  }
}
