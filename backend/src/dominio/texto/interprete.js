/**
 * Intérprete de la descripción libre de la obra:
 * 1) separa la frase en partes ("un baño y una cocina", "… con un baño");
 * 2) cada parte es una construcción o un trabajo suelto: si nombra el tipo ("bodega", "tapia")
 *    esa palabra manda; si no, decide el clasificador Naive Bayes;
 * 3) cantidades ("4 muros") y medidas ("3 x 2,5", "12mx15m", "70 m2") se leen con reglas.
 */

import {
  PALABRAS_TIPO, TRABAJOS, NO_SOPORTADO, NUM_PALABRAS, RE_NUM_PAL,
  RE_NEGACION, RE_REMODELAR, RE_MUROS_EXISTEN, ESTRUCTURA, ACABADOS_ESPECIALES
} from "../../datos/lenguaje.js";
import { PRUEBA_INTERPRETE } from "../../datos/entrenamiento.js";
import { SUPUESTOS } from "../../datos/supuestos.js";
import { TIPOS } from "../../datos/tipos-obra.js";
import { r2, decimal } from "../numeros.js";
import { actividadesDelTipo } from "../actividades.js";
import { limpiarHuecos, completarHuecos } from "../huecos.js";
import { predecir } from "./clasificador.js";
import { MODELO, UMBRAL_CONFIANZA } from "./modelo.js";
import { aNum, limpiarTexto } from "./normalizar.js";

function primerTipo(t) {
  let mejor = null;
  for (const [tipo, re] of Object.entries(PALABRAS_TIPO)) {
    const m = t.match(re);
    if (m && (!mejor || m.index < mejor.pos)) mejor = { tipo, pos: m.index, palabra: m[0] };
  }
  return mejor;
}
// Trabajos que nombra el texto, con `negado` si van después de "sin" o "no" ("sin cambiar el piso").
function hallarTrabajos(t) {
  const hallados = TRABAJOS.map(tr => ({ ...tr, m: t.match(tr.re) })).filter(x => x.m);
  const cods = new Set(hallados.map(h => h.codigo));
  // "enchapar el piso" es piso; "piso en concreto" es placa, salvo que diga cerámica.
  return hallados.filter(h =>
    !(h.codigo === "ACB-01" && /\bpisos?\b/.test(t) && !/\bpared/.test(t)) &&
    !(h.codigo === "ACB-02" && cods.has("CON-03") && !/ceramic|baldos|porcelanat/.test(t)) &&
    !(h.codigo === "ACB-02" && cods.has("ACB-01") && /\bpared/.test(t) && !/\bpisos?\b/.test(t)))
    .map(h => ({ codigo: h.codigo, medida: h.medida, pos: h.m.index, negado: RE_NEGACION.test(t.slice(0, h.m.index)) }));
}
const trabajosEn = t => hallarTrabajos(t).filter(h => !h.negado);
/** Si el texto nombra una construcción o un trabajo ("un muro…", "pañetar…"): sus materiales no son una compra aparte. */
export const nombraObra = texto => { const t = limpiarTexto(texto); return Boolean(primerTipo(t)) || trabajosEn(t).length > 0; };

/** Actividades que la persona pidió quitar de una parte: "sin enchape", "remodelar" (ya hay muros y placa). */
function exclusionesDe(texto, tipo) {
  const excluir = new Set(), observaciones = [];
  for (const h of hallarTrabajos(texto).filter(x => x.negado)) excluir.add(h.codigo === "CON-02" && /cimentac/.test(texto) ? "CON-05" : h.codigo);
  const remodelar = tipo !== "muro" && texto.match(RE_REMODELAR);
  if (remodelar) {
    [...ESTRUCTURA, "CON-03"].forEach(c => excluir.add(c));
    observaciones.push({ texto: remodelar[0], nota: "Es una remodelación: no se incluyen muros, estructura ni placa porque ya existen, y sí la demolición del enchape y el piso que se cambian. Se puede ajustar en Medidas." });
  } else if (RE_MUROS_EXISTEN.test(texto)) {
    ESTRUCTURA.forEach(c => excluir.add(c));
  }
  return { excluir: [...excluir], remodelacion: Boolean(remodelar), observaciones };
}

