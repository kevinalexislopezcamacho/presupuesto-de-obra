/**
 * Precios de insumos (materiales, equipos y mano de obra) consultados en Cali.
 * - Materiales: precio de venta publicado por tiendas de Cali y Jamundí (Homecenter, Easy, Ferretería Jamundí,
 *   Ferromateriales del Sur…). Donde hay varias tiendas, el precio de referencia es la mediana (un precio por tienda,
 *   el normal y no el de oferta), para no depender de una sola; `tiendas` guarda cada precio con su enlace.
 * - Mano de obra: salario mensual + prestaciones del empleador, dividido en horas del mes.
 * - `estado`: "consultado" (precio publicado), "oficial" (tarifa pública) o "calculado".
 */

export const FECHA_PRECIOS = "24 al 27 de septiembre de 2026";
export const HERRAMIENTA_MENOR = 0.05; // % sobre la mano de obra

// Mano de obra: salario mensual + prestaciones y seguridad social del empleador, dividido en horas del mes.
export const SMMLV_2026 = 1750905;          // Decreto 1469 de 2025
export const AUX_TRANSPORTE_2026 = 249095;  // Decreto 1470 de 2025
export const HORAS_MES = 210;               // jornada de 42 h/semana desde el 15 de julio de 2026 (Ley 2101 de 2021)
export const FACTOR_PRESTACIONAL = {        // % sobre el salario, a cargo del empleador
  cesantias: 8.33, interesesCesantias: 1, prima: 8.33, vacaciones: 4.17,
  pension: 12, arlRiesgoV: 6.96, cajaCompensacion: 4
  // salud, SENA e ICBF exonerados para salarios < 10 SMMLV (art. 114-1 Estatuto Tributario)
};
// El auxilio de transporte también es base de cesantías, sus intereses y la prima (Ley 1 de 1963, art. 7);
// no lo es de vacaciones ni de seguridad social.
export const PRESTACIONES_CON_AUXILIO = ["cesantias", "interesesCesantias", "prima"];
export const SALARIO_OFICIAL = 1830669;     // promedio nacional reportado en Indeed (14 ago 2026, 189 reportes); no hay dato de Cali
const suma = claves => claves.reduce((s, k) => s + FACTOR_PRESTACIONAL[k], 0) / 100;
export const costoHora = salario => {
  const sobreSalario = suma(Object.keys(FACTOR_PRESTACIONAL)), sobreAuxilio = suma(PRESTACIONES_CON_AUXILIO);
  return Math.round((salario * (1 + sobreSalario) + AUX_TRANSPORTE_2026 * (1 + sobreAuxilio)) / HORAS_MES);
};

const HC = "Homecenter", HOY = "2026-09-24", HOY2 = "2026-09-27";
const FJ = "Ferretería Jamundí", FS = "Ferromateriales del Sur";

