/**
 * Utilidades numéricas del dominio.
 */

/** Redondea a 2 decimales. */
export const r2 = x => Math.round(x * 100) / 100;

/** 12.5 → "12,5" (formato colombiano, sin separador de miles). */
export const decimal = v => String(Math.round(v * 100) / 100).replace(".", ",");