/** Acabados que no están en la base ("porcelanato"): se calculan con la referencia y se avisa. */
function acabadosDe(texto) {
  const m = texto.match(ACABADOS_ESPECIALES);
  if (!m) return [];
  const nombre = m[0] === "marmol" ? "mármol" : m[0];
  return [{ texto: nombre, nota: `Se calcula con la cerámica y los materiales de referencia; si se va a usar ${nombre}, ingrese su precio en la pestaña Precios.` }];
}

// Divide el texto en partes donde empieza otra construcción o trabajo.
// "… con un baño", "… con 2 habitaciones": ahí empieza otra construcción.
const RE_CON = new RegExp(`\\s+con\\s+(?=(?:(?:\\d+|${RE_NUM_PAL}|su|sus)\\s+)?(?:banos?|cocinas?|cocineta|cuartos?|habitacion(?:es)?|alcobas?|piezas?|bodegas?|garajes?|muros?|pared(?:es)?)\\b)`, "g");
function segmentar(t) {
  const trozos = t.replace(RE_CON, " ,con ").split(/\s*(?:,|;|\s+y\s+|\s+e\s+|\s+ademas\s+|\s+tambien\s+|\s+junto con\s+|\s+mas\s+(?=(?:\d|un|una|dos|tres|cuatro|cinco|otr)))\s*/).filter(Boolean);
  const partes = [];
  let prefijo = "";
  const continuacion = new RegExp(`^(?:otr[oa]s?\\s+)?(\\d+|${RE_NUM_PAL})\\s+(?:mas\\s+)?de\\s+\\d+(?:\\.\\d+)?\\s*(?:m\\s*)?(?:x|por)`);
  for (const pieza of trozos) {
    const conjunto = pieza.startsWith("con ");          // venía de "… con un baño"
    const crudo = conjunto ? pieza.slice(4) : pieza;
    const trozo = prefijo ? prefijo + " " + crudo : crudo;
    const tipo = primerTipo(trozo), trabajos = trabajosEn(trozo);
    const anterior = partes[partes.length - 1];
    const tieneAlgo = tipo || trabajos.length || NO_SOPORTADO.some(([re]) => re.test(trozo));
    // Un comienzo sin nada concreto ("quiero, …") se une a lo que sigue.
    if (!anterior && !tieneAlgo && pieza !== trozos[trozos.length - 1]) { prefijo = trozo; continue; }
    prefijo = "";
    if (anterior && anterior.soloTrabajo && trabajos.length) {
      anterior.texto += " y " + trozo; anterior.soloTrabajo = false;
    } else if (anterior && !tieneAlgo && continuacion.test(trozo) && anterior.tipoHeredable) {
      partes.push({ texto: trozo, hereda: anterior.tipoHeredable });
    } else if (anterior && (!tieneAlgo ||
        // "casa con dos baños y cocina": los baños y la cocina son parte de la casa.
        (anterior.tipoHeredable === "casa" && tipo && ["bano", "cocina", "cuarto"].includes(tipo.tipo) && !/\b(construir|hacer|levantar|otr[oa])\b/.test(trozo)) ||
        // "un baño con su muro": lo mismo que ya se nombró no es otra construcción.
        (conjunto && tipo && anterior.tipoHeredable === tipo.tipo) ||
        // "un baño, con enchape en porcelanato" o "un baño y piso en cerámica": es cómo se quiere esa parte,
        // no otro trabajo (sin medidas propias y con actividades que la parte ya incluye).
        (conjunto && !tipo && anterior.tipoHeredable && !/\d/.test(crudo)) ||
        (!tipo && trabajos.length && anterior.tipoHeredable && !/\d/.test(trozo) &&
          trabajos.every(t => actividadesDelTipo(anterior.tipoHeredable).includes(t.codigo))) ||
        // "una cocina, los muros ya están": dice qué ya existe en esa parte.
        (anterior.tipoHeredable && anterior.tipoHeredable !== "muro" && RE_MUROS_EXISTEN.test(trozo)))) {
      anterior.texto += " y " + trozo;
    } else {
      const tipoParte = tipo && !(trabajos.length && trabajos[0].pos < tipo.pos) ? tipo.tipo : null;
      partes.push({ texto: trozo, tipoHeredable: tipoParte,
        soloTrabajo: !tipo && trabajos.length > 0 && !/\d/.test(trozo) && trozo.split(" ").length <= 3 });
    }
  }
  return partes;
}

