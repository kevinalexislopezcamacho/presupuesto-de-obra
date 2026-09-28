/**
 * Normalización de texto: minúsculas, sin tildes, decimales con punto y medidas separadas.
 */

import { NUM_PALABRAS } from "../../datos/lenguaje.js";

export const normalizar = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const raiz = w => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w).slice(0, 5);

/** "dos" → 2, "3.5" → 3.5 */
export const aNum = s => NUM_PALABRAS[s] ?? parseFloat(s);

export function limpiarTexto(texto) {
  return normalizar(texto).replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d)\s*(cm|mts?|m)?\s*x\s*(?=\d)/g, (_, d, u) => `${d}${u ? " " + u : ""} x `).replace(/cuarto de banos?/g, "bano").replace(/\s+/g, " ").trim();
}
