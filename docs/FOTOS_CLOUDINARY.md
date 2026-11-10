# Copia de portadas en Cloudinary (gratis)

Por defecto las fotos se ven desde el portal de origen. Con Cloudinary, la **portada** de cada aviso se copia a una
cuenta propia, reducida a 720 px, para que siga viéndose aunque el portal borre el aviso. La galería del detalle sigue
apuntando al portal. No hace falta ninguna migración de base de datos.

## Activarlo (una vez)
1. Crear una cuenta gratis en cloudinary.com (no pide tarjeta).
2. En el panel (Settings → API Keys, o Dashboard → «API environment variable») copiar el valor
   `cloudinary://CLAVE:SECRETO@NOMBRE`.
3. En **Netlify → Environment variables** crear `CLOUDINARY_URL` con ese valor, marcada como **secreta**, y volver a
   desplegar.

Sin `CLOUDINARY_URL` no se copia nada y todo sigue como antes.

## Cómo funciona
- La función programada `copiar-portadas` corre **cada hora** y copia hasta 24 portadas pendientes (Cloudinary
  descarga la foto por su cuenta; Netlify no mueve imágenes).
- Cada portada ya copiada se reconoce por su dirección `res.cloudinary.com` y no se vuelve a tocar: una nueva lectura
  del portal no la reemplaza.
- Si una copia falla (el portal ya no tiene la foto, límite de Cloudinary), el aviso conserva la foto original y se
  reintenta más tarde.
- Ritmo aproximado: unas 570 portadas al día. Los avisos nuevos se van copiando en las horas siguientes a su carga.

## Límites del plan gratis
Cloudinary da unos 25 «créditos» al mes (1 crédito ≈ 1 GB de almacenamiento o de transferencia). Una portada a 720 px
pesa unos 60–100 KB, así que 10 000 avisos ocupan alrededor de 1 GB. Se revisa el uso en el panel de Cloudinary.

## Aviso
Las fotos pertenecen a los portales y a sus anunciantes. Copiarlas a una cuenta propia es un uso más fuerte que
enlazarlas: conviene revisar los términos de cada portal antes de comercializar el sistema.
