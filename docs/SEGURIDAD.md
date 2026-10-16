# Seguridad y operación

Guía práctica para mantener el sistema seguro y recuperable.

## 1. Qué protege el sistema

| Capa | Medida |
| ---- | ------ |
| Contraseñas | bcrypt en la base; mínimo 8 caracteres; las heredadas en texto plano se migran al iniciar sesión |
| Login | bloqueo tras 5 fallos en 15 min (también aplica al cambio de contraseña) |
| Sesiones | token opaco de 12 h validado en el servidor en cada petición; un baneo o un cambio de contraseña las cierra |
| Autorización | cada ruta de la API exige público / sesión / suscriptor vigente / admin |
| Datos | todo el SQL va parametrizado; los errores internos nunca llegan al cliente |
| Navegador | CSP estricta, sin scripts de terceros; URLs de avisos filtradas a http(s) |
| Auditoría | acciones administrativas registradas (pestaña **Auditoría**) |

## 2. Sesiones y auditoría

- **Mi cuenta** (perfil en la barra lateral o en la cabecera del portal): cambiar contraseña y ver los
  dispositivos con sesión abierta (navegador, sistema, IP, último uso). Se puede cerrar una sesión
  concreta o todas las demás.
- **Usuarios → botón de salida**: el admin cierra todas las sesiones de un usuario.
- **Auditoría**: quién creó o baneó usuarios, activó Premium, restableció contraseñas, eliminó
  propiedades, ejecutó la limpieza o lanzó el scraper. Nunca guarda contraseñas ni tokens. La tabla
  `auditoria` crece despacio; si algún día hace falta podarla:

  ```sql
  delete from public.auditoria where creado_en < now() - interval '1 year';
  ```

La IP se toma de `x-nf-client-connection-ip` (Netlify) o `x-forwarded-for` (proxy inverso).

## 3. Credenciales: dónde viven y cada cuánto rotarlas

| Credencial | Dónde está | Rotación |
| ---------- | ---------- | -------- |
| `DATABASE_URL` (app) | Variables de Netlify (secreta) | Cada 90 días y ante cualquier sospecha |
| `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` | Secrets de GitHub Actions | Cada 6 meses; guarda la frase de cifrado también fuera de GitHub |
| `GITHUB_PAT` (forzar scraper) | Variables de Netlify (secreta) | Token con caducidad y solo permiso *Actions: write* |
| `ALERT_WEBHOOK_URL`, `CRON_SECRET` | Variables de Netlify (secretas) | Si se filtran |
| Contraseña del admin | Base de datos (hash) | Desde **Mi cuenta** |

**Cómo rotar la contraseña de Neon:** *Neon → Roles → Reset password* → copiar la cadena nueva →
actualizar `DATABASE_URL` en Netlify (y el secret de backup) → *Trigger deploy* → comprobar
`/api/health`.

Nunca pegues cadenas de conexión en chats, issues ni commits. Si ocurre, rota la credencial de inmediato.

## 4. Acceso de solo lectura para Inmodata

Para que el ETL o una herramienta de BI lea los datos sin poder modificar nada, ejecuta
[`db/optional/inmodata_readonly.sql`](../db/optional/inmodata_readonly.sql) (cambiando antes la clave).
El rol `inmodata_ro` solo ve `propiedades` y `propiedades_precios` y tiene límites de tiempo y de
conexiones. Usa su propia cadena de conexión; la de la app no debe salir de Netlify.

## 5. Respaldos

Hay tres capas, de la más rápida a la más independiente:

1. **Restauración a un punto en el tiempo de Neon** (*Backup & Restore* en el panel): sirve para
   deshacer un borrado reciente. La ventana de retención depende del plan; revísala.
2. **Respaldo diario cifrado** (`.github/workflows/backup.yml`): `pg_dump` en formato personalizado,
   cifrado con AES-256 y guardado 14 días como artefacto de Actions. Secrets necesarios:
   `BACKUP_DATABASE_URL` (conexión **directa**, sin `-pooler`) y `BACKUP_PASSPHRASE`. Se puede lanzar a
   mano desde la pestaña *Actions → Respaldo de la base de datos → Run workflow*.
3. **Copia propia fuera de GitHub** (recomendado una vez al mes): descarga el artefacto y guárdalo en
   un disco o almacenamiento tuyo.

### Restaurar un respaldo

```bash
# 1. Descargar el artefacto "db-backup-N" de la ejecución en GitHub Actions y descomprimirlo.
# 2. Descifrar (te pedirá/leerá la frase BACKUP_PASSPHRASE):
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in backup-AAAA-MM-DD.dump.enc -out backup.dump

# 3. Restaurar en una base NUEVA (p. ej. una rama o proyecto nuevo de Neon), nunca sobre producción
#    sin haberlo probado antes:
pg_restore --no-owner --no-privileges --dbname "$NUEVA_DATABASE_URL" backup.dump

# 4. Comprobar tablas y conteos, y recién entonces apuntar DATABASE_URL de Netlify a la base nueva.
```

**Simulacro:** restaura un respaldo en una rama de prueba al menos una vez al trimestre. Un respaldo
que nunca se ha restaurado no es un respaldo.

## 6. Lista de comprobación periódica

- [ ] `/api/health` responde `ok` y el Dashboard muestra al scraper activo.
- [ ] Hay un respaldo reciente en *Actions* y la ejecución terminó en verde.
- [ ] Nadie con acceso admin que ya no deba tenerlo (pestaña *Usuarios*); revisar *Auditoría*.
- [ ] Credenciales dentro de su plazo de rotación (tabla de arriba).
- [ ] `pnpm audit` sin vulnerabilidades altas (dependencias).
