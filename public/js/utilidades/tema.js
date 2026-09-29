/**
 * Tema de color: claro u oscuro, con el botón de la barra. Empieza en claro y se recuerda en este navegador.
 * index.html aplica el guardado antes de dibujar, para que no parpadee.
 */
import { ICONO_SOL, ICONO_LUNA } from "./iconos.js";

const CLAVE = "presupuesto-obra-tema";
const TEMAS = {
  claro: { html: "light", icono: ICONO_SOL, color: "#FCFAF6", otro: "oscuro" },
  oscuro: { html: "dark", icono: ICONO_LUNA, color: "#171411", otro: "claro" }
};

const leer = () => { try { return localStorage.getItem(CLAVE) === "oscuro" ? "oscuro" : "claro"; } catch { return "claro"; } };

/** Aplica un tema y actualiza el botón de la barra y el color de la barra del navegador en el celular. */
export function aplicarTema(id = leer()) {
  const tema = TEMAS[id] || TEMAS.claro;
  document.documentElement.dataset.theme = tema.html;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema.color);
  const boton = document.querySelector("#tema");
  if (boton) {
    boton.innerHTML = tema.icono;
    boton.title = `Tema ${tema === TEMAS.oscuro ? "oscuro" : "claro"}: clic para pasar a ${tema.otro}`;
    boton.setAttribute("aria-label", boton.title);
  }
}

/** Cambia entre claro y oscuro (según el que se ve, por si el navegador no deja guardar). */
export function cambiarTema() {
  const siguiente = document.documentElement.dataset.theme === "dark" ? "claro" : "oscuro";
  try { localStorage.setItem(CLAVE, siguiente); } catch { /* sin almacenamiento: dura hasta recargar */ }
  aplicarTema(siguiente);
}
