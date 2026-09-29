/**
 * Qué actividades (y cuántas unidades de cada una) tiene cada tipo de construcción,
 * con la memoria de cantidades: de dónde sale cada número.
 */

import { APU } from "../datos/apu.js";
import { SUPUESTOS as S } from "../datos/supuestos.js";
import { TIPOS } from "../datos/tipos-obra.js";
import { r2, decimal as d } from "./numeros.js";
import { areaHuecos, describirHueco } from "./huecos.js";

const MUROS = ["MAM-01", "MAM-02"];
/** Demoliciones que se agregan en una remodelación: se quita lo existente antes de poner lo nuevo. */
export const DEMOLICIONES = { "ACB-01": "DEM-01", "ACB-02": "DEM-02" };

// Muros confinados: muro + columnas + viga de amarre + viga de cimentación + acero.
// `recorrido` explica de dónde sale la longitud de muros y `detalleVanos`, cuáles son las puertas y ventanas
// (para la memoria de cantidades).
function estructuraMuros(longitud, alto, areaVanos, sistema, cerrado, recorrido, detalleVanos = "") {
  const nCol = cerrado ? Math.max(4, Math.ceil(longitud / S.sepColumnas)) : Math.ceil(longitud / S.sepColumnas) + 1;
  const mlColumnas = nCol * alto;
  const areaMuro = Math.max(0, longitud * alto - areaVanos);
  const acero = (mlColumnas + longitud) * S.aceroConfinamiento + longitud * S.aceroCimentacion;
  return {
    nCol, areaMuro,
    lineas: [
      [sistema === "concreto" ? "MAM-02" : "MAM-01", areaMuro,
        `${recorrido} × ${d(alto)} m de alto${areaVanos ? ` − ${d(areaVanos)} m² de puertas y ventanas${detalleVanos ? ` (${detalleVanos})` : ""}` : ""}`],
      ["CON-01", mlColumnas, `${nCol} columnas (una cada ${d(S.sepColumnas)} m${cerrado ? ", mínimo 4" : ", más la del extremo"}) × ${d(alto)} m de alto`],
      ["CON-02", longitud, recorrido],
      ["CON-05", longitud, recorrido],
      ["ACE-01", acero, `(${d(mlColumnas)} m de columnas + ${d(longitud)} m de viga de amarre) × ${d(S.aceroConfinamiento)} kg/m + ${d(longitud)} m de viga de cimentación × ${d(S.aceroCimentacion)} kg/m`]
    ]
  };
}

/** Excavación, concreto de limpieza, relleno y retiro de sobrantes de la cimentación que quedó en la obra. */
function movimientoDeTierra(vigaMl, nZapatas) {
  if (!(vigaMl > 0) && !(nZapatas > 0)) return [];
  const excZanja = S.anchoZanjaViga * S.fondoZanjaViga, ladoZ = S.ladoExcavacionZapata;
  const excZapata = ladoZ * ladoZ * S.fondoExcavacionZapata, soladoZapata = ladoZ * ladoZ;
  const excavacion = vigaMl * excZanja + nZapatas * excZapata;
  const solado = vigaMl * S.anchoZanjaViga + nZapatas * soladoZapata;
  const concreto = vigaMl * S.seccionVigaCimentacion + nZapatas * S.zapataPorColumna + solado * S.espesorSolado;
  const relleno = Math.max(0, excavacion - concreto);
  const sobrante = (excavacion - relleno) * S.esponjamiento;
  const partes = (viga, zapata) => [vigaMl > 0 ? viga : "", nZapatas > 0 ? zapata : ""].filter(Boolean).join(" + ");
  return [
    ["EXC-01", excavacion, partes(`${d(vigaMl)} m de viga de cimentación × ${d(S.anchoZanjaViga)} × ${d(S.fondoZanjaViga)} m`,
      `${nZapatas} zapatas × ${d(ladoZ)} × ${d(ladoZ)} × ${d(S.fondoExcavacionZapata)} m`)],
    ["CON-06", solado, partes(`${d(vigaMl)} m × ${d(S.anchoZanjaViga)} m bajo la viga`, `${nZapatas} zapatas × ${d(ladoZ)} × ${d(ladoZ)} m`)],
    ["EXC-02", relleno, `${d(excavacion)} m³ excavados − ${d(concreto)} m³ de concreto (viga, zapatas y solado)`],
    ["EXC-03", sobrante, `${d(concreto)} m³ de tierra que desplaza el concreto × ${d(S.esponjamiento)} de esponjamiento`]
  ];
}