// Puertas y ventanas con forma o medidas: "una puerta en arco de 1 m de ancho", "ventana circular de 60 cm de diámetro",
// "2 puertas de 0,9 x 2,1", "un ojo de buey". Devuelve los huecos y el texto sin ellos (para no confundir sus
// medidas con las del muro). Si ninguna trae forma ni medidas, no hay huecos: se usan los típicos.
const MED = "(\\d+(?:\\.\\d+)?)\\s*(cm|centimetros?|metros?|mts?|m)?";
const RE_HUECO = new RegExp(`(?:\\b(\\d+|${RE_NUM_PAL})\\s+)?\\b(puertas?|ventanas?|ojos? de buey)\\b` +
  `(?:\\s+(?:en forma de|con forma de|tipo|en|de)?\\s*(arcos?|medio punto|circular(?:es)?|redond[oa]s?)\\b)?`, "g");
function huecosDe(t) {
  const hallados = [...t.matchAll(RE_HUECO)];
  if (!hallados.length) return { huecos: [], resto: t };
  // Medida en metros; sin unidad y mayor que 10 se entiende en centimetros ("de 60 de diametro").
  const metros = (n, u) => { const v = parseFloat(n); const m = (u && u.startsWith("c")) || (!u && v > 10) ? v / 100 : v; return m > 0.05 && m <= 10 ? m : undefined; };
  const cortes = [];
  const huecos = hallados.map((h, k) => {
    // Lo que describe este hueco llega hasta el siguiente hueco, una coma o el nombre de otra construcción.
    let fin = k + 1 < hallados.length ? hallados[k + 1].index : t.length;
    const resto = t.slice(h.index + h[0].length, fin);
    const corte = [resto.search(/[,;]/), ...Object.values(PALABRAS_TIPO).map(re => resto.search(re))].filter(i => i >= 0);
    const w = corte.length ? resto.slice(0, Math.min(...corte)) : resto;
    fin = h.index + h[0].length + w.length;
    cortes.push([h.index, fin]);
    const ojo = h[2].startsWith("ojo");
    const forma = ojo || /circular|redond/.test(h[3] || "") ? "circular" : h[3] ? "arco" : "rectangular";
    const m = {};
    const diam = w.match(new RegExp(`${MED}\\s*de\\s*diametro`)) || w.match(new RegExp(`diametro\\s*(?:de\\s*)?${MED}`));
    const par = w.match(new RegExp(`${MED}\\s*(?:x|por)\\s*${MED}`));
    const ancho = w.match(new RegExp(`${MED}\\s*(?:de\\s*)?ancho`)) || w.match(new RegExp(`ancho\\s*(?:de\\s*)?${MED}`));
    const alto = w.match(new RegExp(`${MED}\\s*(?:de\\s*)?(?:alto|altura)`)) || w.match(new RegExp(`(?:alto|altura)\\s*(?:de\\s*)?${MED}`));
    const uno = w.match(new RegExp(`^\\s*de\\s*${MED}`));
    if (diam) m.diametro = metros(diam[1], diam[2]);
    if (par) { m.ancho = metros(par[1], par[2]); m.alto = metros(par[3], par[4]); }
    if (ancho) m.ancho = metros(ancho[1], ancho[2]);
    if (alto) m.alto = metros(alto[1], alto[2]);
    if (uno && !diam && !par && !ancho && !alto) m[forma === "circular" ? "diametro" : "ancho"] = metros(uno[1], uno[2]);
    const n = h[1] ? aNum(h[1]) : 1;
    return { tipo: /^puerta/.test(h[2]) ? "puerta" : "ventana", forma, ...Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)),
      cantidad: Number.isInteger(n) && n >= 1 && n <= 50 ? n : 1 };
  });
  const detallados = huecos.some(h => h.forma !== "rectangular" || h.ancho || h.alto || h.diametro);
  if (!detallados) return { huecos: [], resto: t };
  let resto = t;
  for (const [a, b] of [...cortes].reverse()) resto = resto.slice(0, a) + " " + resto.slice(b);
  return { huecos: limpiarHuecos(huecos), resto: resto.replace(/\s+/g, " ").trim() };
}

