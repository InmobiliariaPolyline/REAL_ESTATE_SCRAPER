# Lector de Adondevivir (en pausa)

Código para cargar avisos de adondevivir.com en `public.propiedades`. **Hoy no se puede usar en
producción**: el sitio protege sus páginas con una verificación anti-bots de Cloudflare y responde
`HTTP 403` (`cf-mitigated: challenge`) a los programas hechos con Node. No se ha intentado esquivar
esa protección, y no se recomienda hacerlo (riesgo de bloqueo de IP y de incumplir sus términos).

## Qué está hecho y probado

| Archivo | Función |
| ------- | ------- |
| `adondevivir.ts` | Lee el sitemap (lista oficial de avisos con su fecha de actualización) y extrae de cada página título, operación, tipo, precio en soles y dólares, área, dormitorios, baños, distrito y foto. Se detiene si el sitio dice 403/429. |
| `ingest.ts` | Valida y guarda los avisos con el UPSERT de `docs/INGESTA.md` (`creado_en` intacto, `ultima_vista_en` refrescada). |
| `run.ts` | Corrida completa: solo descarga lo nuevo o actualizado, con una petición por segundo, y marca como vistos los avisos que siguen publicados. `--dry` prueba sin tocar la base. |
| `fixtures/` y `*.test.ts` | Páginas y sitemap de ejemplo para probar sin red. |

```bash
pnpm test scraper          # pruebas sin red
pnpm scraper --dry --max 6 # prueba real en seco (hoy devuelve 403)
```

## Qué falta para usarlo

Acceso **autorizado** a los datos. Lo habitual en este negocio (así funcionan los agregadores) es que
el portal entregue un *feed* o una API a sus socios. Si Adondevivir (grupo Navent) da acceso, solo
habría que cambiar la forma de descargar en `fetchText` (`adondevivir.ts`) por la que indiquen
(clave de API, cabecera autorizada o lista de IP permitidas); el resto ya funciona.

Respeta siempre el `robots.txt` del sitio: prohíbe `/avisos-api/` y las páginas de listado a partir
de la 6; este código usa solo el sitemap y las páginas de aviso.