/**
 * @param {string} tipo muro, bano, cocina, cuarto o casa
 * @param {object} m medidas
 * @param {{ excluir?: string[], remodelacion?: boolean, huecos?: object[] }} opciones lo que la persona pidió quitar,
 *   si el espacio ya existe y las puertas y ventanas con su forma (si las detalló, reemplazan las típicas)
 * @returns {{ codigo: string, cantidad: number, memoria: { texto: string, cantidad: number }[] }[]}
 */
export function generarActividades(tipo, m, { excluir = [], remodelacion = false, huecos = [] } = {}) {
  const fuera = new Set(excluir);
  let lineas = [], planta = 0, nZapatas = 0;
  const P = 2 * ((m.largo || 0) + (m.ancho || 0));
  const perimetro = `perímetro 2 × (${d(m.largo)} + ${d(m.ancho)}) = ${d(P)} m`;
  const detallados = huecos.length > 0;
  const vanos = tipico => (detallados ? areaHuecos(huecos) : tipico);
  const detalle = detallados ? huecos.map(describirHueco).join(", ") : "";
  // Enchape del baño: se descuentan las puertas (las ventanas suelen quedar por encima del enchape).
  const puertas = detallados ? areaHuecos(huecos.filter(h => h.tipo === "puerta")) : S.puerta;
  if (tipo === "muro") {
    lineas = estructuraMuros(m.largo, m.alto, vanos(m.vanos), m.sistema, false, `${d(m.largo)} m de muro`, detalle).lineas;
    planta = [m.largo * S.franjaReplanteoMuro, `${d(m.largo)} m × franja de ${d(S.franjaReplanteoMuro)} m`];
  } else if (tipo === "bano") {
    const e = estructuraMuros(P, m.alto, vanos(S.puerta + S.ventana), m.sistema, true, perimetro, detalle);
    const area = m.largo * m.ancho;
    lineas = [...e.lineas,
      ["CON-03", area, `${d(m.largo)} × ${d(m.ancho)} m`], ["PAN-01", e.areaMuro, "área de muros (una cara)"],
      ["ACB-01", Math.max(0, P * Math.min(m.alto, S.alturaEnchape) - puertas), `${d(P)} m × ${d(Math.min(m.alto, S.alturaEnchape))} m de alto − ${detallados ? `${d(puertas)} m² de puertas` : `una puerta de ${d(S.puerta)} m²`}`],
      ["ACB-02", area, `${d(m.largo)} × ${d(m.ancho)} m`], ["IMP-01", area + 2, `${d(area)} m² de piso + 2 m² de muros de la ducha`],
      ["HID-01", 4, "sanitario, lavamanos, ducha y sifón de piso"]];
    planta = [area, `${d(m.largo)} × ${d(m.ancho)} m`];
  } else if (tipo === "cocina") {
    const e = estructuraMuros(P, m.alto, vanos(S.puerta + 2 * S.ventana), m.sistema, true, perimetro, detalle);
    const area = m.largo * m.ancho;
    lineas = [...e.lineas,
      ["CON-03", area, `${d(m.largo)} × ${d(m.ancho)} m`], ["PAN-01", e.areaMuro, "área de muros (una cara)"],
      ["ACB-01", m.meson * 0.6, `${d(m.meson)} m de mesón × 0,60 m de salpicadero`],
      ["ACB-02", area, `${d(m.largo)} × ${d(m.ancho)} m`], ["MES-01", m.meson, "largo del mesón"], ["HID-01", 2, "lavaplatos y lavadero"]];
    planta = [area, `${d(m.largo)} × ${d(m.ancho)} m`];
  } else if (tipo === "cuarto") {
    const e = estructuraMuros(P, m.alto, vanos(S.puerta + S.ventanaCuarto), m.sistema, true, perimetro, detalle);
    const area = m.largo * m.ancho;
    lineas = [...e.lineas, ["CON-03", area, `${d(m.largo)} × ${d(m.ancho)} m`], ["PAN-01", e.areaMuro * 2, "área de muros × 2 caras"],
      ["ACB-02", area, `${d(m.largo)} × ${d(m.ancho)} m`]];
    planta = [area, `${d(m.largo)} × ${d(m.ancho)} m`];
  } else if (tipo === "casa") {
    const longitudMuros = P * (1 + S.murosInternosCasa);
    const e = estructuraMuros(longitudMuros, m.alto, vanos(longitudMuros * m.alto * S.vanosCasa), m.sistema, true,
      `${perimetro} × ${d(1 + S.murosInternosCasa)} (más unos ${Math.round(S.murosInternosCasa * 100)} % de muros internos) = ${d(longitudMuros)} m`,
      detallados ? detalle : `unos ${Math.round(S.vanosCasa * 100)} % del área de muros`);
    const b = Math.max(0, Math.round(m.banos)), area = m.largo * m.ancho;
    nZapatas = e.nCol;
    lineas = [...e.lineas,
      ["CON-04", e.nCol * S.zapataPorColumna, `${e.nCol} zapatas × ${d(S.zapataPorColumna)} m³ (0,60 × 0,60 × 0,40 m)`],
      ["CON-03", area, `${d(m.largo)} × ${d(m.ancho)} m`], ["PAN-01", e.areaMuro * 2, "área de muros × 2 caras"],
      ["ACB-02", area, `${d(m.largo)} × ${d(m.ancho)} m`],
      ["ACB-01", b * S.enchapePorBano + 1.8, `${b} ${b === 1 ? "baño" : "baños"} × ${d(S.enchapePorBano)} m² + 1,8 m² de salpicadero de cocina`],
      ["IMP-01", b * (S.pisoPorBano + 2), `${b} × (${d(S.pisoPorBano)} m² de piso + 2 m² de ducha)`],
      ["MES-01", 3, "mesón de cocina típico"], ["HID-01", b * 4 + 2, `${b} × 4 puntos por baño + 2 de cocina`]];
    planta = [area, `${d(m.largo)} × ${d(m.ancho)} m`];
  }

  // Lo que la persona pidió quitar; después, lo que depende de lo que quedó.
  lineas = lineas.filter(([c]) => !fuera.has(c) && !(MUROS.includes(c) && MUROS.some(x => fuera.has(x))));
  const hay = codigo => lineas.find(([c]) => c === codigo);
  const derivadas = [];
  if (planta && lineas.some(([c]) => MUROS.includes(c))) derivadas.push(["PRE-01", planta[0], `área en planta: ${planta[1]}`]);
  derivadas.push(...movimientoDeTierra(hay("CON-05")?.[1] || 0, hay("CON-04") ? nZapatas : 0));
  if (remodelacion) for (const [nuevo, demolicion] of Object.entries(DEMOLICIONES)) {
    const l = hay(nuevo);
    if (l) derivadas.push([demolicion, l[1], `misma área de ${nuevo === "ACB-01" ? "enchape" : "piso"} que se va a cambiar`]);
  }
  return unirLineas([...lineas, ...derivadas]
    .filter(([c, cantidad]) => !fuera.has(c) && cantidad > 0)
    .map(([c, cantidad, texto]) => [c, cantidad, [{ texto, cantidad: r2(cantidad) }]]));
}

