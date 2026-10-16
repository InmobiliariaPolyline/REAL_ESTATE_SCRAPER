// Aplica el tema y las preferencias guardadas antes del primer pintado para evitar el parpadeo.
// Es un archivo aparte (no un script en línea) porque la CSP solo permite script-src 'self'.
try {
  var root = document.documentElement;
  if (localStorage.getItem("theme") === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  }

  var p = JSON.parse(localStorage.getItem("prefs") || "null") || {};
  var ACCENTS = ["teal", "blue", "violet", "green", "amber"];
  if (ACCENTS.indexOf(p.accent) !== -1) root.setAttribute("data-accent", p.accent);
  if (p.scale === "compact" || p.scale === "large") root.setAttribute("data-scale", p.scale);
  if (p.motion === "reduced") root.setAttribute("data-motion", "reduced");
  if (p.ambient === false) root.setAttribute("data-ambient", "off");
} catch (e) {
  /* sin almacenamiento o datos inválidos: se queda el aspecto por defecto */
}
