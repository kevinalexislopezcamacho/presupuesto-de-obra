/**
 * Comprobaciones de valores que llegan de afuera (peticiones, respuestas de la IA).
 */

/** Un objeto simple: no null ni un arreglo. */
export const esObjeto = v => v !== null && typeof v === "object" && !Array.isArray(v);