/** Medidas por defecto de un tipo de construcción. */
export const medidasPorDefecto = tipo =>
  ({ sistema: "arcilla", ...Object.fromEntries(TIPOS[tipo].campos.map(([campo, , valor]) => [campo, valor])) });

/** Códigos de las actividades que genera un tipo de construcción (sin las demoliciones de remodelación). */
export const actividadesDelTipo = tipo => generarActividades(tipo, medidasPorDefecto(tipo)).map(l => l.codigo);

// Actividades que la persona pidió quitar de una parte ("sin enchape"). El muro es el mismo aunque
// cambie el bloque: quitar uno quita los dos.
const CODIGOS_APU = new Set(APU.map(a => a.codigo));
export function limpiarExcluidas(v) {
  const codigos = new Set((Array.isArray(v) ? v : []).filter(c => CODIGOS_APU.has(c)));
  if (MUROS.some(c => codigos.has(c))) MUROS.forEach(c => codigos.add(c));
  return [...codigos];
}

/**
 * Suma las cantidades de un mismo código y junta su memoria.
 * @param {[string, number, { texto: string, cantidad: number, parte?: string }[]?][]} lineas
 */
export function unirLineas(lineas) {
  const mapa = new Map();
  for (const [codigo, cantidad, memoria = []] of lineas) {
    const x = mapa.get(codigo) || { codigo, cantidad: 0, memoria: [] };
    x.cantidad += cantidad;
    x.memoria.push(...memoria);
    mapa.set(codigo, x);
  }
  return [...mapa.values()].map(x => ({ ...x, cantidad: r2(x.cantidad) }));
}

