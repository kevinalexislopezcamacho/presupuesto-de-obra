/**
 * Verifica lo que devuelve la IA antes de usarlo. La IA entiende mejor el lenguaje, pero la herramienta
 * no le cree a ciegas:
 * - cada número tiene que estar en lo que escribió la persona (o ser el mismo en cm o mm pasado a metros);
 * - solo se aceptan tipos, códigos e insumos que existen;
 * - las cantidades de trabajos y las conversiones de unidades las calcula la herramienta, no la IA.
 * Lo que no pasa la revisión se descarta y se avisa en `verificacion`.
 */
import { INSUMOS } from "../datos/precios.js";
import { TIPOS } from "../datos/tipos-obra.js";
import { SUPUESTOS as S } from "../datos/supuestos.js";
import { TRABAJOS, NUM_PALABRAS } from "../datos/lenguaje.js";
import { AMBIGUOS } from "../datos/materiales.js";
import { limpiarExcluidas } from "../dominio/actividades.js";
import { TIPOS_HUECO, FORMAS_HUECO, limpiarHuecos, completarHuecos } from "../dominio/huecos.js";
import { r2, decimal } from "../dominio/numeros.js";
import { convertirUnidad, quitarMiles, elegirTipo, unidadEscrita } from "../dominio/materiales-texto.js";
import { revisarTrabajo, interpretarTexto, extraerMedidas, notaDistribucionCasa, hablaDeEspaciosCasa } from "../dominio/texto/interprete.js";
import { limpiarTexto, normalizar } from "../dominio/texto/normalizar.js";
import { CATEGORIAS_NO_SOPORTADO } from "./instrucciones.js";

const esObjeto = v => v !== null && typeof v === "object" && !Array.isArray(v);
const lista = v => (Array.isArray(v) ? v.filter(esObjeto) : []);
const cadena = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Números que aparecen en un texto: "2,5" → 2.5; "1.500" → 1500 (y 1.5); "dos" → 2; "medio" → 0.5. */
export function numerosDe(texto) {
  const nums = new Set();
  for (const t of [limpiarTexto(texto), limpiarTexto(quitarMiles(texto))]) {
    for (const n of t.match(/\d+(?:\.\d+)?/g) || []) nums.add(Number(n));
    for (const w of t.match(/[a-z]+/g) || []) if (w in NUM_PALABRAS) nums.add(NUM_PALABRAS[w]);
    if (/\b(medio|media)\b/.test(t)) nums.add(0.5);
  }
  return [...nums];
}

const igual = (a, b) => Math.abs(a - b) < 1e-6;
/** ¿El valor sale de lo escrito? Igual, o el mismo número en centímetros o milímetros pasado a metros. */
const enMetros = (v, nums) => nums.some(n => igual(n, v) || igual(n / 100, v) || igual(n / 1000, v));
const exacto = (v, nums) => nums.some(n => igual(n, v));

/** Revisa un fragmento: si es copia literal del mensaje, sus números son la referencia; si no, los de todo el mensaje. */
function contexto(fragmento, original, todos) {
  const texto = cadena(fragmento);
  const literal = texto && normalizar(original).replace(/\s+/g, " ").includes(normalizar(texto).replace(/\s+/g, " "));
  return { texto: texto || original.slice(0, 300), nums: literal ? numerosDe(texto) : todos, literal: Boolean(literal) };
}

function crearTomador(avisos) {
  /** Acepta un número de la IA solo si está en el texto; si no, lo descarta y avisa. */
  return (v, { nums, texto }, que, comparar = enMetros) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && comparar(v, nums)) return v;
    avisos.push(`No se usó ${que} = ${typeof v === "number" ? decimal(v) : String(v)} en “${texto}”: ese número no está en la descripción.`);
    return undefined;
  };
}

// "4 muros": la cantidad debe estar escrita; 1 se acepta aunque no lo diga ("un baño", "baño").
function contar(v, ctx, que, tomar) {
  if (v === null || v === undefined) return undefined;
  if (v === 1) return 1;
  const valido = Number.isInteger(v) && v >= 1 && v <= 500;
  return tomar(v, ctx, que, valido ? exacto : () => false);
}

