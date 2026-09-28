/**
 * Lee materiales escritos con palabras ("20 bultos de cemento y 300 ladrillos")
 * y los convierte a la unidad en que se calcula cada insumo.
 */

import { INSUMOS } from "../datos/precios.js";
import { UNIDADES_TEXTO, PESO_VARILLA, CONVERSION_TEXTO, AMBIGUOS } from "../datos/materiales.js";
import { NO_SOPORTADO, NUM_PALABRAS, RE_NUM_PAL } from "../datos/lenguaje.js";
import { buscarInsumo } from "./materiales.js";
import { r2, decimal } from "./numeros.js";
import { limpiarTexto } from "./texto/normalizar.js";

/**
 * Pasa una cantidad escrita en otra unidad a la unidad del insumo.
 * Si no hay una conversión segura, no inventa: devuelve cantidad null y pide el dato.
 * @param {string} calibre de varilla ("3/8"…), si se conoce
 */
export function convertirUnidad(id, cantidad, unidad, palabra, texto, calibre = null) {
  const destino = INSUMOS[id].unidad;
  if (!unidad || unidad === destino) return { cantidad, nota: "" };
  if (id === "acr" && unidad === "varilla") {
    const cal = calibre || (texto.match(/\b(1\/4|3\/8|1\/2|5\/8|3\/4)\b/) || [])[1];
    if (!cal) return { cantidad: null, nota: `Hay ${decimal(cantidad)} varillas, pero falta el calibre (3/8", 1/2"…): indique el calibre o cuántos kg son.` };
    const kg = r2(cantidad * PESO_VARILLA[cal]);
    return { cantidad: kg, nota: `${decimal(cantidad)} varillas de ${cal}" × 6 m ≈ ${decimal(kg)} kg` };
  }
  const c = CONVERSION_TEXTO[`${id}:${unidad}`];
  if (c) { const v = r2(cantidad * c[0]); return { cantidad: v, nota: c[1] ? `${decimal(cantidad)} ${palabra} = ${decimal(v)} ${destino} (${c[1]})` : "" }; }
  return { cantidad: null, nota: `Se escribió ${decimal(cantidad)} ${palabra}, pero no hay una conversión segura a ${destino}: indique la cantidad en ${destino}.` };
}

// En Colombia el punto separa miles: "1.500 ladrillos" son mil quinientos (la coma es la de los decimales).
const RE_MILES = /(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3})+)(?![\d]|,\d)/g;
export const quitarMiles = s => String(s).replace(RE_MILES, (_, a, b) => a + b.replace(/\./g, ""));

// Comas que no están entre dos dígitos ("2,5" es un decimal), punto y coma, saltos de línea y conectores.
const SEPARADORES = /\s*(?:(?<!\d),|,(?!\d)|;|\n+|\s+(?:y|e|además|ademas|también|tambien|más|mas)\s+)\s*/i;
const RELLENO = /\b(tengo|tenemos|me quedaron|me sobraron|sobraron|hay|compre|ya|unos|unas|como|mas o menos|aproximadamente|aprox)\b/g;
const RE_CANT = new RegExp(`(?<![\\d/.])(\\d+(?:\\.\\d+)?)(?![\\d/])|\\b(${RE_NUM_PAL}|media|medio)\\b`);
const numeroDe = m => m[1] ? parseFloat(m[1]) : (m[2] === "media" || m[2] === "medio" ? 0.5 : NUM_PALABRAS[m[2]]);
const trozoLimpio = texto => limpiarTexto(quitarMiles(texto)).replace(RELLENO, " ").replace(/\s+/g, " ").trim();

// Devuelve [{ texto, id|null, cantidad|null, nota }]; req (lo que usa la obra) ayuda a decidir entre materiales parecidos.
export function interpretarMateriales(texto, req = {}) {
  // Se separa sobre el texto original para mostrar cada material tal como se escribió.
  const originales = String(texto).split(SEPARADORES).map(s => s.trim()).filter(Boolean);
  return originales.map(original => {
    const trozo = trozoLimpio(original);
    return trozo ? leerTrozo(original, trozo, req) : null;
  }).filter(Boolean);
}