// "casa … con 3 habitaciones y 2 cocinas": en una casa esos números no cambian el cálculo (se calcula con el área
// de la planta, el alto de los muros y los baños). Se explica en una nota para que nadie espere que se ajusten.
const RE_ESPACIOS_CASA = `\\b(\\d+|${RE_NUM_PAL})\\s+(habitacion(?:es)?|alcobas?|cuartos?|piezas?|dormitorios?|cocinas?|cocinetas?)\\b`;
/** Si el texto dice cuántas habitaciones o cocinas tiene una casa. */
export const hablaDeEspaciosCasa = texto => new RegExp(RE_ESPACIOS_CASA).test(limpiarTexto(texto));
/** Nota sobre las habitaciones y cocinas que se nombran en una casa, o null si no nombra ninguna. */
export function notaDistribucionCasa(texto) {
  let habitaciones = 0, cocinas = 0;
  const dichos = [];
  for (const m of limpiarTexto(texto).matchAll(new RegExp(RE_ESPACIOS_CASA, "g"))) {
    const n = aNum(m[1]);
    if (!(n >= 1)) continue;
    dichos.push(m[0]);
    if (m[2].startsWith("cocin")) cocinas += n; else habitaciones += n;
  }
  const notas = [];
  if (habitaciones) notas.push(`El número de habitaciones no cambia el cálculo: la casa se calcula con el área de la planta, el alto de los muros y el número de baños, y los muros internos se estiman como un ${Math.round(SUPUESTOS.murosInternosCasa * 100)} % del perímetro. Si la distribución tiene más muros, agréguelos como muros en Medidas.`);
  if (cocinas > 1) notas.push(`La casa incluye una cocina (mesón y puntos hidrosanitarios); ${cocinas === 2 ? "la otra se puede" : "las demás se pueden"} agregar con trabajos sueltos: mesón y puntos hidrosanitarios.`);
  return notas.length ? { texto: dichos.join(", "), nota: notas.join(" ") } : null;
}