/** Mediana de los precios de varias tiendas (un precio por tienda). */
const mediana = xs => {
  const o = [...xs].sort((a, b) => a - b), m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
};
/** Precio de referencia a partir de varias tiendas: la mediana, con cada precio y su enlace para verificarlo. */
function deTiendas(tiendas, fecha = HOY2) {
  const precio = mediana(tiendas.map(t => t.precio));
  const central = tiendas.find(t => t.precio === precio) || tiendas[0];
  const distintas = new Set(tiendas.map(t => t.tienda.split(" (")[0])).size;
  return {
    precio, tiendas, fecha, estado: "consultado",
    // "Mediana de 3 tiendas", o "de 4 precios (2 tiendas)" si una tienda aporta varios productos.
    fuente: `Mediana de ${tiendas.length} ${distintas === tiendas.length ? "tiendas" : `precios (${distintas} tiendas)`}`, url: central.url,
    ref: tiendas.map(t => `${t.tienda} $${t.precio.toLocaleString("es-CO")}${t.nota ? ` (${t.nota})` : ""}`).join(" · ")
  };
}
const kgVarilla = { "3/8": 0.56, "1/2": 0.994 };   // kg por metro (NSR-10, tabla C.3.5.3-1)
export const INSUMOS = {
  cem: { nombre: "Cemento gris uso general 50 kg", unidad: "bulto", tipo: "material", tienda: "depósito de materiales de construcción",
         ...deTiendas([
           { tienda: HC, precio: 32500, nota: "Argos 50 kg", url: "https://www.homecenter.com.co/homecenter-co/product/13846/cemento-argos-gris-50kg/13846/" },
           { tienda: FJ, precio: 33990, nota: "Argos 50 kg; en oferta a $30.900", url: "https://ferreteriajamundi.co/producto/cemento-argos-x-50-kg-saco/" },
           { tienda: FS, precio: 32063, nota: "Argos 50 kg", url: "https://ferreteriajamundi.com/producto/cemento-argos-x-50-kg/" }
         ]) },
  are: { nombre: "Arena de río lavada", unidad: "m³", tipo: "material", tienda: "depósito de materiales de construcción",
         ...deTiendas([
           { tienda: FS, precio: 68000, nota: "arena mediana para concreto y pañete, en depósito", url: "https://ferreteriajamundi.com/producto/arena-mediana-mt3/" },
           { tienda: FJ, precio: 89000, nota: "arena mediana o gruesa, en depósito; en oferta a $75.000", url: "https://ferreteriajamundi.co/producto/arena-mediana-m3/" },
           { tienda: HC, precio: 287633, nota: "viaje de 3 m³ a $862.900, pedido especial, agotado", url: "https://www.homecenter.com.co/homecenter-co/product/297083/sp-arena-lavada-3m3/297083/" }
         ]) },
  gra: { nombre: "Triturado 3/4\"", unidad: "m³", tipo: "material", tienda: "depósito de materiales de construcción",
         ...deTiendas([
           { tienda: HC, precio: 98988, nota: "viaje de 8 m³ a $791.900", url: "https://www.homecenter.com.co/homecenter-co/product/362249/triturado-3-4-pulgada-a-granel-viaje-por-8m3/362249/" },
           { tienda: FS, precio: 109098, nota: "para concreto", url: "https://ferreteriajamundi.com/producto/triturado-3-4-x-mt3/" },
           { tienda: FJ, precio: 135900, nota: "en oferta a $115.000", url: "https://ferreteriajamundi.co/producto/triturado-3-4-x-mt3/" }
         ]) },
  agu: { nombre: "Agua", unidad: "m³", precio: 11891, tipo: "servicio",
         fuente: "EMCALI", ref: "Tarifa Temporal (obras) desde el 15 jul 2026: acueducto $5.615,71 + alcantarillado $6.275,75 por m³; sin cargos fijos mensuales", url: "https://www.emcali.com.co/acueducto/tarifas-de-acueducto", fecha: "2026-07-15", estado: "oficial" },
  blq: { nombre: "Bloque de arcilla N.º 5", unidad: "und", tipo: "material", tienda: "ladrillera bloques de arcilla",
         ...deTiendas([
           { tienda: HC, precio: 2350, nota: "N5 33×23×12 cm; en oferta a $2.100", url: "https://www.homecenter.com.co/homecenter-co/product/499020/bloque-n5-trad-33x23x12cm-125und-m2/499020/" },
           { tienda: "Easy", precio: 2100, nota: "N.5 33×23×11,5 cm Santafé", url: "https://www.easy.com.co/bloque-tradicional-n-5-33x23x11-5-santaf/p" }
         ]) },
  blc: { nombre: "Bloque de concreto 12×20×40", unidad: "und", precio: 1900, tipo: "material", tienda: "bloquera bloques de concreto",
         fuente: HC, ref: "Bloque en concreto 12×20×40 R13 gris", url: "https://www.homecenter.com.co/homecenter-co/product/403995/bloque-en-concreto-12x20x40-cm-r13-gris/403995/", fecha: HOY, estado: "consultado" },
  acr: { nombre: "Acero corrugado fy 420 MPa", unidad: "kg", tipo: "material", tienda: "venta de hierro para construcción",
         ...deTiendas([
           { tienda: HC, precio: Math.round(14430 / (6 * kgVarilla["3/8"])), nota: "varilla 3/8\" × 6 m a $14.430", url: "https://www.homecenter.com.co/homecenter-co/product/84303/varilla-g-60-w-3-8-pulg-x-6m-336kg-aprox-corrugada/84303/" },
           { tienda: FS, precio: Math.round(28749 / (6 * kgVarilla["1/2"])), nota: "varilla 1/2\" × 6 m a $28.749", url: "https://ferreteriajamundi.com/producto/varilla-corrugada-1-2-x-6mts/" },
           { tienda: FJ, precio: Math.round(18990 / (6 * kgVarilla["3/8"])), nota: "varilla 3/8\" × 6 m a $18.990; en oferta a $16.300", url: "https://ferreteriajamundi.co/producto/varilla-corr-3-8/" }
         ]) },
  alb: { nombre: "Alambre negro cal. 18", unidad: "kg", precio: 6790, tipo: "material", tienda: "ferretería",
         fuente: HC, ref: "Alambre negro cal. 18, rollo 10 kg ($67.900)", url: "https://www.homecenter.com.co/homecenter-co/product/02199/alambre-negro-10k-aprox-cal18/02199/", fecha: HOY, estado: "consultado" },
  mal: { nombre: "Malla electrosoldada D-84", unidad: "m²", precio: 5674, tipo: "material", tienda: "venta de hierro para construcción",
         fuente: HC, ref: "Malla 6 × 2,35 m (14,1 m²), 15×15 cm, 4 mm ($80.000)", url: "https://www.homecenter.com.co/homecenter-co/product/43266/malla-electrosoldada-medidas-6x235m-hueco-15x15cm-diametro-40mm-xx-084/43266/", fecha: HOY, estado: "consultado" },
  for: { nombre: "Formaleta en madera (3 usos)", unidad: "m²", precio: 25459, tipo: "material", tienda: "alquiler de formaleta",
         fuente: "EMCALI 2025", ref: "Ítem 10003647: formaleta en madera 3 usos, incluye materiales, mano de obra e instalación. Los APU de concreto solo suman la mano de obra del vaciado; el material solo (tablero de 15 usos de Homecenter, $50.353/m² ÷ 15) dejaría columnas y vigas muy por debajo de las referencias oficiales de Cali", url: "https://www.emcali.com.co/documents/d/guest/lista-de-precios-emcali-2025-oficial", fecha: "2025", estado: "oficial" },
  pun: { nombre: "Puntilla con cabeza 2\"", unidad: "lb", precio: 4355, tipo: "material", tienda: "ferretería",
         fuente: HC, ref: "Puntilla con cabeza 2\" 500 g ($4.800 → $9.600/kg)", url: "https://www.homecenter.com.co/homecenter-co/product/91606/puntilla-con-cabeza-2pg-500g/91606/", fecha: HOY, estado: "consultado" },
  cpa: { nombre: "Cerámica para pared", unidad: "m²", precio: 22153, tipo: "material", tienda: "almacén de cerámicas",
         fuente: HC, ref: "Pared cerámica plana blanco 30×60 Corona, caja 1,44 m²", url: "https://www.homecenter.com.co/homecenter-co/product/500901/pared-ceramica-plana-blanco-30x60cm-caja-144-m2-corona/500901/", fecha: HOY, estado: "consultado" },
  cpi: { nombre: "Cerámica para piso", unidad: "m²", tipo: "material", tienda: "almacén de cerámicas",
         ...deTiendas([
           { tienda: `${HC} (Corona Saona 51×51)`, precio: 30900, url: "https://www.homecenter.com.co/homecenter-co/category/cat1640001/pisos-ceramicos/" },
           { tienda: `${HC} (Corona Hara gris 51×51)`, precio: 39900, url: "https://www.homecenter.com.co/homecenter-co/category/cat1640001/pisos-ceramicos/" },
           { tienda: `${HC} (Corona Hara beige 51×51)`, precio: 40600, url: "https://www.homecenter.com.co/homecenter-co/category/cat1640001/pisos-ceramicos/" },
           { tienda: `${FJ} (cerámica piso 60×60)`, precio: 68000, nota: "en oferta a $65.000", url: "https://ferreteriajamundi.co/producto/ceramica-60x60-m2/" }
         ]) },
  peg: { nombre: "Pegante cerámico 25 kg", unidad: "bulto", precio: 37400, tipo: "material", tienda: "almacén de cerámicas",
         fuente: HC, ref: "Pegacor cerámico gris 25 kg Corona (rinde 5 m²)", url: "https://www.homecenter.com.co/homecenter-co/product/298882/pegacor-ceramico-gris-25-kg-corona/298882/", fecha: HOY, estado: "consultado" },
  boq: { nombre: "Boquilla para cerámica", unidad: "kg", precio: 8450, tipo: "material", tienda: "almacén de cerámicas",
         fuente: HC, ref: "Boquilla Concolor gris cemento 2 kg ($16.900)", url: "https://www.homecenter.com.co/homecenter-co/product/302533/boquilla-concolor-junta-estrecha-gris-cemento-2kg/302533/", fecha: HOY, estado: "consultado" },
  imp: { nombre: "Impermeabilizante cementicio", unidad: "kg", precio: 3356, tipo: "material", tienda: "ferretería impermeabilizantes",
         fuente: HC, ref: "Sika mortero impermeable 25 kg ($83.900, rinde 2 kg/m²)", url: "https://www.homecenter.com.co/homecenter-co/product/241604/sika-mortero-impermeable-recubrimiento-cementos-gris-25kg/241604/", fecha: HOY, estado: "consultado" },
  tps: { nombre: "Tubería PVC sanitaria 2\"", unidad: "m", precio: 8000, tipo: "material", tienda: "ferretería tubería PVC",
         fuente: HC, ref: "Tubo 2\" × 1 m sanitaria Pavco Wavin", url: "https://www.homecenter.com.co/homecenter-co/product/06198/tubo-2x1-metros-sanitaria/06198/", fecha: HOY, estado: "consultado" },
  tpp: { nombre: "Tubería PVC presión 1/2\"", unidad: "m", precio: 1983, tipo: "material", tienda: "ferretería tubería PVC",
         fuente: "Easy", ref: "Tubo PVC presión 1/2\" × 6 m RDE 13.5 Gerfor ($11.900)", url: "https://www.easy.com.co/tubo-pvc-presion-12x6m-rde-13-5-gerfor/p", fecha: HOY, estado: "consultado" },
  acc: { nombre: "Accesorios PVC (codos, tees)", unidad: "und", precio: 3657, tipo: "material", tienda: "ferretería tubería PVC",
         fuente: "Distribuciones PVC (Cali)", ref: "Codo sanitario Pavco 2\" C×C 90°", url: "https://distribucionespvc.com.co/producto/codo-sanitario-pavco-c-x-c-2-pulgadas-90-grados/", fecha: HOY, estado: "consultado" },
  mez: { nombre: "Mezcladora de 1 bulto", unidad: "h", precio: Math.round(87000 / 8), tipo: "equipo",
         fuente: "Akirento", ref: "Alquiler mezcladora 500 L (1,5-2 bultos) $87.000/día ÷ 8 h; tarifa de Bogotá y Medellín, no publican Cali", url: "https://akirento.com/product/mezcladora-de-concreto/", fecha: HOY, estado: "consultado" },
  vib: { nombre: "Vibrador de concreto", unidad: "h", precio: Math.round(62000 / 8), tipo: "equipo",
         fuente: "Akirento", ref: "Alquiler vibrador eléctrico $62.000/día ÷ 8 h; tarifa de Bogotá y Medellín, no publican Cali", url: "https://akirento.com/product/vibrador-de-concreto/", fecha: HOY, estado: "consultado" },
  mof: { nombre: "Oficial de construcción", unidad: "hh", precio: costoHora(SALARIO_OFICIAL), tipo: "mo",
         fuente: "Indeed", ref: "Salario promedio de oficial de obra en Colombia $1.830.669/mes (Indeed, 189 reportes, 14 ago 2026; Computrabajo: $1.869.088, 11 sep 2026) + prestaciones + auxilio de transporte ÷ 210 h. Indeed para Cali tiene solo 6 reportes y no se usa", url: "https://co.indeed.com/career/oficial-de-obra/salaries", fecha: "2026-08-14", estado: "calculado" },
  may: { nombre: "Ayudante de construcción", unidad: "hh", precio: costoHora(SMMLV_2026), tipo: "mo",
         fuente: "Calculado", ref: "1 SMMLV 2026 + prestaciones + auxilio de transporte ÷ 210 h (Comfandi ofrece $1.750.905 a ayudantes de construcción en Cali, elempleo, sep 2026)", url: "https://www.elempleo.com/co/ofertas-empleo/trabajo-oficiales-de-obra", fecha: HOY, estado: "calculado" }
};