/** Cantidad de un trabajo suelto a partir de sus medidas, con la explicación de la cuenta. */
function cantidadTrabajo(codigo, m, espacio) {
  const medida = TRABAJOS.find(t => t.codigo === codigo)?.medida;
  const d = decimal;
  if (medida === "cantidad") return { cantidad: m.conteo ?? 0, detalle: "" };
  if (medida === "zapatas") return m.conteo ? { cantidad: r2(m.conteo * S.zapataPorColumna), detalle: `${d(m.conteo)} zapatas × ${d(S.zapataPorColumna)} m³` } : { cantidad: 0, detalle: "" };
  if (medida === "largo") {
    if (codigo === "CON-01" && m.conteo) {
      const alto = m.alto ?? 2.4;
      return { cantidad: r2(m.conteo * alto), detalle: `${d(m.conteo)} ${m.conteo === 1 ? "columna" : "columnas"} × ${d(alto)} m de alto${m.alto ? "" : " (supuesto)"}` };
    }
    return { cantidad: m.largo ?? 0, detalle: "" };
  }
  if (m.area) return { cantidad: m.area, detalle: "" };
  if (medida === "pared" && espacio && espacio !== "muro" && m.largo && m.ancho) {
    const alto = m.alto ?? (espacio === "bano" ? S.alturaEnchape : 2.4);
    return { cantidad: r2(Math.max(0, 2 * (m.largo + m.ancho) * alto - S.puerta)),
      detalle: `paredes de un espacio de ${d(m.largo)} × ${d(m.ancho)} m con ${d(alto)} m de alto${m.alto ? "" : " (supuesto)"}, menos una puerta` };
  }
  const alto = m.alto ?? m.ancho;
  if (medida === "pared" && m.largo && alto) return { cantidad: r2(m.largo * alto), detalle: `${d(m.largo)} × ${d(alto)} m` };
  if (m.largo && m.ancho) return { cantidad: r2(m.largo * m.ancho), detalle: `${d(m.largo)} × ${d(m.ancho)} m` };
  return { cantidad: 0, detalle: "" };
}

const UNIDAD_INTERNA = { m3: "m³", m2: "m²", ninguna: null };

/** Un material que la persona dice tener, con la cantidad pasada a la unidad del insumo. */
function verificarMaterial(m, original, todos, req, tomar) {
  const ctx = contexto(m.texto, original, todos);
  let id = INSUMOS[m.id]?.tipo === "material" ? m.id : null;
  if (!id) return { texto: ctx.texto, id: null, cantidad: null, nota: "No está en la base de la herramienta: no se tiene en cuenta en el cálculo." };
  const notas = [];
  const grupo = AMBIGUOS.find(g => g.ids.includes(id));
  if (grupo && !m.tipoDicho && !grupo.tipo.test(normalizar(ctx.texto))) {
    const eleccion = elegirTipo(grupo, id, req);
    id = eleccion.id;
    notas.push(eleccion.nota);
  }
  let cantidad = tomar(m.cantidad, ctx, "la cantidad", exacto) ?? null;
  if (cantidad !== null) {
    // La unidad que está escrita manda: "3 volquetas" no son 3 m³ aunque la IA lo diga.
    const escrita = unidadEscrita(ctx.texto);
    const unidadIA = m.unidad in UNIDAD_INTERNA ? UNIDAD_INTERNA[m.unidad] : m.unidad;
    const unidad = escrita ? escrita.unidad : unidadIA, palabra = escrita ? escrita.palabra : m.unidad;
    const calibre = m.calibre && m.calibre !== "no-dice" ? m.calibre : null;
    const cv = convertirUnidad(id, cantidad, unidad, palabra, limpiarTexto(ctx.texto), calibre);
    cantidad = cv.cantidad;
    if (cv.nota) notas.push(cv.nota);
  }
  return { texto: ctx.texto, id, cantidad, nota: notas.join(" ") };
}

