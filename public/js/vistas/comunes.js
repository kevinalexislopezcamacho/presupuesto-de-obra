/**
 * Piezas de interfaz que usan varias pantallas.
 */
import { estado } from "../estado/estado.js";
import { catalogo, apu, insumo, nombreCantidad, nombreCortoApu, unidadApu, singular, medidasPorDefecto } from "../estado/catalogo.js";
import { esc, num, mayus, listaY, conTildes, cantU } from "../utilidades/formato.js";

/** Barra inferior con "Atrás" y el botón principal. `atras` son los atributos del botón (ej.: 'data-ir="obra"'). */
export const nav = (atras, principal = "") =>
  `<div class="nav">${atras ? `<button class="enlace" ${atras}>Atrás</button>` : "<span></span>"}${principal}</div>`;

/** "4 muros de 3 × 2,5 m", "Baño de 2 × 1,5 m" */
export function describirElemento(el) {
  const m = el.medidas, x = v => num.format(v || 0);
  const medida = el.tipo === "muro" ? `${x(m.largo)} × ${x(m.alto)} m` : `${x(m.largo)} × ${x(m.ancho)} m`;
  return `${el.cantidad > 1 ? nombreCantidad(el.tipo, el.cantidad) : mayus(singular(el.tipo))} de ${medida}`;
}

/** "2 puertas en arco", "ventana circular". */
function nombreHueco(h) {
  const varias = h.cantidad > 1;
  const forma = h.forma === "arco" ? " en arco" : h.forma === "circular" ? (varias ? " circulares" : " circular") : "";
  return `${varias ? `${h.cantidad} ` : ""}${h.tipo}${varias ? "s" : ""}${forma}`;
}

/** Nombre corto de una actividad para listas ("Muros" vale para arcilla y concreto). */
export const nombreActividad = codigo => (codigo.startsWith("MAM") ? "Muros" : apu(codigo)?.corto || nombreCortoApu(codigo));

/** Nombre sugerido para guardar la obra. */
export function nombrePorDefecto() {
  const partes = estado.elementos.map(describirElemento);
  if (!partes.length && estado.extras.length) partes.push(estado.extras.map(x => nombreCortoApu(x.codigo)).join(" + "));
  const nombre = partes.join(" + ") || "Obra";
  return nombre.length > 80 ? `${nombre.slice(0, 77)}…` : nombre;
}

/** Quién entendió el texto: la IA o las reglas. */
export function insigniaMotor(res) {
  if (!res?.motor) return "";
  return res.motor === "ia"
    ? `<span class="insignia ia" title="Interpretado con ${esc(res.proveedor || "IA")} (${esc(res.modelo || "")}) y verificado por la herramienta">IA · ${esc(res.proveedor || "")}</span>`
    : `<span class="insignia" title="Interpretado con el intérprete por reglas">Reglas</span>`;
}

/** Lista legible de lo que entendió el intérprete. */
export function resumenInterpretacion(res) {
  const partes = res.partes.map(p => {
    const medidas = Object.keys(p.medidas).length
      ? ` (${describirElemento({ tipo: p.tipo, cantidad: 1, medidas: { ...medidasPorDefecto(p.tipo), ...p.medidas } }).split(" de ").slice(1).join(" de ")})` : "";
    const propias = catalogo.tipos[p.tipo]?.actividades || [];
    const sin = [...new Set((p.excluir || []).filter(c => propias.includes(c)).map(nombreActividad))];
    const fuente = conTildes(p.fuente.replace(/“|”/g, "")).replace(/la palabra (\w+)/, (_, w) => `la palabra “${conTildes(w)}”`);
    // Solo las puertas y ventanas que se nombraron (no las típicas que se conservan).
    const huecos = (p.huecos || []).filter(h => h.forma !== "rectangular" || !(h.porDefecto || []).length).map(nombreHueco);
    return `<li><b>${nombreCantidad(p.tipo, p.cantidad)}</b>${medidas}${p.sistema ? ` en bloque de ${p.sistema}` : ""}${huecos.length ? ` con ${esc(listaY(huecos))}` : ""}${sin.length ? ` · <span class="sin">sin ${esc(listaY(sin.map(s => s.toLowerCase())))}</span>` : ""} <small>· por ${esc(fuente)}</small></li>`;
  });
  const trabajos = res.trabajos.map(t => `<li><b>${esc(nombreCortoApu(t.codigo))}</b>${t.cantidad
    ? ` (${t.detalle ? `${esc(t.detalle)} = ` : ""}${num.format(t.cantidad)} ${unidadApu(t.codigo)})`
    : " <small>· falta la cantidad</small>"}</li>`);
  const materiales = (res.materiales || []).map(m => `<li>Disponible en obra: <b>${m.id ? esc(insumo(m.id).nombre) : esc(m.texto)}</b>${m.id && m.cantidad > 0 ? ` (${cantU(m.cantidad, insumo(m.id).unidad)})` : ""}${m.nota ? ` <small>· ${esc(m.nota)}</small>` : ""}</li>`);
  return partes.concat(trabajos, materiales).join("");
}

/** Pedidos que no se pudieron aplicar tal cual y números que la IA propuso pero no estaban en el texto. */
export function notasInterpretacion(res, observaciones = res.observaciones || []) {
  const obs = observaciones.map(o => `<li>${o.texto ? `<b>“${esc(o.texto)}”</b>: ` : ""}${esc(o.nota)}</li>`).join("");
  const verif = (res.verificacion || []).map(v => `<li>${esc(v)}</li>`).join("");
  return `${obs ? `<div class="observaciones"><p class="etiqueta">Pedidos que conviene revisar</p><ul>${obs}</ul></div>` : ""}
    ${verif ? `<details class="verificacion"><summary>La herramienta descartó ${res.verificacion.length === 1 ? "un dato que no estaba" : `${res.verificacion.length} datos que no estaban`} en la descripción</summary><ul>${verif}</ul></details>` : ""}
    ${res.avisoIA ? `<p class="nota">${esc(res.avisoIA)}</p>` : ""}`;
}

/** "La herramienta todavía no calcula techos ni pintura." */
export const notaNoCalculado = (res, estilo) => (res.noSoportado.length
  ? `<p class="nota" style="${estilo}">La herramienta todavía no calcula ${esc(listaY(res.noSoportado.map(x => x.replace(/ \(.*\)/, ""))))}${res.noSoportado.some(x => x.startsWith("más de un piso")) ? "; el presupuesto es para un solo piso" : ""}. Se pueden agregar desde la <button class="enlace" data-vista="oficial">lista oficial de la Gobernación</button> o, en Medidas, como ítem cotizado.</p>`
  : "");

/** Mensaje mientras llega el cálculo del backend. */
export const cargando = (texto = "Calculando…") => `<p class="cargando" role="status">${texto}</p>`;

/** Mensaje mientras se espera a la IA, con animación. */
export const ocupado = () => (estado.ocupado ? `<p class="ocupado" role="status"><span class="girando" aria-hidden="true"></span>${esc(estado.ocupado)}</p>` : "");
