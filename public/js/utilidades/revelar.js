/**
 * Animación al bajar por la página: los elementos con la clase "revelar" y data-revelar="clave" aparecen cuando
 * entran en pantalla. Lo que ya apareció queda anotado, para no repetir la animación cada vez que la pantalla se
 * vuelve a dibujar. Sin IntersectionObserver todo se ve desde el comienzo.
 */
const vistos = new Set();
const soportado = typeof IntersectionObserver === "function";
let observador = null;

// El CSS solo oculta lo que falta por aparecer si el navegador sabe avisar cuándo aparece.
if (soportado) document.documentElement.classList.add("con-revelar");

/** Clases de un elemento que aparece al bajar: "revelar" y "ya" si ya apareció (se muestra sin animar). */
export const revelar = clave => `revelar${vistos.has(clave) ? " ya" : ""}`;

/** Después de dibujar: observa los elementos que todavía no han aparecido. */
export function observarRevelables(raiz) {
  observador?.disconnect();
  const pendientes = raiz.querySelectorAll(".revelar:not(.ya)");
  if (!soportado || !pendientes.length) return;
  observador = new IntersectionObserver(entradas => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("visible");
      vistos.add(e.target.dataset.revelar);
      observador.unobserve(e.target);
    }
  }, { threshold: 0.15 });
  pendientes.forEach(el => observador.observe(el));
}
