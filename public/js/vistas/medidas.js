/**
 * Paso 2: medidas de cada parte de la obra, qué incluye cada una y trabajos sueltos.
 */
import { estado, PANTALLA } from "../estado/estado.js";
import { catalogo, insumo, nombreApu, unidadApu, singular } from "../estado/catalogo.js";
import { esc, num, pesos, mayus, normalizar } from "../utilidades/formato.js";
import { nav, resumenInterpretacion, notaNoCalculado, notasInterpretacion, insigniaMotor, nombreActividad, cargando } from "./comunes.js";

const NOTA_TIPO = {
  muro: "Columnas de confinamiento cada 3 m. La excavación, el solado y el retiro de sobrantes salen de la viga de cimentación.",
  bano: "Con 4 puntos de agua y desagüe, una puerta y una ventana pequeña.",
  cocina: "Con 2 puntos de agua y desagüe, una puerta y dos ventanas pequeñas.",
  cuarto: "Con una puerta y una ventana; pañete por dentro y por fuera.",
  casa: "Un piso en obra gris con acabados básicos. No incluye cubierta, redes eléctricas ni carpintería."
};

// Cómo se mide la cantidad de algunos trabajos sueltos.
const AYUDA_CANTIDAD = {
  "CON-01": "Metros lineales: número de columnas × alto de cada una",
  "CON-02": "Metros lineales: largo total de las vigas",
  "CON-04": "Metros cúbicos: cada zapata de 0,60 × 0,60 × 0,40 m son 0,144 m³"
};

// Lo que se descuenta si no se detallan las puertas y ventanas.
const HUECOS_SIN_DETALLE = {
  muro: "el área escrita arriba", bano: "una puerta y una ventana pequeña típicas", cocina: "una puerta y dos ventanas pequeñas típicas",
  cuarto: "una puerta y una ventana típicas", casa: "un 12 % del área de muros"
};
const FORMAS = [["rectangular", "Rectangular"], ["arco", "En arco"], ["circular", "Circular"]];
const opciones = (lista, actual) => lista.map(([v, t]) => `<option value="${v}" ${v === actual ? "selected" : ""}>${t}</option>`).join("");

/** Puertas y ventanas con su forma: el área de cada una la calcula el servidor y se descuenta del muro. */
function huecosElemento(el) {
  const calc = estado.calculo?.elementos.find(v => v.id === el.id);
  if (!el.huecos.length) {
    return `<div class="huecos"><button class="enlace" data-agregar-hueco="${el.id}">Detallar puertas y ventanas (forma y medidas)</button>
      <small>Si no se detallan, se descuenta ${HUECOS_SIN_DETALLE[el.tipo]}.</small></div>`;
  }
  const filas = el.huecos.map((h, k) => {
    const ejemplo = c => ((h.porDefecto || []).includes(c) ? " <span class='tag'>de ejemplo</span>" : "");
    const id = c => `h-${el.id}-${k}-${c}`, datos = c => `data-hueco="${el.id}" data-indice="${k}" data-campo="${c}"`;
    const medida = (c, etiqueta) => `<label class="campo"><span>${etiqueta}${ejemplo(c)}</span>
      <input id="${id(c)}" ${datos(c)} type="number" min="0" step="0.01" inputmode="decimal" value="${h[c]}"></label>`;
    const medidas = h.forma === "circular" ? medida("diametro", "Diámetro (m)")
      : medida("ancho", "Ancho (m)") + medida("alto", h.forma === "arco" ? "Alto total (m)" : "Alto (m)");
    const area = calc?.huecos[k]?.area;
    return `<div class="campos hueco">
      <label class="campo"><span>Qué es</span><select id="${id("tipo")}" ${datos("tipo")}>${opciones([["puerta", "Puerta"], ["ventana", "Ventana"]], h.tipo)}</select></label>
      <label class="campo"><span>Forma</span><select id="${id("forma")}" ${datos("forma")}>${opciones(FORMAS, h.forma)}</select></label>
      ${medidas}
      <label class="campo"><span>Cuántas</span><input id="${id("cantidad")}" ${datos("cantidad")} type="number" min="1" step="1" inputmode="numeric" value="${h.cantidad}"></label>
      <div class="hueco-area">${area !== undefined ? `<b>${num.format(area * h.cantidad)} m²</b>` : ""}<button class="enlace" data-quitar-hueco="${el.id}" data-indice="${k}">Quitar</button></div>
    </div>`;
  }).join("");
  return `<div class="huecos">
    <p class="etiqueta">Puertas y ventanas${calc ? ` · se descuentan ${num.format(calc.areaHuecos)} m² de muro` : ""}</p>
    ${filas}
    <button class="enlace" data-agregar-hueco="${el.id}">+ Agregar otra puerta o ventana</button>
    <p class="nota">Reemplazan ${HUECOS_SIN_DETALLE[el.tipo]}${el.tipo === "casa" ? ": incluya todas las de la casa" : ""}. “En arco” es de medio punto: el alto total va del piso a lo más alto del arco. Se descuenta el hueco del bloque, el pañete y el enchape. La hoja de la puerta o de la ventana y el arco se agregan abajo como ítem cotizado, o desde la lista oficial (por ejemplo, busque “arco”).</p>
  </div>`;
}