/** La parte de un texto que solo puede ser de un tipo: la lee el intérprete por reglas (cantidad, medidas, "sin …"). */
function parteDeDuda(texto, tipo) {
  const regla = interpretarTexto(texto).partes.find(p => p.tipo === tipo);
  if (regla) { const { p, ...parte } = regla; return { ...parte, fuente: "la IA" }; }
  const { medidas, sistema, estimadas, huecos } = extraerMedidas(texto, tipo);
  return { tipo, cantidad: 1, medidas, sistema, estimadas, excluir: [], remodelacion: false, huecos, fuente: "la IA", texto };
}

/**
 * Convierte la respuesta de la IA sobre la descripción en el mismo formato del intérprete por reglas.
 * @param {object} salida JSON de la IA (ver ESQUEMA_OBRA)
 * @param {string} original texto que escribió la persona
 * @param {object} req materiales que usa la obra (para elegir entre materiales parecidos)
 */
export function verificarObra(salida, original, req = {}) {
  const verificacion = [], tomar = crearTomador(verificacion), todos = numerosDe(original);
  const s = esObjeto(salida) ? salida : {};

  const notasHuecos = [];
  const partes = lista(s.partes).filter(p => TIPOS[p.tipo]).map(p => {
    const ctx = contexto(p.texto, original, todos);
    const campos = TIPOS[p.tipo].campos.map(([c]) => c), medidas = {}, estimadas = [];
    for (const c of ["largo", "ancho", "alto", "vanos", "meson"]) {
      const v = campos.includes(c) ? tomar(p[c], ctx, `el ${c}`) : undefined;
      if (v !== undefined) medidas[c] = v;
    }
    if (campos.includes("banos")) { const b = p.banos === 0 ? 0 : contar(p.banos, ctx, "el número de baños", tomar); if (b !== undefined) medidas.banos = b; }
    // Puertas y ventanas con forma: cada medida debe estar en el texto de ese hueco (o de la parte).
    const leidos = lista(p.huecos).filter(h => esObjeto(h) && TIPOS_HUECO.includes(h.tipo) && FORMAS_HUECO.includes(h.forma)).map(h => {
      const hc = contexto(h.texto || p.texto, original, todos), med = {};
      for (const [k, que] of [["ancho", "el ancho"], ["alto", "el alto"], ["diametro", "el diámetro"]]) {
        const v = tomar(h[k], hc, `${que} de la ${h.tipo}`);
        if (v !== undefined) med[k] = v;
      }
      return { tipo: h.tipo, forma: h.forma, ...med, cantidad: contar(h.cantidad, hc, `el número de ${h.tipo}s`, tomar) ?? 1 };
    });
    const { huecos, nota } = completarHuecos(p.tipo, limpiarHuecos(leidos));
    if (nota) notasHuecos.push({ texto: cadena(p.texto) || "puertas y ventanas", nota });
    // Habitaciones y cocinas de una casa: la nota la pone la herramienta, con lo que de verdad calcula.
    const distribucion = p.tipo === "casa" ? notaDistribucionCasa(ctx.texto) : null;
    if (distribucion) notasHuecos.push(distribucion);
    if (p.tipo === "muro" && medidas.vanos === undefined && !huecos.length) {
      const puertas = contar(p.puertas, ctx, "el número de puertas", tomar) || 0, ventanas = contar(p.ventanas, ctx, "el número de ventanas", tomar) || 0;
      if (puertas || ventanas) medidas.vanos = r2(puertas * S.puerta + ventanas * S.ventanaMuro);
    }
    // Solo el área ("70 m2"): se reparte en largo y ancho (proporción 1,25 : 1) y se marcan como estimadas.
    const area = p.tipo === "muro" ? undefined : tomar(p.area, ctx, "el área", exacto);
    if (area && !(medidas.largo && medidas.ancho)) {
      const ancho = Math.round(Math.sqrt(area / 1.25) * 10) / 10;
      medidas.ancho = ancho; medidas.largo = Math.round((area / ancho) * 10) / 10; estimadas.push("largo", "ancho");
    }
    return {
      tipo: p.tipo, cantidad: contar(p.cantidad, ctx, "la cantidad", tomar) ?? 1, medidas,
      sistema: p.sistema === "concreto" || p.sistema === "arcilla" ? p.sistema : null, estimadas,
      excluir: limpiarExcluidas(p.excluir), remodelacion: p.remodelacion === true, huecos, fuente: "la IA", texto: ctx.texto
    };
  });

  // "3 muros en bloque de concreto y 2 de 6 x 2,5": el segundo grupo son los mismos muros, con el mismo bloque.
  partes.forEach((p, i) => { const previa = partes[i - 1]; if (!p.sistema && previa?.tipo === p.tipo && previa.sistema) p.sistema = previa.sistema; });

  const codigos = new Set(TRABAJOS.map(t => t.codigo));
  const trabajos = lista(s.trabajos).filter(t => codigos.has(t.codigo)).map(t => {
    const ctx = contexto(t.texto, original, todos);
    const m = { area: tomar(t.area, ctx, "el área", exacto), largo: tomar(t.largo, ctx, "el largo"), ancho: tomar(t.ancho, ctx, "el ancho"),
      alto: tomar(t.alto, ctx, "el alto"), conteo: contar(t.conteo, ctx, "el conteo", tomar) };
    const { cantidad, detalle } = cantidadTrabajo(t.codigo, m, TIPOS[t.espacio] ? t.espacio : null);
    const revision = revisarTrabajo(t.codigo, limpiarTexto(ctx.texto));
    return { codigo: t.codigo, cantidad, texto: ctx.texto, detalle: detalle || revision.detalle, aviso: revision.aviso };
  });

  const materiales = lista(s.materiales).map(m => verificarMaterial(m, original, todos, req, tomar));
  // Si la herramienta ya explicó las habitaciones y cocinas de la casa, se descarta lo que la IA haya dicho de eso
  // (por ejemplo, que "se ajustarán", cuando el cálculo no cambia).
  const explicado = notasHuecos.some(n => hablaDeEspaciosCasa(n.texto));
  const observaciones = [...lista(s.observaciones).map(o => ({ texto: cadena(o.texto), nota: cadena(o.nota, 400) }))
    .filter(o => (o.texto || o.nota) && !(explicado && hablaDeEspaciosCasa(o.texto))), ...notasHuecos];
  const noSoportado = [...new Set(lista(s.noSoportado)
    .map(x => (CATEGORIAS_NO_SOPORTADO.includes(x.categoria) ? x.categoria : cadena(x.texto))).filter(Boolean))];
  const dudas = [];
  // Texto que ya quedó en una parte o un trabajo ("el lavaplatos y el mesón" → MES-01): no se vuelve a agregar.
  const n = t => normalizar(t).replace(/\s+/g, " ").trim();
  const cubiertos = [...partes, ...trabajos].map(x => n(x.texto)).filter(Boolean);
  const cubierto = t => cubiertos.some(c => c.includes(n(t)) || n(t).includes(c));
  for (const d of lista(s.dudas).filter(d => cadena(d.texto))) {
    const opciones = [...new Set((Array.isArray(d.opciones) ? d.opciones : []).filter(t => TIPOS[t]))];
    const ctx = contexto(d.texto, original, todos);
    // Una duda con una sola opción no es una duda ("una pared divisoria" → muro): la IA no puso la parte porque
    // faltan medidas. Se crea como cuando la persona elige esa opción; las medidas que no están escritas quedan de ejemplo.
    if (opciones.length === 1 && ctx.literal && !cubierto(ctx.texto)) { partes.push(parteDeDuda(ctx.texto, opciones[0])); continue; }
    dudas.push({ texto: cadena(d.texto), ranking: (opciones.length ? opciones : Object.keys(TIPOS)).map(tipo => ({ tipo, p: null })) });
  }

  return { partes, trabajos, materiales, observaciones, noSoportado, dudas, verificacion };
}

/** Revisa la respuesta de la IA sobre los materiales que la persona dice tener. */
export function verificarMateriales(salida, original, req = {}) {
  const verificacion = [], tomar = crearTomador(verificacion), todos = numerosDe(original);
  const materiales = lista(esObjeto(salida) ? salida.materiales : []).map(m => {
    const r = verificarMaterial(m, original, todos, req, tomar);
    return r.id ? r : { ...r, nota: cadena(m.nombre) ? `“${cadena(m.nombre)}” no está en la base de la herramienta: no se tiene en cuenta en el cálculo.` : r.nota };
  });
  return { materiales, verificacion };
}
