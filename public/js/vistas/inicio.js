/**
 * Pantalla de inicio: qué hace la herramienta, un presupuesto de ejemplo calculado con los precios de hoy,
 * cómo funciona, qué se obtiene y "Mis obras".
 */
import { estado } from "../estado/estado.js";
import { catalogo } from "../estado/catalogo.js";
import { historial } from "../estado/historial.js";
import { esc, num, pesos } from "../utilidades/formato.js";
import { duracion } from "../utilidades/cronometro.js";
import { capitulosDe } from "../acciones/exportar.js";

/** Obra del ejemplo de la portada: se calcula al abrir la página, con los precios vigentes. */
export const EJEMPLO_INICIO = { elementos: [{ id: "ejemplo", tipo: "bano", cantidad: 1, medidas: { largo: 2, ancho: 1.5, alto: 2.4, sistema: "arcilla" } }] };

// Íconos de trazo (24 × 24) que toman el color del texto.
const trazo = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONOS = {
  escribir: trazo('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  revisar: trazo('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  resultado: trazo('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>'),
  apu: trazo('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>'),
  precio: trazo('<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  cronograma: trazo('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3M8 17h6"/>'),
  compras: trazo('<path d="M3 4h2l2.5 11h11L21 7H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>'),
  oficial: trazo('<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6"/><path d="M3 21h18"/>'),
  excel: trazo('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M12 12v6m0 0l-2.5-2.5M12 18l2.5-2.5"/>')
};

const fecha = iso => { try { return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };

/** Tarjeta con un presupuesto real: el baño del ejemplo, sus capítulos más costosos y su duración. */
function ejemplo() {
  const c = estado.ejemploInicio;
  if (!c) return `<div class="ejemplo cargando" aria-hidden="true">Calculando un ejemplo…</div>`;
  const caps = capitulosDe(c.lineas).sort((a, b) => b.subtotal - a.subtotal).slice(0, 4);
  const mayor = caps[0]?.subtotal || 1;
  return `<figure class="ejemplo" aria-label="Ejemplo de presupuesto">
    <div class="ejemplo-cab"><span>Baño de 2 × 1,5 m</span><span class="tag">Ejemplo</span></div>
    <div class="ejemplo-total">${pesos.format(c.presupuesto.total)}</div>
    <p class="ejemplo-datos">Costo directo · ${num.format(c.cronograma.avance.total)} días hábiles · ${c.lineas.length} ítems con APU</p>
    <ul class="barras">${caps.map(k => `<li><span>${esc(k.nombre)}</span><b>${pesos.format(k.subtotal)}</b>
      <span class="barra"><i style="width:${Math.max(6, (k.subtotal / mayor) * 100)}%"></i></span></li>`).join("")}</ul>
    <figcaption class="ejemplo-pie">Calculado ahora con los precios de hoy.</figcaption>
  </figure>`;
}

function misObras() {
  if (!historial.lista.length) return "";
  return `<div class="seccion mis-obras"><h2>Mis obras</h2>
    <p>Guardadas en este navegador: siguen aquí al volver a entrar desde este dispositivo, sin iniciar sesión. Se pueden abrir para ver el detalle, marcar avances o modificarlas.</p>
    <div class="filas">${historial.lista.map(o => `<div class="fila">
      <span class="nom">${esc(o.nombre)}<small>${fecha(o.actualizada)}${o.resumen.avance ? ` · ${o.resumen.avance} % hecho` : ""}${o.resumen.dias ? ` · faltan ${num.format(o.resumen.dias)} días` : ""}${o.ejecucion === "contratista" ? " · con AIU" : ""}${o.tiempo?.ms ? ` · elaborado en ${duracion(o.tiempo.ms)}` : ""}</small></span>
      <span class="val">${historial.borrar === o.id
        ? `<button class="btn peligro chico" data-borrar-si="${esc(o.id)}">Borrar</button> <button class="enlace" data-borrar-no="1">Cancelar</button>`
        : `<b>${pesos.format(o.resumen.total || 0)}</b><br><button class="enlace" data-abrir="${esc(o.id)}">Abrir</button> · <button class="enlace" data-borrar="${esc(o.id)}">Borrar</button>`}</span>
    </div>`).join("")}</div>
    <div class="acciones" style="margin-top:14px"><button class="enlace" data-accion="descargar-tiempos">Descargar tiempos de elaboración (CSV, para la validación)</button></div></div>`;
}

const tarjeta = (icono, titulo, texto, extra = "") =>
  `<div class="tarjeta-inicio"><span class="icono">${ICONOS[icono]}</span>${extra}<h3>${titulo}</h3><p>${texto}</p></div>`;

export function pantallaInicio() {
  const oficiales = catalogo.listaOficial ? num.format(catalogo.listaOficial.total) : "3.500";
  return `<section class="inicio">
    <div class="hero">
      <div class="hero-texto">
        <p class="kicker">Para arquitectos · Cali, Valle del Cauca</p>
        <h1>Su presupuesto de obra en minutos, no en días.</h1>
        <p class="sub">Describa la obra con sus palabras y obtenga el presupuesto por capítulos con el APU de cada ítem, el cronograma y la lista de compras, con precios de tiendas de Cali y la lista oficial de la Gobernación del Valle.</p>
        <div class="hero-acciones">
          <button class="btn" data-accion="nueva">${historial.lista.length ? "Nueva obra" : "Empezar un presupuesto"}</button>
          <button class="btn sec" data-vista="oficial">Consultar la lista oficial</button>
        </div>
        <p class="hero-nota">Sin registrarse · las obras quedan guardadas en este dispositivo</p>
      </div>
      ${ejemplo()}
    </div>
    ${estado.mensaje ? `<p class="aviso ok" role="status">${esc(estado.mensaje)}</p>` : ""}
    ${misObras()}
    <section class="seccion-inicio">
      <h2>Cómo funciona</h2>
      <div class="pasos-inicio">
        ${tarjeta("escribir", "Describa la obra", "Con sus palabras: «un baño de 2 × 1,5 y 3 muros de 4 × 2,5». Entiende muros, baños, cocinas, cuartos, casas de un piso y remodelaciones.", '<span class="paso-num">Paso 1</span>')}
        ${tarjeta("revisar", "Revise medidas y materiales", "Ajuste lo que incluye cada parte, las puertas y ventanas, y los materiales que ya tiene en la obra.", '<span class="paso-num">Paso 2</span>')}
        ${tarjeta("resultado", "Obtenga el presupuesto", "Por capítulos, con el APU de cada ítem, el cronograma y la lista de compras, listo para descargar.", '<span class="paso-num">Paso 3</span>')}
      </div>
    </section>
    <section class="seccion-inicio">
      <h2>Qué obtiene</h2>
      <div class="funciones">
        ${tarjeta("apu", "APU de cada ítem", "Insumos, cantidades, precios, rendimiento y cuadrilla, con la memoria de cantidades de dónde sale cada número.")}
        ${tarjeta("precio", "Precios con fuente", "Materiales de varias tiendas de Cali y Jamundí, mano de obra con prestaciones 2026 y comparación con precios oficiales.")}
        ${tarjeta("cronograma", "Cronograma", "Duración de cada actividad y fecha de entrega. Marque lo que ya está hecho y se recalcula lo que falta.")}
        ${tarjeta("compras", "Lista de compras", "Cuánto comprar, cuánto cuesta y dónde. Marque lo comprado y baja lo que falta por invertir.")}
        ${tarjeta("oficial", "Lista oficial de la Gobernación", `${oficiales} ítems con precio oficial para agregar lo que la herramienta no calcula: pintura, cubierta, carpintería…`)}
        ${tarjeta("excel", "Excel y PDF", "Presupuesto con fórmulas, APU, memoria de cantidades, compras y cronograma, para entregar al cliente.")}
      </div>
    </section>
    <div class="fuentes-inicio">
      <span><b>Referencias oficiales:</b> Gobernación del Valle 2024 · Alcaldía de Cali 2026 · EMCALI 2025</span>
      <button class="enlace" data-vista="fuentes">¿De dónde salen los precios?</button>
    </div>
  </section>`;
}