// Medidas por reglas: "2 x 1,5", "6 metros de largo", "2,4 de alto", "de 10 m", "70 m2", "mesón de 2,5", "dos baños", "300 cm".
export function extraerMedidas(texto, tipo) {
  const { huecos, resto } = huecosDe(limpiarTexto(texto));
  let t = resto.replace(new RegExp(`\\b(${RE_NUM_PAL})\\b(?=\\s+(banos?|metros?|m\\b))`, "g"), w => NUM_PALABRAS[w]);
  const N = "(\\d+(?:\\.\\d+)?)(?:\\s*(cm|centimetros?|metros?|mts?|m)\\b)?";
  const val = (n, u) => { const v = parseFloat(n); return u && u.startsWith("c") ? v / 100 : v; };
  const ok = v => v > 0 && v < 200;
  const r = {}, estimadas = [];

  const par = t.match(new RegExp(N + "\\s*(?:x|por|\\*)\\s*" + N + "(?:\\s*(?:x|por|\\*)\\s*" + N + ")?"));
  if (par) {
    const a = val(par[1], par[2]), b = val(par[3], par[4]), c = par[5] ? val(par[5], par[6]) : null;
    if (tipo === "muro") { if (ok(a)) r.largo = a; if (ok(b)) r.alto = b; }
    else { if (ok(a)) r.largo = a; if (ok(b)) r.ancho = b; if (c && ok(c)) r.alto = c; }
  }
  const etiquetas = { largo: "largo|longitud", ancho: "ancho", alto: "alto|altura" };
  for (const [campo, kw] of Object.entries(etiquetas)) {
    const m = t.match(new RegExp(N + "\\s*(?:de\\s*)?(?:" + kw + ")\\b")) || t.match(new RegExp("\\b(?:" + kw + ")\\s*(?:de\\s*)?" + N));
    if (m && ok(val(m[1], m[2]))) r[campo] = val(m[1], m[2]);
  }
  // "un muro de 10 m": un solo número con metros es el largo.
  if (tipo === "muro" && !r.largo) {
    const m = t.match(/(\d+(?:\.\d+)?)\s*(?:m|metros?|mts?)\b(?!\s*(?:de\s*)?(?:alto|altura|ancho|cuadrad))/);
    if (m && ok(+m[1])) r.largo = +m[1];
  }
  // "70 m2": si solo hay área, se reparte en largo y ancho (proporción 1,25 : 1).
  const area = t.match(/(\d+(?:\.\d+)?)\s*(?:m2|mt2|mts2|m\^2|metros? cuadrados?)/);
  if (area && ["bano", "cocina", "cuarto", "casa"].includes(tipo) && !(r.largo && r.ancho)) {
    const A = +area[1], ancho = Math.round(Math.sqrt(A / 1.25) * 10) / 10;
    if (ok(ancho)) { r.ancho = ancho; r.largo = Math.round((A / ancho) * 10) / 10; estimadas.push("largo", "ancho"); }
  }
  const meson = t.match(new RegExp("meson\\w*\\s*(?:de\\s*)?" + N));
  if (meson && ok(val(meson[1], meson[2]))) r.meson = val(meson[1], meson[2]);
  const banos = t.match(/(\d+)\s*banos?\b/) || (/\buna?\s+bano\b/.test(t) ? [null, "1"] : null);
  if (banos) r.banos = parseInt(banos[1], 10);
  if (tipo === "muro" && /puerta|ventana/.test(t))
    r.vanos = r2((/puerta/.test(t) ? SUPUESTOS.puerta : 0) + (/ventana/.test(t) ? SUPUESTOS.ventanaMuro : 0));

  let sistema = null;
  if (/bloque\w*\s+de\s+(concreto|cemento)/.test(t)) sistema = "concreto";
  else if (/arcilla|ladrillo/.test(t)) sistema = "arcilla";

  // Solo se conservan los campos que existen para ese tipo de obra.
  const campos = (TIPOS[tipo] || { campos: [] }).campos.map(c => c[0]);
  const medidas = Object.fromEntries(Object.entries(r).filter(([k]) => campos.includes(k)));
  const { huecos: completos, nota } = completarHuecos(tipo, huecos);
  return { medidas, sistema, estimadas: estimadas.filter(k => k in medidas), huecos: completos, notaHuecos: nota };
}

// Cantidad de un trabajo suelto a partir de sus medidas.
function cantidadTrabajo(trabajo, t) {
  const tipo = primerTipo(t);
  const espacio = tipo && ["bano", "cocina", "cuarto", "casa"].includes(tipo.tipo) ? tipo.tipo : null;
  const area = t.match(/(\d+(?:\.\d+)?)\s*(?:m2|mt2|mts2|m\^2|metros? cuadrados?)/);
  const med = extraerMedidas(t, espacio || "cuarto").medidas;
  const par = t.match(/(\d+(?:\.\d+)?)\s*(?:m\s*)?(?:x|por)\s*(\d+(?:\.\d+)?)/);
  const uno = t.match(/(\d+(?:\.\d+)?)\s*(?:m|metros?|mts?)\b(?!\s*cuadrad)/);
  const cuenta = t.match(new RegExp(`\\b(\\d+|${RE_NUM_PAL})\\s+(?:puntos?|zapatas?|columnas?)`));
  if (trabajo.medida === "cantidad") return cuenta ? aNum(cuenta[1]) : 0;
  if (trabajo.medida === "zapatas") return cuenta ? r2(aNum(cuenta[1]) * SUPUESTOS.zapataPorColumna) : 0;
  if (trabajo.medida === "largo") {
    if (trabajo.codigo === "CON-01" && cuenta) return r2(aNum(cuenta[1]) * (med.alto || 2.4));
    return uno ? +uno[1] : 0;
  }
  if (area) return +area[1];
  if (!par) return 0;
  const a = +par[1], b = +par[2];
  // Paredes de un espacio (pañetar o enchapar el baño de 2 x 1,5): perímetro × alto menos una puerta.
  if (trabajo.medida === "pared" && espacio) return r2(Math.max(0, 2 * (a + b) * (med.alto || (espacio === "bano" ? SUPUESTOS.alturaEnchape : 2.4)) - SUPUESTOS.puerta));
  return r2(a * b);
}

