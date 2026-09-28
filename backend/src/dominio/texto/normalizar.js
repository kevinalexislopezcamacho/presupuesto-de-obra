/**
 * Normalización de texto: minúsculas, sin tildes, decimales con punto y medidas separadas.
 */

import { NUM_PALABRAS } from "../../datos/lenguaje.js";

export const normalizar = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const raiz = w => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w).slice(0, 5);

/** Cuántas letras hay que cambiar, poner o quitar para pasar de una palabra a otra ("semento" → "cemento": 1). */
export function distancia(a, b) {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i];
    for (let j = 1; j <= b.length; j++) nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    fila = nueva;
  }
  return fila[b.length];
}

/** "dos" → 2, "3.5" → 3.5 */
export const aNum = s => NUM_PALABRAS[s] ?? parseFloat(s);

export function limpiarTexto(texto) {
  return normalizar(texto).replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d)\s*(cm|mts?|m)?\s*x\s*(?=\d)/g, (_, d, u) => `${d}${u ? " " + u : ""} x `).replace(/cuarto de banos?/g, "bano").replace(/\s+/g, " ").trim();
}
