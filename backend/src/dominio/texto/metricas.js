/**
 * Métricas de clasificación y líneas base para evaluar el modelo de texto con honestidad:
 * precisión, recall y F1 por clase (y su promedio macro), y dos modelos simples contra los que compararlo.
 */
import { PALABRAS_TIPO } from "../../datos/lenguaje.js";
import { normalizar } from "./normalizar.js";

/**
 * @param {Record<string, Record<string, number>>} matriz filas = clase real, columnas = predicción
 * @param {string[]} clases
 */
export function metricasPorClase(matriz, clases) {
  const porClase = clases.map(c => {
    const vp = matriz[c][c] || 0;
    const predichas = clases.reduce((s, r) => s + (matriz[r][c] || 0), 0);
    // Todas las frases de la clase, también las que quedaron sin predicción ("ninguna"): cuentan como no encontradas.
    const soporte = Object.values(matriz[c]).reduce((s, n) => s + n, 0);
    const precision = predichas ? vp / predichas : 0, recall = soporte ? vp / soporte : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { clase: c, precision, recall, f1, soporte };
  });
  const macro = k => porClase.reduce((s, x) => s + x[k], 0) / porClase.length;
  return { porClase, macro: { precision: macro("precision"), recall: macro("recall"), f1: macro("f1") } };
}

/** Línea base 1: decir siempre la clase más frecuente. */
export function baseMayoritaria(datos) {
  const conteos = Object.entries(datos).map(([c, frases]) => [c, frases.length]);
  const [clase, n] = conteos.sort((a, b) => b[1] - a[1])[0];
  const total = conteos.reduce((s, [, k]) => s + k, 0);
  return { nombre: "Clase más frecuente", clase, exactitud: n / total, aciertos: n, total };
}

/** El tipo que nombra la frase por palabra clave ("baño", "tapia"…), o null si no nombra ninguno. */
export function porPalabraClave(frase) {
  const t = normalizar(frase);
  let mejor = null;
  for (const [tipo, re] of Object.entries(PALABRAS_TIPO)) {
    const m = t.match(re);
    if (m && (!mejor || m.index < mejor.pos)) mejor = { tipo, pos: m.index };
  }
  return mejor?.tipo ?? null;
}

/** Línea base 2: solo palabras clave; si la frase no nombra el tipo, no responde (cuenta como error). */
export function basePalabrasClave(datos) {
  let aciertos = 0, total = 0, sinRespuesta = 0;
  for (const [clase, frases] of Object.entries(datos)) for (const frase of frases) {
    total++;
    const tipo = porPalabraClave(frase);
    if (!tipo) sinRespuesta++;
    else if (tipo === clase) aciertos++;
  }
  return { nombre: "Solo palabras clave", exactitud: aciertos / total, aciertos, total, sinRespuesta };
}

/**
 * El sistema como lo usa la herramienta: la palabra clave manda; si no hay, decide el modelo.
 * Usa las predicciones de la validación cruzada (cada frase la predice un modelo que no la vio).
 */
export function sistemaCombinado(predicciones) {
  let aciertos = 0, sinClave = 0, aciertosModelo = 0;
  for (const p of predicciones) {
    const clave = porPalabraClave(p.frase);
    if (!clave) { sinClave++; if (p.pred === p.clase) aciertosModelo++; }
    if ((clave ?? p.pred) === p.clase) aciertos++;
  }
  return { nombre: "Palabras clave + Naive Bayes (como funciona la herramienta)", exactitud: aciertos / predicciones.length, aciertos, total: predicciones.length,
    frasesSinPalabraClave: sinClave, aciertosDelModeloEnEsas: aciertosModelo };
}
