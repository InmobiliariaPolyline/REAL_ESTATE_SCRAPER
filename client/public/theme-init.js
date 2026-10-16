// Aplica el tema guardado antes del primer pintado para evitar el parpadeo.
// Es un archivo aparte (no un script en línea) porque la CSP solo permite script-src 'self'.
try {
  var t = localStorage.getItem("theme");
  var root = document.documentElement;
  if (t === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  }
} catch (e) {
  /* sin almacenamiento: se queda el tema oscuro por defecto */
}
