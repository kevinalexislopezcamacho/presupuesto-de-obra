/**
 * Cuadro rápido del presupuesto: qué hacer con cada material escrito. Si está claro, se agrega; si no, se arman
 * opciones para que la persona elija, sin decidir por ella: "10 alambres" (¿kilos, rollos o libras?), "5 varillas"
 * (¿de qué calibre?), "10 bloques" (¿de arcilla o de concreto?) o "10 semento" (¿cemento?).
 */
import { INSUMOS } from "../datos/precios.js";
import { AMBIGUOS, CONVERSION_TEXTO, SINONIMOS_INSUMO, UNIDADES_TEXTO } from "../datos/materiales.js";
import { NO_SOPORTADO, PALABRAS_VACIAS } from "../datos/lenguaje.js";
import { interpretarMateriales, convertirUnidad, unidadEscrita, numeroEscrito, diceUnidad } from "./materiales-texto.js";
import { decimal } from "./numeros.js";
import { normalizar, limpiarTexto, distancia } from "./texto/normalizar.js";

// Unidades de medida: "10 alambres" no dice si son kilos, rollos o libras.
const MEDIDAS = new Set(["kg", "lb", "m", "m²", "m³"]);
const CALIBRES = ["3/8", "1/2", "5/8"];
const PLURAL = { bulto: "bultos", rollo: "rollos", caja: "cajas", tubo: "tubos", varilla: "varillas", viaje: "viajes" };
// Palabras que dicen cómo se vende algo, no qué es: no sirven para buscarlo en la lista oficial.
const NO_BUSCAR = new Set(["galon", "galones", "caneca", "canecas", "cunete", "cunetes", "paquete", "paquetes"]);
const MAX_OPCIONES = 6;

const conUnidad = (n, u) => `${decimal(n)} ${n === 1 || !PLURAL[u] ? u : PLURAL[u]}`;
const quitarUnidades = t => UNIDADES_TEXTO.reduce((s, x) => s.replace(new RegExp(x.dentro.source, "g"), " "), t);
/** Palabras con significado de un texto ya limpio: sin números, unidades ni palabras vacías. */
const palabrasDe = t => quitarUnidades(t).split(/[^a-z]+/).filter(w => w.length >= 4 && !PALABRAS_VACIAS.has(w));
// Palabras con que se nombran los materiales de la base, para reconocer las mal escritas.
const VOCABULARIO = [...new Set(Object.entries(INSUMOS).filter(([, i]) => i.tipo === "material")
  .flatMap(([id, i]) => palabrasDe(normalizar(`${i.nombre} ${SINONIMOS_INSUMO[id] || ""}`))))];

/** Una opción para elegir: `medida` es cómo se contó ("10 rollos (100 kg)") y `nombre`, el material de la base. */
const enSuUnidad = (id, cantidad) => ({ id, cantidad, nombre: INSUMOS[id].nombre, medida: conUnidad(cantidad, INSUMOS[id].unidad) });

/** n contado en la unidad u (varillas: de un calibre), pasado a la unidad del insumo; null si no hay conversión segura. */
function opcion(id, n, u, calibre = null) {
  const destino = INSUMOS[id].unidad;
  if (u === destino) return enSuUnidad(id, n);
  const { cantidad } = convertirUnidad(id, n, u, u, "", calibre);
  if (!(cantidad > 0)) return null;
  const escrito = calibre ? `${conUnidad(n, "varilla")} de ${calibre}"` : conUnidad(n, u);
  return { id, cantidad, nombre: INSUMOS[id].nombre, medida: `${escrito} (${decimal(cantidad)} ${destino})` };
}

/** Sin repetidas y con un máximo, para que se pueda elegir de un vistazo. */
const unicas = opciones => [...new Map(opciones.filter(Boolean).map(o => [`${o.id}:${o.cantidad}`, o])).values()].slice(0, MAX_OPCIONES);

/** Las unidades en que se puede haber contado un material: la suya y las que tienen conversión (rollos de alambre). */
const unidadesDe = id => [INSUMOS[id].unidad, ...Object.entries(CONVERSION_TEXTO)
  .filter(([clave, [factor]]) => clave.startsWith(`${id}:`) && factor !== 1).map(([clave]) => clave.split(":")[1])];