export function validarMedidas(tipo, m) {
  const errores = [], advertencias = [];
  for (const [campo, etiqueta] of TIPOS[tipo].campos) {
    const v = m[campo];
    const puedeSerCero = campo === "vanos" || campo === "banos";
    if (!(v >= 0) || (!puedeSerCero && v <= 0)) errores.push(`${etiqueta}: escriba un valor ${puedeSerCero ? "de 0 o más" : "mayor que 0"}.`);
  }
  if (m.alto > 6)
    advertencias.push(`Un muro de ${d(m.alto)} m de alto equivale a unos ${Math.round(m.alto / 2.5)} pisos. La mampostería confinada que calcula esta herramienta es para muros de un piso (hasta unos 3 m); algo así necesita una estructura en concreto diseñada por un ingeniero, y el precio real será mayor.`);
  else if (m.alto > S.alturaMaxSinRevision)
    advertencias.push(`Muros de más de ${S.alturaMaxSinRevision} m de alto: requieren revisión de un ingeniero estructural (NSR-10).`);
  if (tipo === "muro" && m.vanos >= m.largo * m.alto) errores.push("Las puertas y ventanas no pueden ocupar todo el muro.");
  if (tipo === "cocina" && m.meson > 2 * (m.largo + m.ancho)) errores.push("El mesón es más largo que el perímetro de la cocina.");
  // Recomendaciones: no impiden calcular, pero avisan de medidas poco usuales.
  const menor = Math.min(m.largo || Infinity, m.ancho || Infinity);
  if (tipo === "bano" && menor < 1.2) advertencias.push("Un baño de menos de 1,2 m de ancho queda muy estrecho; lo usual es al menos 1,2 × 1,5 m.");
  if (tipo === "cocina" && menor < 1.8) advertencias.push("Una cocina de menos de 1,8 m de ancho deja poco espacio frente al mesón; lo usual es 2 m o más.");
  if (tipo === "cuarto" && menor < 2.4) advertencias.push("Un cuarto de menos de 2,4 m de lado queda pequeño para una cama doble y un clóset.");
  if (tipo !== "muro" && m.alto > 0 && m.alto < 2.2) advertencias.push("Con menos de 2,2 m de alto el espacio queda incómodo; lo usual es 2,4 m o más.");
  if (tipo === "muro" && m.vanos > 0.5 * m.largo * m.alto && m.vanos < m.largo * m.alto)
    advertencias.push("Las puertas y ventanas ocupan más de la mitad del muro: conviene revisar con un ingeniero si sigue funcionando como muro confinado.");
  if (tipo === "cocina" && m.meson > 0 && m.meson < 1.2) advertencias.push("Un mesón de menos de 1,2 m apenas deja espacio para el lavaplatos y la estufa.");
  if (tipo === "casa" && m.banos === 0) advertencias.push("La casa no tiene baños: si es vivienda, necesita al menos uno.");
  if (["largo", "ancho", "alto"].some(k => m[k] > 40)) advertencias.push("Hay una medida de más de 40 m. ¿Está en metros? (300 cm = 3 m)");
  return { errores, advertencias };
}
