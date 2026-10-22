# Carga automática de avisos con Apify

Guía para dejar funcionando la carga de avisos de Adondevivir. Son **5 pasos** y se hacen una sola vez.

> **Regla de oro:** no pongas tarjeta en Apify. El plan gratuito se bloquea al agotar su cupo
> mensual; sin un método de pago guardado, no pueden cobrarte.

## 1. Base de datos (Neon)

En el **SQL Editor** de Neon pega y ejecuta el contenido de `db/007_carga.sql` (es seguro repetirlo,
también si ya lo ejecutaste antes: añade la columna del día de reinicio). Crea la configuración
(empieza **pausada**) y el historial de cargas.

## 2. Cuenta de Apify

1. Entra en **Settings → API & Integrations** y pulsa **Create a new token** (ponle un nombre, por
   ejemplo `sistema-inmobiliario`). Cópialo: solo se muestra una vez.
2. En **Settings → Limits**, pon el tope de gasto mensual en **US$ 5 o menos**.
3. Abre el actor [gio21/adondevivir-scraper](https://apify.com/gio21/adondevivir-scraper) y haz una
   prueba manual con `maxItems` = 5 (cuesta centavos). Así aceptas sus condiciones y compruebas que
   funciona.

## 3. Variables en Netlify

*Site configuration → Environment variables → Add a variable*, con **Same value for all deploy
contexts**:

| Variable | Valor | Secret |
| -------- | ----- | ------ |
| `APIFY_TOKEN` | el token del paso 2 | **Sí** |
| `APIFY_WEBHOOK_SECRET` | una cadena larga al azar (30 o más caracteres) | **Sí** |

Para generar una cadena al azar: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
No pegues estos valores en chats ni en el repositorio.

Opcionales: `APIFY_ACTOR` (otro actor), `APIFY_COST_PER_1000` (si cambia el precio, por defecto 3),
`CARGA_URLS` (búsquedas de Adondevivir a rotar, separadas por comas).

## 4. Desplegar

*Deploys → Trigger deploy → Deploy project without cache*. Las variables nuevas solo se aplican tras
un despliegue.

## 5. Activar desde el sistema

*Sistema → Carga de datos* (administrador):

1. Deja **Máximo por corrida** en un valor pequeño (20) y pulsa **Cargar ahora** para la primera prueba.
2. A los pocos minutos aparecerá la corrida como *Completada* y los avisos en el catálogo.
3. Sube el máximo (200) y el tope mensual al valor que quieras.
4. Activa el interruptor **Carga automática**: cada lunes a las 09:00 (Lima) pedirá una tanda.

## Cómo funciona

```
Netlify (lunes 09:00 o botón) ──► Apify: ejecuta el scraper con límites
                                         │
Apify termina ──► aviso (webhook) ──► /api/internal/apify-webhook ──► guarda en Neon
```

- El token vive solo en el servidor. El aviso de Apify exige el secreto en la dirección.
- Cada corrida envía a Apify `maxItems` (avisos) y `maxTotalChargeUsd` (dólares): aunque algo
  fallara en este sistema, Apify corta por su cuenta.
- El tope mensual se **reserva antes** de pedir: se cuenta lo pedido hasta saber lo recibido.
- Nunca hay dos cargas a la vez; una corrida que no responde en 3 horas se da por perdida y su
  reserva se conserva.
- Si una corrida falla a medias, se guardan igualmente los avisos que alcanzó a entregar (ya se cobraron).

## Costos y topes (plan gratuito de Apify)

Datos de la cuenta y del actor (verifícalos si cambian):

- Plan **Free**: **US$ 5** de crédito prepagado por ciclo; no se acumula y **se reinicia un día fijo**
  (en esta cuenta, el 23; lo ves en Apify → Billing como «Limit resets on…»).
- Actor `gio21/adondevivir-scraper`: **US$ 3 por 1 000 avisos**; el uso de plataforma va incluido.
- Sin tarjeta guardada, al agotarse el crédito Apify bloquea la cuenta hasta el reinicio; no cobra.

Cómo lo aplica el sistema:

| Barrera | Valor con US$ 5 y US$ 3 por 1 000 |
| ------- | --------------------------------- |
| Tope mensual **máximo permitido** (90 % del crédito) | **1 500 avisos** (≈ US$ 4.50) |
| Tope por defecto | 1 000 avisos (≈ US$ 3.00) |
| Máximo por corrida | hasta 1 500; por defecto 200 |
| Ciclo de conteo | desde el último día de reinicio (configurable, por defecto 23) |
| Tope en dólares enviado a Apify en cada corrida | costo esperado + 10 % |

Si el crédito o el precio cambian, ajusta `APIFY_CREDIT_USD` y `APIFY_COST_PER_1000` en Netlify: el
máximo permitido se recalcula solo.

## Si algo falla

| Síntoma | Causa probable |
| ------- | -------------- |
| Aviso amarillo «Falta conectar Apify» | Faltan `APIFY_TOKEN` o `APIFY_WEBHOOK_SECRET`, o no se redesplegó. |
| La corrida queda «En curso» y nunca termina | El aviso de Apify no llega: revisa que `APIFY_WEBHOOK_SECRET` sea el mismo en Netlify y que el sitio sea https. A las 3 horas se marca como fallida. |
| «Fallida: No se pudo lanzar en Apify» | Token inválido o cuenta bloqueada por haber agotado el cupo del mes. |
| Recibidos 0 | El actor no encontró avisos o Adondevivir cambió su página: prueba el actor a mano en Apify. |

## Aviso legal

El actor es de un tercero y obtiene los datos de un sitio que no autoriza expresamente su
extracción. Antes de ofrecer estos datos a clientes de pago, conviene hablar con Adondevivir
(grupo Navent) sobre un acuerdo de acceso. Ver `docs/INGESTA.md`.