/** Lo que incluye la parte: cada actividad se puede quitar ("los muros ya existen", "sin enchape"). */
function actividadesElemento(el) {
  // Solo lo que esta parte calcula de verdad y lo que se quitó (para poder volver a incluirlo): lo que depende
  // de algo quitado (la excavación sin viga de cimentación, la demolición de un piso que no se cambia) no aparece.
  const generadas = estado.calculo?.elementos.find(v => v.id === el.id)?.actividades;
  const actividades = [...(el.remodelacion ? catalogo.demoliciones : []), ...catalogo.tipos[el.tipo].actividades]
    .filter(c => !generadas || generadas.includes(c) || el.excluir.includes(c));
  const chips = actividades.map(codigo => {
    const incluida = !el.excluir.includes(codigo);
    return `<button class="chip toggle" data-alternar="${el.id}" data-codigo="${codigo}" aria-pressed="${incluida}" title="${incluida ? "Clic para quitarla" : "Clic para incluirla"}">${esc(nombreActividad(codigo))}</button>`;
  }).join("");
  const quitadas = actividades.filter(c => el.excluir.includes(c)).length;
  const remodelar = el.tipo === "muro" ? "" : `<button class="chip toggle-remodel" data-remodelacion="${el.id}" aria-pressed="${Boolean(el.remodelacion)}" title="El espacio ya existe: no se cobran muros, estructura ni placa, y se agregan las demoliciones">Remodelación (el espacio ya existe)</button>`;
  return `<div class="incluye-el">${remodelar ? `<div class="chips" style="margin-bottom:10px">${remodelar}</div>` : ""}<p class="etiqueta">Incluye${quitadas ? ` (${quitadas} ${quitadas === 1 ? "actividad quitada" : "actividades quitadas"})` : ""} · toque una actividad para quitarla o incluirla</p><div class="chips">${chips}</div></div>`;
}

function tarjetaElemento(el, validacion) {
  const mismos = estado.elementos.filter(x => x.tipo === el.tipo);
  const titulo = mayus(singular(el.tipo)) + (mismos.length > 1 ? ` ${mismos.indexOf(el) + 1}` : "");
  const puedeQuitar = estado.elementos.length > 1 || estado.extras.length || estado.cotizados.length;
  const marca = c => (el.estimadas.includes(c) ? " <span class='tag aviso-tag'>estimado</span>"
    : (el.porDefecto || []).includes(c) ? " <span class='tag' title='No se indicó en la descripción: revise este valor'>de ejemplo</span>" : "");
  const campo = (c, etiqueta) => (c === "vanos" && el.huecos.length
    // Con las puertas y ventanas detalladas, el área sale de ellas.
    ? `<label class="campo"><span>${etiqueta}</span><input id="m-${el.id}-vanos" type="number" disabled value="${estado.calculo?.elementos.find(v => v.id === el.id)?.areaHuecos ?? ""}" title="Se calcula con las puertas y ventanas detalladas abajo"></label>`
    : `<label class="campo"><span>${etiqueta}${c === "vanos" || c === "banos" ? "" : " (m)"}${marca(c)}</span>
      <input id="m-${el.id}-${c}" data-el="${el.id}" data-medida="${c}" type="number" min="0" step="${c === "banos" ? 1 : 0.01}" inputmode="decimal" value="${el.medidas[c] ?? ""}"></label>`);
  return `<div class="elemento">
    <div class="el-cab"><h3>${titulo}</h3>${puedeQuitar ? `<button class="enlace" data-quitar-elemento="${el.id}">Quitar</button>` : ""}</div>
    <div class="campos">
      <label class="campo">Cuántos iguales<input id="c-${el.id}" data-cantidad-elemento="${el.id}" type="number" min="1" step="1" inputmode="numeric" value="${el.cantidad}"></label>
      ${catalogo.tipos[el.tipo].campos.map(([c, etiqueta]) => campo(c, etiqueta)).join("")}
      <label class="campo">Tipo de bloque<select id="m-${el.id}-sistema" data-el="${el.id}" data-medida="sistema">
        <option value="arcilla" ${el.medidas.sistema === "arcilla" ? "selected" : ""}>Arcilla N.º 5</option>
        <option value="concreto" ${el.medidas.sistema === "concreto" ? "selected" : ""}>Concreto</option></select></label>
    </div>
    ${huecosElemento(el)}
    ${actividadesElemento(el)}
    <p class="nota">${NOTA_TIPO[el.tipo]}${el.estimadas.length ? " Largo y ancho estimados a partir del área escrita: ajústelos si es necesario." : ""}</p>
    ${validacion.errores.map(e => `<p class="error">${esc(e)}</p>`).join("")}
    ${validacion.advertencias.map(a => `<p class="reco"><b>Recomendación:</b> ${esc(a)}</p>`).join("")}
  </div>`;
}

