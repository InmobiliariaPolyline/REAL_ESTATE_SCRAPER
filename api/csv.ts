/** Utilidades para exportar a CSV de forma segura para Excel. */

const BOM = "﻿"

/**
 * Escapa una celda: comillas dobles duplicadas y, para evitar inyección de fórmulas en Excel
 * (=, +, -, @, tab, CR al inicio), antepone un apóstrofo a los textos peligrosos.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  let text = typeof value === "number" ? String(value) : String(value)
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export interface CsvColumn<T> {
  header: string
  get: (row: T) => unknown
}

/** Genera el CSV completo (con BOM UTF-8 y saltos CRLF) a partir de filas y columnas. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map(c => csvCell(c.header)).join(",")]
  for (const row of rows) lines.push(columns.map(c => csvCell(c.get(row))).join(","))
  return BOM + lines.join("\r\n") + "\r\n"
}