/** Un material contado sin unidad, en cada unidad posible y, si es acero, en varillas de cada calibre. */
const opcionesSinUnidad = (id, n) => [...unidadesDe(id).map(u => opcion(id, n, u)),
  ...(id === "acr" ? CALIBRES.map(c => opcion(id, n, "varilla", c)) : [])];

/** Entre qué materiales hay que elegir si no se dijo el tipo ("10 bloques"): primero el que usa la obra. */
function tiposPosibles(id, texto, req) {
  const grupo = AMBIGUOS.find(g => g.ids.includes(id));
  if (!grupo || grupo.tipo.test(limpiarTexto(texto))) return [id];
  return [...grupo.ids].sort((a, b) => Boolean(req[b]) - Boolean(req[a]));
}

/** Palabras que parecen un material mal escrito ("semento" → "cemento"), de la más parecida a la menos. */
const parecidas = t => palabrasDe(t).filter(w => !VOCABULARIO.includes(w))
  .flatMap(w => VOCABULARIO.map(v => [w, v, distancia(w, v)]).filter(([, , d]) => d <= (w.length <= 5 ? 1 : 2)))
  .sort((a, b) => a[2] - b[2]).slice(0, 3);

/** Un material que no está en la base: si parece mal escrito, las opciones del que se parece; si no, qué buscar en la lista oficial. */
function sinReconocer(texto, req) {
  const t = limpiarTexto(texto);
  if (!NO_SOPORTADO.some(([re]) => re.test(t))) {
    const opciones = parecidas(t).flatMap(([mal, bien]) => {
      const [leido] = interpretarMateriales(t.replace(new RegExp(`\\b${mal}\\b`), bien), req);
      const r = leido?.id ? revisarMaterial(leido, req) : null;
      return r?.claro ? [enSuUnidad(r.claro.id, r.claro.cantidad)] : r?.opciones || [];
    });
    if (opciones.length) return { opciones: unicas(opciones) };
  }
  const palabras = palabrasDe(t).filter(w => !NO_BUSCAR.has(w));
  return palabras.length ? { buscar: [...new Set([palabras.join(" "), ...[...palabras].sort((a, b) => b.length - a.length)])] } : null;
}

/**
 * Qué hacer con un material escrito en el cuadro rápido.
 * @param {{ texto: string, id: string|null, cantidad: number|null, nota: string }} m como lo leen las reglas o la IA
 * @param {object} req materiales que usa la obra (el que usa va primero entre las opciones)
 * @returns {{ claro: object } | { opciones: { id, cantidad, nombre, medida }[] } | { buscar: string[] } | { nota: string } | null}
 *   `buscar`: consultas para la lista oficial, de la más completa a la más corta.
 */
export function revisarMaterial(m, req = {}) {
  if (!m.id) return sinReconocer(m.texto || "", req);
  const n = numeroEscrito(m.texto);
  if (!(n > 0)) return { nota: `${m.texto}: falta la cantidad` };
  const tipos = tiposPosibles(m.id, m.texto, req), escrita = unidadEscrita(m.texto);
  if (m.id === "acr" && escrita?.unidad === "varilla" && m.cantidad === null)    // "5 varillas": falta el calibre
    return { opciones: CALIBRES.map(c => opcion("acr", n, "varilla", c)) };
  if (!diceUnidad(m.texto) && MEDIDAS.has(INSUMOS[m.id].unidad))               // "10 alambres": ¿kilos, rollos o libras?
    return { opciones: unicas(tipos.flatMap(t => opcionesSinUnidad(t, n))) };
  if (!(m.cantidad > 0)) return { nota: m.nota };                                // "3 volquetas de arena": se pide el dato
  if (tipos.length > 1)                                                          // "10 bloques": ¿de arcilla o de concreto?
    return { opciones: unicas(tipos.map(t => escrita ? opcion(t, n, escrita.unidad) : enSuUnidad(t, m.cantidad))) };
  return { claro: m };
}
