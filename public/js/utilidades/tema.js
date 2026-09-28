/**
 * Tema de color: automático (el del sistema), claro u oscuro. Se recuerda en este navegador.
 * index.html aplica el guardado antes de dibujar, para que no parpadee.
 */
const CLAVE = "presupuesto-obra-tema";
const TEMAS = [
  { id: "auto", icono: "◐", nombre: "automático" },
  { id: "claro", icono: "☀", nombre: "claro" },
  { id: "oscuro", icono: "☾", nombre: "oscuro" }
];

const leer = () => { try { return localStorage.getItem(CLAVE) || "auto"; } catch { return "auto"; } };

/** Aplica un tema y actualiza el botón de la barra. */
export function aplicarTema(id = leer()) {
  const tema = TEMAS.find(t => t.id === id) || TEMAS[0];
  if (tema.id === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = tema.id === "oscuro" ? "dark" : "light";
  const boton = document.querySelector("#tema");
  if (boton) {
    boton.textContent = tema.icono;
    boton.title = `Tema ${tema.nombre} (clic para cambiar)`;
    boton.setAttribute("aria-label", boton.title);
  }
}

/** Pasa al siguiente tema: automático → claro → oscuro. */
export function cambiarTema() {
  const siguiente = TEMAS[(TEMAS.findIndex(t => t.id === leer()) + 1) % TEMAS.length].id;
  try { localStorage.setItem(CLAVE, siguiente); } catch { /* sin almacenamiento: dura hasta recargar */ }
  aplicarTema(siguiente);
}