function leerTrozo(original, trozo, req) {
  let cantidad = null, unidad = null, palabra = "", resto = trozo;
  const m = trozo.match(RE_CANT);
  if (m) {
    cantidad = numeroDe(m);
    const despues = trozo.slice(m.index + m[0].length).trim();
    const un = UNIDADES_TEXTO.find(x => x.inicio.test(despues));
    if (un) { unidad = un.u; palabra = despues.match(un.inicio)[0]; }
    // "varilla" y "tubo" también nombran el material: se dejan para buscarlo.
    resto = `${trozo.slice(0, m.index)} ${unidad === "varilla" || unidad === "tubo" ? despues : despues.slice(palabra.length)}`.trim();
  }
  if (!unidad) {   // "bultos de cemento: 20" o "cemento en bultos"
    const un = UNIDADES_TEXTO.find(x => x.u !== "m" && new RegExp(x.dentro.source).test(resto));
    if (un) { unidad = un.u; palabra = resto.match(new RegExp(un.dentro.source))[0]; }
  }
  // Para buscar el material se quitan las unidades, salvo "varilla" y "tubo", que también lo nombran.
  const consulta = UNIDADES_TEXTO.filter(x => x.u !== "varilla" && x.u !== "tubo").reduce((s, x) => s.replace(x.dentro, " "), resto).trim();
  let id = buscarInsumo(consulta), nota = "";
  if (unidad === "varilla") id = "acr";
  if (!id && unidad === "tubo") id = /desag|sanitari|\b2\b/.test(resto) ? "tps" : "tpp";
  const grupo = id && AMBIGUOS.find(g => g.ids.includes(id));
  if (grupo && !grupo.tipo.test(consulta)) ({ id, nota } = elegirTipo(grupo, id, req));
  if (!id) {
    const noCalc = NO_SOPORTADO.find(([re]) => re.test(trozo));
    return { texto: original, id: null, cantidad, nota: noCalc
      ? `Es para ${noCalc[1].replace(/ \(.*\)/, "")}, que esta herramienta todavía no calcula.`
      : "No se reconoce. Pruebe con el nombre común: cemento, arena, ladrillo, varilla, cerámica…" };
  }
  if (cantidad !== null) { const cv = convertirUnidad(id, cantidad, unidad, palabra, trozo); cantidad = cv.cantidad; nota = [nota, cv.nota].filter(Boolean).join(" "); }
  return { texto: original, id, cantidad, nota };
}

/**
 * La unidad escrita justo después de la cantidad ("3 volquetas de arena" → viaje). Sirve para que la unidad
 * que dijo la persona mande sobre la que proponga la IA.
 * @returns {{ unidad: string, palabra: string } | null}
 */
export function unidadEscrita(texto) {
  const t = trozoLimpio(texto);
  const m = t.match(RE_CANT);
  if (!m) return null;
  const despues = t.slice(m.index + m[0].length).trim();
  const un = UNIDADES_TEXTO.find(x => x.inicio.test(despues));
  return un ? { unidad: un.u, palabra: despues.match(un.inicio)[0] } : null;
}

/** El número escrito en un material ("10 alambres" → 10), o null si no hay. */
export function numeroEscrito(texto) {
  const m = trozoLimpio(texto).match(RE_CANT);
  return m ? numeroDe(m) : null;
}

/** Si el texto dice en qué unidad está la cantidad, en cualquier parte ("10 kg de alambre", "cemento en bultos"). */
export const diceUnidad = texto => { const t = trozoLimpio(texto); return UNIDADES_TEXTO.some(x => new RegExp(x.dentro.source).test(t)); };

/** Materiales parecidos sin tipo ("bloques"): se elige el que usa la obra y se avisa. */
export function elegirTipo(grupo, id, req) {
  const usados = grupo.ids.filter(x => req[x]);
  const elegido = usados.length === 1 ? usados[0] : id;
  return { id: elegido, nota: `No se indicó el tipo: se tomó ${INSUMOS[elegido].nombre.toLowerCase()}${usados.length === 1 ? ", que es el que usa la obra" : ""}. Si es otro, quítelo y escríbalo con el tipo.` };
}
