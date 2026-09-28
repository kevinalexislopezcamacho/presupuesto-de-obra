/**
 * Puertas y ventanas con su forma: el área del hueco que se descuenta del muro (bloque, pañete y enchape).
 * - Rectangular: ancho × alto.
 * - En arco de medio punto: un rectángulo más medio círculo del mismo ancho; "alto" es el alto total, hasta la clave del arco.
 * - Circular: π × (diámetro / 2)².
 * La hoja de la puerta o de la ventana (carpintería) no se calcula aquí: va como ítem cotizado o de la lista oficial.
 */
import { decimal as d } from "./numeros.js";

export const TIPOS_HUECO = ["puerta", "ventana"];
export const FORMAS_HUECO = ["rectangular", "arco", "circular"];

// Medidas típicas cuando no se dicen (se muestran "de ejemplo" para que la persona las corrija).
export const HUECO_TIPICO = {
  puerta: { ancho: 0.8, alto: 2.1, diametro: 1 },
  ventana: { ancho: 1, alto: 1.2, diametro: 0.6 }
};
const hueco = (tipo, ancho, alto) => ({ tipo, forma: "rectangular", ancho, alto, diametro: HUECO_TIPICO[tipo].diametro, cantidad: 1 });

/**
 * Las puertas y ventanas que la herramienta supone en cada tipo de obra (las mismas áreas de supuestos.js).
 * Al detallar los huecos de una parte se parte de estas, para que no se pierda la ventana al cambiar la puerta.
 */
export const HUECOS_TIPICOS = {
  muro: [hueco("puerta", 0.8, 2.1)],
  bano: [hueco("puerta", 0.8, 2.1), hueco("ventana", 1, 0.6)],
  cocina: [hueco("puerta", 0.8, 2.1), { ...hueco("ventana", 1, 0.6), cantidad: 2 }],
  cuarto: [hueco("puerta", 0.8, 2.1), hueco("ventana", 1.2, 1.2)],
  casa: [hueco("puerta", 0.8, 2.1)]
};

/** Área de un hueco (m²). */
export function areaHueco(h) {
  if (h.forma === "circular") return Math.PI * (h.diametro / 2) ** 2;
  if (h.forma === "arco") {
    const r = h.ancho / 2;
    return h.ancho * Math.max(0, h.alto - r) + (Math.PI * r * r) / 2;
  }
  return h.ancho * h.alto;
}

/** Área de todos los huecos, con cuántos iguales hay de cada uno. */
export const areaHuecos = huecos => huecos.reduce((s, h) => s + areaHueco(h) * h.cantidad, 0);

/** "puerta en arco de 1 × 2,1 m" para la memoria de cantidades. */
export function describirHueco(h) {
  const forma = h.forma === "circular" ? `${h.tipo} circular de ${d(h.diametro)} m de diámetro`
    : h.forma === "arco" ? `${h.tipo} en arco de ${d(h.ancho)} × ${d(h.alto)} m`
      : `${h.tipo} de ${d(h.ancho)} × ${d(h.alto)} m`;
  return `${h.cantidad > 1 ? `${h.cantidad} × ` : ""}${forma}`;
}

/** Medidas imposibles (errores) o poco usuales (advertencias). */
export function revisarHuecos(huecos) {
  const errores = [], advertencias = [];
  for (const h of huecos) {
    const nombre = describirHueco({ ...h, cantidad: 1 });
    if (h.forma === "arco" && h.alto < h.ancho / 2)
      errores.push(`La ${nombre} necesita un alto total de al menos la mitad del ancho (${d(h.ancho / 2)} m).`);
    if (h.tipo === "puerta" && (h.forma === "circular" ? h.diametro : h.alto) < 1.8)
      advertencias.push(`La ${nombre} tiene menos de 1,80 m de alto: no permite pasar de pie. Revise si es una ventana o si la medida es correcta.`);
    if ((h.forma === "circular" ? h.diametro : Math.max(h.ancho, h.alto)) > 4)
      advertencias.push(`La ${nombre} es muy grande (más de 4 m): necesita un dintel o una viga que debe revisar un ingeniero.`);
  }
  return { errores, advertencias };
}

const numeroPositivo = v => (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 20 ? Number(v) : null);

/** Limpia los huecos que llegan del cliente; una medida que falta toma el valor típico y se marca "de ejemplo". */
export function limpiarHuecos(v) {
  if (!Array.isArray(v)) return [];
  return v.filter(h => h && typeof h === "object").slice(0, 30).map(h => {
    const tipo = TIPOS_HUECO.includes(h.tipo) ? h.tipo : "puerta";
    const forma = FORMAS_HUECO.includes(h.forma) ? h.forma : "rectangular";
    const usadas = forma === "circular" ? ["diametro"] : ["ancho", "alto"];     // las medidas que usa esa forma
    const porDefecto = (Array.isArray(h.porDefecto) ? h.porDefecto : []).filter(k => usadas.includes(k));
    const medida = k => {
      const x = numeroPositivo(h[k]);
      if (x === null && usadas.includes(k) && !porDefecto.includes(k)) porDefecto.push(k);
      return x ?? HUECO_TIPICO[tipo][k];
    };
    const cantidad = Math.min(50, Math.max(1, Math.round(Number(h.cantidad) || 1)));
    return { tipo, forma, ancho: medida("ancho"), alto: medida("alto"), diametro: medida("diametro"), cantidad, porDefecto };
  });
}

/**
 * Huecos leídos de la descripción, completos para su tipo de obra:
 * - en un baño, cocina o cuarto se conservan la puerta o las ventanas típicas que no se nombraron
 *   ("un baño con puerta en arco" sigue teniendo su ventana);
 * - en una casa los huecos se estiman como un porcentaje del muro: uno solo no los reemplaza, así que
 *   no se aplica y se deja una nota para detallarlos todos en Medidas.
 * @returns {{ huecos: object[], nota: string | null }}
 */
export function completarHuecos(tipo, huecos) {
  if (!huecos.length) return { huecos, nota: null };
  const nombre = h => `${h.tipo}${h.forma === "arco" ? " en arco" : h.forma === "circular" ? " circular" : ""}`;
  if (tipo === "casa") return { huecos: [], nota: `Se nombró: ${huecos.map(nombre).join(", ")}. En una casa las puertas y ventanas se estiman como un porcentaje del muro; para usar su forma, detállelas todas en Medidas, en “Puertas y ventanas”.` };
  const nombrados = new Set(huecos.map(h => h.tipo));
  const tipicos = tipo === "muro" ? [] : HUECOS_TIPICOS[tipo].filter(h => !nombrados.has(h.tipo)).map(h => ({ ...h, porDefecto: ["ancho", "alto"] }));
  return { huecos: [...huecos, ...tipicos], nota: null };
}