// Explica de dónde sale la cantidad de columnas o vigas y avisa si lo pedido no es lo que calcula el APU.
const SECCION_CONFINAMIENTO = 0.12 * 0.20;   // m² de la columna y la viga de confinamiento
export function revisarTrabajo(codigo, t) {
  const out = { detalle: "", aviso: "" };
  if (codigo !== "CON-01" && codigo !== "CON-02") return out;
  const aM = (v, u) => (u ? (u.startsWith("c") ? v / 100 : v) : (v > 3 ? v / 100 : v));   // sin unidad, más de 3 se lee como cm
  const U = "(cm|centimetros?|metros?|mts?|m)?";
  const diam = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${U}\\s*de\\s*diametro`)) || t.match(new RegExp(`diametro\\s*(?:de\\s*)?(\\d+(?:\\.\\d+)?)\\s*${U}`));
  const sec = t.match(new RegExp(`(?:seccion|de)\\s*(\\d+(?:\\.\\d+)?)\\s*${U}\\s*x\\s*(\\d+(?:\\.\\d+)?)\\s*${U}`));
  let area = null, desc = "";
  if (diam) { const d = aM(+diam[1], diam[2]); area = Math.PI * d * d / 4; desc = `${decimal(d)} m de diámetro`; }
  else if (sec) { const a = aM(+sec[1], sec[2]), b = aM(+sec[3], sec[4]); if (a < 1.5 && b < 1.5) { area = a * b; desc = `${decimal(a)} × ${decimal(b)} m`; } }
  const avisos = [];
  const nombre = codigo === "CON-01" ? "columna" : "viga";
  if (area && area > SECCION_CONFINAMIENTO * 1.5)
    avisos.push(`Se pidieron ${nombre}s de ${desc}. Aquí se calcula la ${nombre} de confinamiento (0,12 × 0,20 m), la pequeña que va amarrada a un muro de bloque; la pedida lleva unas ${Math.round(area / SECCION_CONFINAMIENTO)} veces más concreto por metro y es un elemento estructural que debe diseñar un ingeniero (NSR-10). Este precio queda muy por debajo del real.`);
  if (codigo === "CON-01") {
    const cuenta = t.match(new RegExp(`\\b(\\d+|${RE_NUM_PAL})\\s+columnas?`));
    const alto = extraerMedidas(t, "cuarto").medidas.alto;
    if (cuenta) out.detalle = `${aNum(cuenta[1])} ${aNum(cuenta[1]) === 1 ? "columna" : "columnas"} × ${decimal(alto || 2.4)} m de alto${alto ? "" : " (supuesto)"}`;
    if (alto > SUPUESTOS.alturaMaxSinRevision)
      avisos.push(`Una columna de ${decimal(alto)} m de alto equivale a unos ${Math.max(2, Math.round(alto / 2.5))} pisos: necesita diseño estructural.`);
  }
  out.aviso = avisos.join(" ");
  return out;
}

// Resultado: partes (construcciones), trabajos sueltos, dudas y cosas que no se calculan.
export function interpretarTexto(texto) {
  const t = limpiarTexto(texto);
  const res = { partes: [], trabajos: [], dudas: [], noSoportado: [], observaciones: [] };
  for (const [re, nombre] of NO_SOPORTADO) if (re.test(t)) res.noSoportado.push(nombre);
  for (const seg of segmentar(t)) {
    const tipo = seg.hereda ? { tipo: seg.hereda, palabra: seg.hereda } : primerTipo(seg.texto);
    const trabajos = trabajosEn(seg.texto);
    const noCalc = NO_SOPORTADO.map(([re]) => seg.texto.match(re)).filter(Boolean).map(m => m.index);
    if (noCalc.length && !seg.hereda) {
      const ns = Math.min(...noCalc);
      if ((!tipo || ns <= tipo.pos) && (!trabajos.length || ns <= trabajos[0].pos)) continue;
    }
    const esTrabajo = trabajos.length && (!tipo || seg.hereda === undefined && trabajos[0].pos < tipo.pos);
    res.observaciones.push(...acabadosDe(seg.texto));
    if (esTrabajo) {
      for (const tr of trabajos) res.trabajos.push({ codigo: tr.codigo, cantidad: cantidadTrabajo(tr, seg.texto), texto: seg.texto, ...revisarTrabajo(tr.codigo, seg.texto) });
      continue;
    }
    const pred = predecir(MODELO, seg.texto);
    let elegido = null, fuente = null;
    if (tipo) { elegido = tipo.tipo; fuente = seg.hereda ? "continuación" : `la palabra “${tipo.palabra}”`; }
    else if (pred.palabrasConocidas > 0 && pred.p >= UMBRAL_CONFIANZA) { elegido = pred.tipo; fuente = `el modelo (${Math.round(pred.p * 100)} %)`; }
    if (!elegido) {
      if (!NO_SOPORTADO.some(([re]) => re.test(seg.texto))) res.dudas.push({ texto: seg.texto, ranking: pred.ranking });
      continue;
    }
    // Cantidad: número justo antes del nombre ("4 muros", "dos baños") o al inicio de una continuación.
    let cantidad = 1;
    const reCant = seg.hereda ? new RegExp(`^(?:otr[oa]s?\\s+)?(\\d+|${RE_NUM_PAL})\\b`) :
      new RegExp(`\\b(\\d+|${RE_NUM_PAL})\\s+(?:nuev[oa]s?\\s+|otr[oa]s?\\s+)?${tipo ? tipo.palabra.replace(/\s+/g, "\\s+") : "$^"}`);
    const mc = seg.texto.match(reCant);
    if (mc) { const n = aNum(mc[1]); if (n >= 1 && n <= 50 && Number.isInteger(n)) cantidad = n; }
    const leidas = extraerMedidas(seg.texto, elegido), { medidas, estimadas } = leidas;
    // "… en bloque de concreto y 2 de 6 x 2,5": la continuación usa el mismo bloque.
    const sistema = leidas.sistema ?? (seg.hereda ? res.partes.at(-1)?.sistema ?? null : null);
    const { excluir, remodelacion, observaciones } = exclusionesDe(seg.texto, elegido);
    res.observaciones.push(...observaciones);
    if (leidas.notaHuecos) res.observaciones.push({ texto: "puertas y ventanas", nota: leidas.notaHuecos });
    const distribucion = elegido === "casa" ? notaDistribucionCasa(seg.texto) : null;
    if (distribucion) res.observaciones.push(distribucion);
    res.partes.push({ tipo: elegido, cantidad, medidas, sistema, estimadas, excluir, remodelacion, huecos: leidas.huecos, fuente, texto: seg.texto, p: pred.ranking.find(x => x.tipo === elegido)?.p ?? 0 });
  }
  // La misma observación una sola vez ("porcelanato" en dos partes).
  res.observaciones = res.observaciones.filter((o, i, todas) => todas.findIndex(x => x.texto === o.texto) === i);
  return res;
}

export function evaluarInterprete() {
  let aciertos = 0;
  const detalle = PRUEBA_INTERPRETE.map(([frase, esperado]) => {
    const r = interpretarTexto(frase);
    const obtenido = [...r.partes.map(p => `${p.cantidad} ${p.tipo}`), ...r.trabajos.map(x => x.codigo)];
    const ok = obtenido.length === esperado.length && esperado.every(e => obtenido.includes(e));
    if (ok) aciertos++;
    return { frase, esperado, obtenido, ok };
  });
  return { aciertos, total: PRUEBA_INTERPRETE.length, detalle };
}
