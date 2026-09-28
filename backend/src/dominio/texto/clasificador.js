/**
 * Clasificador Naive Bayes multinomial con suavizado de Laplace.
 * Aprende de frases etiquetadas qué tipo de construcción describe un texto.
 */

import { PALABRAS_VACIAS } from "../../datos/lenguaje.js";
import { normalizar, raiz } from "./normalizar.js";

// Texto → características: raíces de palabras, pares de palabras y trozos de 3 letras
// (los trozos ayudan con errores de ortografía: "cosina" comparte "ina" con "cocina").
function caracteristicas(texto) {
  const palabras = (normalizar(texto).match(/[a-z]+/g) || []).filter(w => !PALABRAS_VACIAS.has(w));
  const t = palabras.map(raiz);
  const f = [...t];
  for (let i = 0; i < t.length - 1; i++) f.push(t[i] + "_" + t[i + 1]);
  for (const w of palabras) if (w.length >= 4) for (let i = 0; i + 3 <= w.length; i++) f.push("#" + w.slice(i, i + 3));
  return f;
}

export function entrenar(datos) {
  const clases = Object.keys(datos), vocab = new Set(), conteos = {}, totales = {}, docs = {};
  let n = 0;
  for (const c of clases) {
    conteos[c] = {}; totales[c] = 0; docs[c] = datos[c].length; n += datos[c].length;
    for (const frase of datos[c]) for (const f of caracteristicas(frase)) {
      conteos[c][f] = (conteos[c][f] || 0) + 1; totales[c]++; vocab.add(f);
    }
  }
  return { clases, vocab, conteos, totales, prior: Object.fromEntries(clases.map(c => [c, Math.log(docs[c] / n)])), n };
}

// Devuelve las clases ordenadas por probabilidad (suavizado de Laplace, softmax sobre log-probabilidades).
export function predecir(modelo, texto) {
  const f = caracteristicas(texto).filter(x => modelo.vocab.has(x));
  const V = modelo.vocab.size;
  const logp = modelo.clases.map(c => [c, modelo.prior[c] +
    f.reduce((s, x) => s + Math.log(((modelo.conteos[c][x] || 0) + 1) / (modelo.totales[c] + V)), 0)]);
  const max = Math.max(...logp.map(([, v]) => v));
  const exp = logp.map(([c, v]) => [c, Math.exp(v - max)]);
  const suma = exp.reduce((s, [, v]) => s + v, 0);
  const ranking = exp.map(([c, v]) => ({ tipo: c, p: v / suma })).sort((a, b) => b.p - a.p);
  return { ranking, tipo: ranking[0].tipo, p: ranking[0].p, palabrasConocidas: f.filter(x => !x.startsWith("#")).length };
}

// Validación cruzada de 5 particiones: cada frase se prueba una vez con un modelo que no la vio.
export function evaluar(datos, k = 5) {
  const clases = Object.keys(datos);
  const matriz = Object.fromEntries(clases.map(r => [r, Object.fromEntries(clases.map(p => [p, 0]))]));
  let aciertos = 0, nTest = 0;
  const predicciones = [];
  for (let pliegue = 0; pliegue < k; pliegue++) {
    const train = {};
    for (const c of clases) train[c] = datos[c].filter((_, i) => i % k !== pliegue);
    const m = entrenar(train);
    for (const c of clases) datos[c].forEach((frase, i) => {
      if (i % k !== pliegue) return;
      const pred = predecir(m, frase).tipo;
      matriz[c][pred]++; nTest++; if (pred === c) aciertos++;
      predicciones.push({ frase, clase: c, pred });
    });
  }
  const total = clases.reduce((s, c) => s + datos[c].length, 0);
  return { exactitud: aciertos / nTest, aciertos, nTest, nTrain: Math.round(total * (k - 1) / k), pliegues: k, matriz, clases, predicciones };
}
