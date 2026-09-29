/**
 * Pantalla de inicio: qué hace la herramienta, un presupuesto de ejemplo calculado con los precios de hoy,
 * cómo funciona (tres pasos con una animación corta), qué se obtiene (un mosaico con vistas reales del ejemplo)
 * y "Mis obras".
 */
import { estado } from "../estado/estado.js";
import { catalogo, insumo } from "../estado/catalogo.js";
import { historial } from "../estado/historial.js";
import { esc, num, pesos } from "../utilidades/formato.js";
import { duracion } from "../utilidades/cronometro.js";
import { revelar } from "../utilidades/revelar.js";
import { capitulosDe } from "../acciones/exportar.js";

/** Obra del ejemplo de la portada: se calcula al abrir la página, con los precios vigentes. */
export const EJEMPLO_INICIO = { elementos: [{ id: "ejemplo", tipo: "bano", cantidad: 1, medidas: { largo: 2, ancho: 1.5, alto: 2.4, sistema: "arcilla" } }] };

// Íconos de trazo (24 × 24) que toman el color del texto.
const trazo = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONOS = {
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

/** Atributos de algo que aparece al bajar por la página; `i` escalona la animación entre hermanos. */
const aparece = (clave, clases, i = 0) => `class="${clases} ${revelar(clave)}" data-revelar="${clave}" style="--i:${i}"`;
const cantidad = (n, unidad) => `${num.format(n)} ${esc(unidad)}${n !== 1 && unidad === "bulto" ? "s" : ""}`;
const cargandoVista = `<div class="vista vista-cargando" aria-hidden="true"><i></i><i></i><i></i></div>`;

/* ---------- Cómo funciona ---------- */
const PASOS_INICIO = [
  ["Describa la obra", "Con sus palabras. Entiende muros, baños, cocinas, cuartos, casas de un piso y remodelaciones."],
  ["Revise medidas y materiales", "Ajuste lo que incluye cada parte, las puertas y ventanas, y los materiales que ya tiene en la obra."],
  ["Obtenga el presupuesto", "Por capítulos, con el APU de cada ítem, el cronograma y la lista de compras, listo para descargar."]
];

/** Lo que muestra cada paso: la descripción que se escribe, las medidas que aparecen y el presupuesto por capítulos. */
function demoPaso(n, c) {
  if (n === 0) return `<span class="escribir"><span class="escribe">un baño de 2 × 1,5 m</span><span class="cursor"></span></span>`;
  if (n === 1) return `<span class="medidas-demo">${["Largo 2 m", "Ancho 1,5 m", "Alto 2,4 m", "Bloque de arcilla"]
    .map((t, i) => `<span style="--j:${i}">${t}</span>`).join("")}</span>`;
  if (!c) return "";
  const caps = capitulosDe(c.lineas), mayor = Math.max(...caps.map(k => k.subtotal), 1);
  return `<span class="columnas">${caps.map((k, i) => `<i style="--h:${Math.max(10, (k.subtotal / mayor) * 100)}%;--j:${i}"></i>`).join("")}</span>
    <b>${pesos.format(c.presupuesto.total)}</b>`;
}

function comoFunciona(c) {
  return `<section class="seccion-inicio">
    <h2>Cómo funciona</h2>
    <ol ${aparece("pasos", "linea-pasos")}>
      ${PASOS_INICIO.map(([titulo, texto], i) => `<li class="paso-linea" style="--i:${i}">
        <span class="paso-punto" aria-hidden="true">${i + 1}</span>
        <h3>${titulo}</h3><p>${texto}</p>
        <div class="demo demo-${i + 1}" aria-hidden="true">${demoPaso(i, c)}</div>
      </li>`).join("")}
    </ol>
  </section>`;
}

/* ---------- Qué obtiene: mosaico con vistas reales del ejemplo ---------- */
/** El APU de un ítem del ejemplo: insumos con cantidad, precio y parcial, hasta el costo unitario. */
function vistaApu(c) {
  const l = c?.lineas.find(x => x.codigo === "ACB-01") || c?.lineas.find(x => x.composicion.insumos?.length >= 4);
  if (!l) return cargandoVista;
  const filas = [...l.composicion.insumos.slice(0, 5).map(x => [insumo(x.id).nombre, `${cantidad(x.cantidad, insumo(x.id).unidad)} × ${pesos.format(x.precio)}`, x.parcial]),
    ["Herramienta menor", "5 % de la mano de obra", l.composicion.herramienta]];
  return `<div class="vista vista-apu">
    <p class="vista-titulo">${esc(l.item)} · ${esc(l.nombre)} <span>por ${esc(l.unidad)}</span></p>
    <ul>${filas.map(([nombre, detalle, valor], i) => `<li style="--j:${i}"><span>${esc(nombre)}<small>${detalle}</small></span><b>${pesos.format(valor)}</b></li>`).join("")}
      <li class="apu-total" style="--j:${filas.length}"><span>Costo unitario</span><b>${pesos.format(l.unitario)}</b></li></ul>
  </div>`;
}

/** Los primeros materiales por comprar; el primero se marca como comprado y baja lo que falta. */
function vistaCompras(c) {
  const lista = c ? c.compras.filter(x => x.tipo === "material").slice(0, 4) : [];
  if (!lista.length) return cargandoVista;
  const total = c.compras.reduce((s, x) => s + x.costo, 0);
  return `<div class="vista vista-compras">
    <ul>${lista.map((x, i) => `<li class="${i ? "" : "se-marca"}" style="--j:${i}"><span class="caja"></span>
      <span class="nom">${esc(x.nombre)}<small>${cantidad(x.cantidad, x.unidad)}</small></span><b>${pesos.format(x.costo)}</b></li>`).join("")}</ul>
    <p class="compras-falta"><span>Falta por comprar</span><b><span class="antes">${pesos.format(total)}</span><span class="despues">${pesos.format(total - lista[0].costo)}</span></b></p>
  </div>`;
}

/** Cronograma del ejemplo por fases: cuándo empieza y termina cada una. */
function vistaCronograma(c) {
  if (!c) return cargandoVista;
  const total = c.cronograma.avance.total || 1, faseDe = new Map(c.lineas.map(l => [l.codigo, l.fase])), fases = new Map();
  for (const t of c.cronograma.tramos) {
    const f = faseDe.get(t.codigo) || "Otras", a = fases.get(f), fin = t.inicio + t.dias;
    fases.set(f, a ? { inicio: Math.min(a.inicio, t.inicio), fin: Math.max(a.fin, fin) } : { inicio: t.inicio, fin });
  }
  return `<div class="vista vista-crono">
    <ul>${[...fases].map(([f, x], i) => `<li style="--j:${i}"><span>${esc(f)}</span>
      <span class="carril"><i style="left:${(x.inicio / total) * 100}%;width:${((x.fin - x.inicio) / total) * 100}%"></i></span></li>`).join("")}</ul>
    <p class="vista-pie">${num.format(total)} días hábiles, del replanteo a los acabados</p>
  </div>`;
}

const pieza = (clave, icono, titulo, texto, vista, i) => `<article ${aparece(clave, `pieza pieza-${clave}`, i)}>
    <div class="pieza-cab"><span class="icono">${ICONOS[icono]}</span><h3>${titulo}</h3></div>
    <p>${texto}</p>${vista}
  </article>`;

function queObtiene(c) {
  const oficiales = catalogo.listaOficial ? num.format(catalogo.listaOficial.total) : "3.500";
  return `<section class="seccion-inicio">
    <h2>Qué obtiene</h2>
    <p class="sub-seccion">Con el baño del ejemplo, calculado ahora con los precios de hoy.</p>
    <div class="mosaico">
      ${pieza("apu", "apu", "APU de cada ítem", "Insumos, cantidades, precios, rendimiento y cuadrilla, con la memoria de cantidades de dónde sale cada número.", vistaApu(c), 0)}
      ${pieza("cronograma", "cronograma", "Cronograma", "Duración de cada actividad y fecha de entrega. Marque lo hecho y se recalcula lo que falta.", vistaCronograma(c), 1)}
      ${pieza("precios", "precio", "Precios con fuente", "Cada precio dice de dónde sale y cuándo se consultó.",
        `<div class="pildoras"><span>Tiendas de Cali y Jamundí</span><span>Mano de obra con prestaciones 2026</span><span>Comparación con precios oficiales</span></div>`, 2)}
      ${pieza("oficial", "oficial", "Lista oficial de la Gobernación", "Para agregar lo que la herramienta no calcula: pintura, cubierta, carpintería…",
        `<div class="cifra-grande">${oficiales}<small>ítems con precio oficial</small></div>`, 0)}
      ${pieza("compras", "compras", "Lista de compras", "Cuánto comprar, cuánto cuesta y dónde. Marque lo comprado y baja lo que falta por invertir.", vistaCompras(c), 1)}
      ${pieza("excel", "excel", "Excel y PDF", "Para entregar al cliente: presupuesto con fórmulas, APU, memoria de cantidades, compras y cronograma.",
        `<div class="archivos"><span>Presupuesto.xlsx<small>5 hojas</small></span><span>Presupuesto.pdf<small>para imprimir</small></span></div>`, 2)}
    </div>
  </section>`;
}

export function pantallaInicio() {
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
    ${comoFunciona(estado.ejemploInicio)}
    ${queObtiene(estado.ejemploInicio)}
    <div class="fuentes-inicio">
      <span><b>Referencias oficiales:</b> Gobernación del Valle 2024 · Alcaldía de Cali 2026 · EMCALI 2025</span>
      <button class="enlace" data-vista="fuentes">¿De dónde salen los precios?</button>
    </div>
  </section>`;
}