function trabajosSueltos() {
  if (!estado.extras.length) return "";
  return `<div class="bloque"><p class="etiqueta">Trabajos sueltos</p><div class="filas">${estado.extras.map(x => `<div class="fila con-campo${x.cantidad > 0 ? "" : " pendiente"}${x.nota ? " mat" : ""}">
      <span class="nom">${esc(nombreApu(x.codigo))}${x.cantidad > 0 ? (AYUDA_CANTIDAD[x.codigo] ? `<small>${AYUDA_CANTIDAD[x.codigo]}</small>` : "") : "<small>Escriba la cantidad para incluirlo</small>"}</span>
      <span class="val"><input class="cant" id="ex-${x.codigo}" data-extra="${x.codigo}" type="number" min="0" step="any" inputmode="decimal" value="${x.cantidad || ""}" placeholder="0" aria-label="Cantidad de ${esc(nombreApu(x.codigo))}"><span class="uni">${unidadApu(x.codigo)}</span>
      <button class="enlace" data-quitar-trabajo="${x.codigo}">quitar</button></span>${x.nota ? `<p class="reco"><b>Ojo:</b> ${esc(x.nota)}</p>` : ""}</div>`).join("")}</div></div>`;
}

/** Lo que no está en la herramienta ni en la lista oficial, con el precio de una cotización. */
function itemsCotizados() {
  const n = estado.nuevoCotizado, unidades = catalogo.unidadesCotizado || ["und"];
  const total = x => estado.calculo?.lineas.find(l => l.codigo === `COT-${x.id}`)?.total;
  const lista = estado.cotizados.map(x => `<div class="fila con-campo cotizado">
      <span class="nom">${esc(x.nombre)}<small>${x.fuente ? esc(x.fuente) : "Cotización"}</small></span>
      <span class="val">
        <label class="campo-cant"><span>Cantidad (${esc(x.unidad)})</span><input class="cant" id="cq-${x.id}" data-cotizado="${x.id}" data-campo="cantidad" type="number" min="0" step="any" inputmode="decimal" value="${x.cantidad}"></label>
        <label class="campo-cant"><span>Valor unitario</span><input class="cant" id="cp-${x.id}" data-cotizado="${x.id}" data-campo="precio" type="number" min="0" step="1" inputmode="numeric" value="${x.precio}"></label>
        <b class="total-cotizado">${total(x) !== undefined ? pesos.format(total(x)) : ""}</b>
        <button class="enlace" data-quitar-cotizado="${x.id}">Quitar</button></span></div>`).join("");
  return `<div class="bloque cotizados">
    <p class="etiqueta">Ítems cotizados</p>
    <p class="nota" style="margin-top:0">Para lo que no está en la herramienta ni en la lista oficial (una puerta en arco, una reja a la medida…): escriba lo que cobra quien lo cotizó. Va al presupuesto en el capítulo “Ítems cotizados”.</p>
    ${lista ? `<div class="filas">${lista}</div>` : ""}
    <div class="form-cotizado">
      <label class="campo cot-nombre"><span>Descripción</span><input id="cot-nombre" type="text" maxlength="150" placeholder="Ej.: puerta en arco en madera, con marco e instalación" value="${esc(n.nombre)}"></label>
      <label class="campo"><span>Unidad</span><select id="cot-unidad">${unidades.map(u => `<option value="${esc(u)}" ${n.unidad === u ? "selected" : ""}>${esc(u)}</option>`).join("")}</select></label>
      <label class="campo"><span>Cantidad</span><input id="cot-cantidad" type="number" min="0" step="any" inputmode="decimal" value="${esc(n.cantidad)}"></label>
      <label class="campo"><span>Valor unitario ($)</span><input id="cot-precio" type="number" min="0" step="1" inputmode="numeric" value="${esc(n.precio)}"></label>
      <label class="campo cot-fuente"><span>Quién lo cotizó (opcional)</span><input id="cot-fuente" type="text" maxlength="150" placeholder="Ej.: Carpintería El Roble, 27 de septiembre" value="${esc(n.fuente)}"></label>
      <div class="cot-boton"><button class="btn sec chico" data-accion="agregar-cotizado">Agregar al presupuesto</button></div>
    </div>
    ${n.error ? `<p class="error">${esc(n.error)}</p>` : ""}
  </div>`;
}

