/**
 * Capítulos del presupuesto, en el orden usual de un presupuesto de obra en Colombia
 * (el mismo de los listados oficiales: preliminares, cimentación, estructura, mampostería…).
 * El cronograma usa otro orden, el de construcción (ver dominio/cronograma.js).
 */
export const CAPITULOS = [
  { numero: 1, nombre: "Preliminares", codigos: ["PRE-01", "DEM-01", "DEM-02"] },
  { numero: 2, nombre: "Excavaciones y rellenos", codigos: ["EXC-01", "EXC-02", "EXC-03"] },
  { numero: 3, nombre: "Cimentación", codigos: ["CON-06", "CON-04", "CON-05"] },
  { numero: 4, nombre: "Estructura en concreto y acero", codigos: ["ACE-01", "CON-01", "CON-02"] },
  { numero: 5, nombre: "Mampostería", codigos: ["MAM-01", "MAM-02"] },
  { numero: 6, nombre: "Placas de contrapiso", codigos: ["ACE-02", "CON-03"] },
  { numero: 7, nombre: "Instalaciones hidrosanitarias", codigos: ["HID-01"] },
  { numero: 8, nombre: "Pañetes", codigos: ["PAN-01"] },
  { numero: 9, nombre: "Enchapes, pisos y mesones", codigos: ["IMP-01", "ACB-01", "ACB-02", "MES-01"] },
  { numero: 10, nombre: "Ítems de la lista oficial", codigos: [] },  // los que se agregan desde el catálogo de la Gobernación
  { numero: 11, nombre: "Ítems cotizados", codigos: [] },            // lo que no está en la base: con el precio de una cotización
  { numero: 12, nombre: "Materiales adicionales", codigos: [] }      // compras aparte escritas en el cuadro rápido del presupuesto
];

/** Código de un ítem cotizado en el presupuesto ("COT-c1"). */
export const PREFIJO_COTIZADO = "COT-";
/** Código de una compra adicional de material en el presupuesto ("MAT-cem"). */
export const PREFIJO_ADICIONAL = "MAT-";
const OFICIALES = CAPITULOS[9], COTIZADOS = CAPITULOS[10], ADICIONALES = CAPITULOS[11];

/** Capítulo de una actividad (los ítems del catálogo oficial, los cotizados y las compras adicionales van al final). */
export const capituloDe = codigo => CAPITULOS.find(c => c.codigos.includes(codigo))
  || (String(codigo).startsWith(PREFIJO_COTIZADO) ? COTIZADOS : String(codigo).startsWith(PREFIJO_ADICIONAL) ? ADICIONALES : OFICIALES);