function catalogoDeTrabajos(calculo) {
  const q = normalizar(estado.busqueda.trim());
  const visibles = catalogo.apu.filter(a => !q || normalizar([a.nombre, a.corto, a.categoria, ...a.insumos.map(i => insumo(i.id).nombre)].join(" ")).includes(q));
  return `<details id="det-cat" ${estado.abrirCatalogo ? "open" : ""}>
    <summary>${calculo.lineas.length ? `Ver las ${calculo.lineas.length} actividades calculadas o agregar un trabajo suelto` : "Agregar un trabajo suelto (pañete, piso, enchape…)"}</summary>
    ${calculo.lineas.length ? `<div class="filas">${calculo.lineas.map(l => `<div class="fila"><span class="nom">${esc(l.nombre)}</span><span class="val">${num.format(l.cantidad)} ${l.unidad}</span></div>`).join("")}</div>` : ""}
    <input class="buscar" id="busqueda" type="search" placeholder="Buscar una actividad para agregar (ej.: cerámica)" value="${esc(estado.busqueda)}" aria-label="Buscar trabajo">
    <div class="filas" id="catalogo">${visibles.map(a => `<div class="fila con-campo"><span class="nom">${esc(a.nombre)}<small>${pesos.format(a.unitario)} por ${a.unidad}</small></span>
      <span class="val"><input class="cant" id="x-${a.codigo}" type="number" min="0" step="any" inputmode="decimal" placeholder="${a.unidad}" aria-label="Cantidad de ${esc(a.nombre)}"> <button class="btn sec chico" data-agregar-trabajo="${a.codigo}">Agregar</button></span></div>`).join("")}</div>
  </details>`;
}

/** Lo que se entendió de la descripción, con los pedidos que conviene revisar. */
function entendido() {
  const i = estado.interpretacion;
  if (!i || !(i.res.partes.length || i.res.trabajos.length || (i.res.materiales || []).length)) return "";
  return `<div class="aviso"><div class="aviso-cab"><strong>Se identificó:</strong>${insigniaMotor(i.res)}</div><ul class="entendi">${resumenInterpretacion(i.res)}</ul>
    ${notaNoCalculado(i.res, "margin-top:6px")}${notasInterpretacion(i.res, estado.observaciones)}</div>`;
}

export function pantallaMedidas() {
  const calculo = estado.calculo, i = estado.interpretacion;
  const vacia = !estado.elementos.length && !estado.extras.length && !estado.cotizados.length;
  const validacion = id => calculo?.elementos.find(v => v.id === id) || { errores: [], advertencias: [] };
  const bloqueado = !calculo || calculo.hayErrores || calculo.extrasSinCantidad || !calculo.lineas.length;
  return `<h2 class="titulo">Medidas y alcance</h2>
    <p class="sub">${i ? "Se tomaron de la descripción. Revise y corrija si hace falta; lo que no se indicó aparece como “de ejemplo”." : "En metros. Reemplace los valores de ejemplo por los de la obra."}</p>
    ${entendido()}
    <div class="bloque elementos">${estado.elementos.map(el => tarjetaElemento(el, validacion(el.id))).join("")}</div>
    <div class="agregar-el">
      <p class="etiqueta">${vacia ? "Agregue lo que se va a construir:" : "¿Algo más en esta obra? Agregue otra parte:"}</p>
      <div class="chips">${catalogo.tiposObra.map(t => `<button class="chip" data-agregar-elemento="${t}">+ ${mayus(singular(t))}</button>`).join("")}</div>
    </div>
    ${trabajosSueltos()}
    <p class="nota"><button class="enlace" data-vista="oficial">Buscar un ítem en la lista oficial de la Gobernación</button> (pintura, cubierta, carpintería y otros ${catalogo.listaOficial ? catalogo.listaOficial.total.toLocaleString("es-CO") : ""} ítems con precio oficial).</p>
    ${itemsCotizados()}
    ${calculo ? catalogoDeTrabajos(calculo) : cargando()}
    ${nav(`data-ir="${PANTALLA.OBRA}"`, `<button class="btn" data-materiales="tengo" ${bloqueado ? "disabled" : ""}>Siguiente</button>`)}
    ${calculo?.extrasSinCantidad ? `<p class="nota" style="text-align:right">Falta la cantidad de un trabajo suelto.</p>` : ""}
    ${calculo && !calculo.hayErrores && !calculo.lineas.length && !vacia ? `<p class="nota" style="text-align:right">Se quitaron todas las actividades: incluya al menos una para continuar.</p>` : ""}`;
}
