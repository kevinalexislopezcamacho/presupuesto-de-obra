/**
 * Cambios sobre los datos de la obra que hace la persona desde las pantallas.
 * No calculan nada: después de cada cambio se le pide el cálculo al backend.
 */
import * as api from "../api/cliente.js";
import { catalogo, insumo, nombreCantidad, nombreCortoApu, unidadApu } from "../estado/catalogo.js";
import { estado, nuevoElemento, nuevaClave, datosDeObra, cotizadoVacio, nuevoIdCotizado } from "../estado/estado.js";
import { r2 } from "../utilidades/formato.js";

const MUROS = ["MAM-01", "MAM-02"];

/** Suma a lo que tiene los materiales leídos, recordando cuánto aportó cada texto. */
function anotarMateriales(materiales, origen) {
  for (const m of materiales) {
    const aporte = m.id && m.cantidad > 0 ? m.cantidad : 0;
    if (aporte) estado.disponibles[m.id] = r2((estado.disponibles[m.id] || 0) + aporte);
    const previo = m.id && estado.anotados.find(a => a.id === m.id);
    if (previo) {
      if (m.nota) previo.nota = m.nota;
      previo.texto = [previo.texto, m.texto].filter(Boolean).join(" · ");
      previo.decision = null;
      if (origen === "descripcion") previo.aporte = r2((previo.aporte || 0) + aporte);
    } else {
      estado.anotados.push({ clave: nuevaClave(), id: m.id, texto: m.texto, nota: m.nota || "", decision: null, origen,
        ...(origen === "descripcion" ? { aporte } : {}) });
    }
  }
}

/** Quita lo que había aportado una descripción anterior (para no sumarlo dos veces al volver a interpretar). */
function olvidarMaterialesDeDescripcion() {
  for (const a of estado.anotados.filter(x => x.origen === "descripcion")) {
    if (a.id && a.aporte) {
      const queda = r2((estado.disponibles[a.id] || 0) - a.aporte);
      if (queda > 0) estado.disponibles[a.id] = queda; else delete estado.disponibles[a.id];
    }
  }
  estado.anotados = estado.anotados.filter(x => x.origen !== "descripcion");
}

/** Convierte lo entendido de la descripción en partes de la obra, trabajos sueltos, materiales y observaciones. */
export function aplicarInterpretacion(res) {
  estado.elementos = res.partes.map(p =>
    nuevoElemento(p.tipo, { ...p.medidas, ...(p.sistema ? { sistema: p.sistema } : {}) }, p.cantidad, p.estimadas, p.excluir || [], p.remodelacion === true, p.huecos || []));
  const extras = new Map();
  for (const t of res.trabajos) {
    const x = extras.get(t.codigo) || { codigo: t.codigo, cantidad: 0, nota: "" };
    x.cantidad = r2(x.cantidad + t.cantidad);
    if (t.aviso && !x.nota.includes(t.aviso)) x.nota = `${x.nota} ${t.aviso}`.trim();
    extras.set(t.codigo, x);
  }
  estado.extras = [...extras.values()].map(x => (x.nota ? x : { codigo: x.codigo, cantidad: x.cantidad }));
  olvidarMaterialesDeDescripcion();
  anotarMateriales(res.materiales || [], "descripcion");
  estado.observaciones = (res.observaciones || []).map(o => ({ texto: o.texto, nota: o.nota }));
  estado.hechas = [];
  estado.comprados = [];
}

/** La persona eligió qué es algo que el intérprete no entendió. */
export async function resolverDuda(indice, tipo) {
  const res = estado.interpretacion.res, duda = res.dudas[indice];
  if (tipo !== "ignorar") {
    const { medidas, sistema, estimadas, huecos } = await api.leerMedidas(duda.texto, tipo);
    res.partes.push({ tipo, cantidad: 1, medidas, sistema, estimadas, excluir: [], huecos: huecos || [], fuente: "su elección", texto: duda.texto });
  }
  res.dudas.splice(indice, 1);
}

/** Cambia un material por otro (o el tipo de bloque) y guarda la opinión del sistema. */
export function cambiarMaterial(de, a) {
  const alt = (catalogo.alternativas[de] || []).find(x => x.por === a);
  if (!alt) return;
  if (alt.sistema) estado.elementos.forEach(e => { e.medidas.sistema = alt.sistema; });
  else estado.reemplazos[de] = a;
  estado.cambiosMat = estado.cambiosMat.filter(c => c.de !== de && c.a !== de)
    .concat({ de, a, valido: alt.valido, texto: alt.texto, sistema: alt.sistema || null });
  if (!estado.anotados.some(x => x.id === a)) estado.anotados.push({ clave: nuevaClave(), id: a, texto: "", nota: "", decision: null });
}

export function deshacerCambio(de) {
  const cambio = estado.cambiosMat.find(x => x.de === de);
  if (!cambio) return;
  if (cambio.sistema) estado.elementos.forEach(e => { e.medidas.sistema = de === "blc" ? "concreto" : "arcilla"; });
  else delete estado.reemplazos[de];
  estado.cambiosMat = estado.cambiosMat.filter(x => x.de !== de);
}

/** Lee lo escrito ("20 bultos de cemento y 300 ladrillos") y lo suma a lo que tiene. */
export async function agregarMateriales() {
  const texto = estado.textoMateriales.trim();
  if (!texto) return;
  estado.ocupado = "Leyendo los materiales…";
  try {
    const { materiales, avisoIA } = await api.leerMateriales(texto, datosDeObra());
    anotarMateriales(materiales, "escrito");
    estado.avisoMateriales = avisoIA || "";
    estado.textoMateriales = "";
  } finally {
    estado.ocupado = "";
  }
}

/** Quita un material de la lista (por id del insumo o por clave si no se reconoció). */
export function quitarMaterial(clave) {
  const id = catalogo.insumos[clave] ? clave : estado.anotados.find(a => a.clave === clave)?.id;
  estado.anotados = estado.anotados.filter(a => a.clave !== clave && !(id && a.id === id));
  if (!id) return;
  delete estado.disponibles[id];
  const usado = estado.cambiosMat.find(c => c.a === id);
  if (usado) deshacerCambio(usado.de);
}

/** "Lo dejo aparte": no se usa en lugar de otro material. */
export function dejarAparte(id) {
  estado.anotados.filter(a => a.id === id).forEach(a => { a.decision = "aparte"; });
}

/** Pasa una cantidad mal escrita a la unidad correcta (500 kg de cemento → 10 bultos). */
export function convertirCantidad(id) {
  const conversion = catalogo.conversiones[id];
  if (conversion) estado.disponibles[id] = Math.round(estado.disponibles[id] * conversion.factor * 10) / 10;
}

export function agregarElemento(tipo) {
  estado.elementos.push(nuevoElemento(tipo));
}

/** Incluye o quita una actividad de una parte ("este baño no lleva enchape"). El muro cuenta igual en arcilla o concreto. */
export function alternarActividad(idElemento, codigo) {
  const el = estado.elementos.find(e => e.id === idElemento);
  if (!el) return;
  const codigos = MUROS.includes(codigo) ? MUROS : [codigo];
  el.excluir = el.excluir.some(c => codigos.includes(c))
    ? el.excluir.filter(c => !codigos.includes(c))
    : [...el.excluir, ...codigos];
}

/** Marca una parte como remodelación (el espacio ya existe): se agregan las demoliciones del enchape y el piso que se cambian. */
// En una remodelación ya existen los muros, su estructura y la placa de piso.
const EXISTENTE = ["MAM-01", "MAM-02", "CON-01", "CON-02", "CON-05", "ACE-01", "CON-04", "CON-03"];
export function alternarRemodelacion(idElemento) {
  const el = estado.elementos.find(e => e.id === idElemento);
  if (!el) return;
  el.remodelacion = !el.remodelacion;
  el.excluir = el.remodelacion ? [...new Set([...el.excluir, ...EXISTENTE])] : el.excluir.filter(c => !EXISTENTE.includes(c));
}

export function agregarTrabajo(codigo, cantidad) {
  const existente = estado.extras.find(x => x.codigo === codigo);
  if (existente) existente.cantidad = r2((existente.cantidad || 0) + cantidad);
  else estado.extras.push({ codigo, cantidad });
}

/** Precio de una cotización: por insumo (lista = "precios") o por actividad (lista = "preciosActividad"). Vacío = volver a la referencia. */
export function ponerPrecio(lista, clave, valor) {
  if (valor > 0) estado[lista][clave] = valor;
  else delete estado[lista][clave];
}

export function marcar(lista, valor, marcado) {
  estado[lista] = marcado ? [...new Set([...estado[lista], valor])] : estado[lista].filter(v => v !== valor);
}

/* ---------- Puertas y ventanas con su forma ---------- */
const medidasUsadas = forma => (forma === "circular" ? ["diametro"] : ["ancho", "alto"]);

/** Detalla las puertas y ventanas de una parte: la primera vez parte de las típicas de ese tipo de obra. */
export function agregarHueco(idElemento) {
  const el = estado.elementos.find(e => e.id === idElemento);
  if (!el) return;
  const { tipicos, medidas } = catalogo.huecos;
  const nuevos = !el.huecos.length && tipicos[el.tipo]?.length ? tipicos[el.tipo]
    : [{ tipo: "puerta", forma: "rectangular", ...medidas.puerta, cantidad: 1 }];
  el.huecos.push(...nuevos.map(h => ({ ...h, porDefecto: medidasUsadas(h.forma) })));
}

export function quitarHueco(idElemento, indice) {
  const el = estado.elementos.find(e => e.id === idElemento);
  if (el) el.huecos.splice(indice, 1);
}

/** Cambia qué es, la forma, una medida o cuántas iguales hay de una puerta o ventana. */
export function cambiarHueco(idElemento, indice, campo, valor) {
  const h = estado.elementos.find(e => e.id === idElemento)?.huecos[indice];
  if (!h) return;
  if (campo === "tipo" || campo === "forma") {
    h[campo] = valor;
    if (campo === "forma") h.porDefecto = (h.porDefecto || []).filter(k => medidasUsadas(valor).includes(k));
  } else if (campo === "cantidad") {
    h.cantidad = Math.max(1, Math.round(parseFloat(valor) || 1));
  } else if (parseFloat(valor) > 0) {
    h[campo] = parseFloat(valor);
    h.porDefecto = (h.porDefecto || []).filter(k => k !== campo);
  }
}

/* ---------- Ítems cotizados ---------- */
/** Qué falta para poder agregar el ítem cotizado que se está escribiendo ("" si está completo). */
export function faltaEnCotizado() {
  const n = estado.nuevoCotizado;
  if (!n.nombre.trim()) return "Escriba qué es: la descripción del ítem.";
  if (!(parseFloat(n.cantidad) > 0)) return "Escriba una cantidad mayor que cero.";
  if (!(parseFloat(n.precio) > 0)) return "Escriba el valor unitario de la cotización.";
  return "";
}

export function agregarCotizado() {
  const n = estado.nuevoCotizado;
  estado.cotizados.push({ id: nuevoIdCotizado(), nombre: n.nombre.trim(), unidad: n.unidad, cantidad: r2(parseFloat(n.cantidad)),
    precio: Math.round(parseFloat(n.precio)), fuente: n.fuente.trim() });
  estado.nuevoCotizado = cotizadoVacio();
}

/** Cambia la cantidad o el valor unitario de un ítem cotizado (un valor vacío o en cero no se acepta). */
export function cambiarCotizado(id, campo, valor) {
  const x = estado.cotizados.find(c => c.id === id), v = parseFloat(valor);
  if (x && v > 0) x[campo] = campo === "precio" ? Math.round(v) : r2(v);
}

/* ---------- Cuadro rápido del presupuesto ---------- */
/**
 * Lo que se escribe en el presupuesto ya armado: obras y trabajos se suman al presupuesto (sus materiales salen en
 * Compras) y los materiales sueltos ("10 bultos de cemento") van a Compras como compra adicional, con su costo.
 */
export async function agregarRapido() {
  const texto = estado.textoRapido.trim();
  if (!texto) { estado.avisoRapido = "Escriba qué quiere agregar."; return; }
  const r = await api.interpretarAgregado(texto, datosDeObra());
  const hecho = [], pendiente = [];
  for (const p of r.partes) {
    estado.elementos.push(nuevoElemento(p.tipo, { ...p.medidas, ...(p.sistema ? { sistema: p.sistema } : {}) }, p.cantidad,
      p.estimadas, p.excluir || [], p.remodelacion === true, p.huecos || []));
    hecho.push(nombreCantidad(p.tipo, p.cantidad));
  }
  for (const t of r.trabajos) {
    if (t.cantidad > 0) { agregarTrabajo(t.codigo, t.cantidad); hecho.push(`${nombreCortoApu(t.codigo)} (${r2(t.cantidad)} ${unidadApu(t.codigo)})`); }
    else pendiente.push(`${nombreCortoApu(t.codigo)}: falta la cantidad`);
  }
  // "10 bultos", pero "2 kg" o "3 m³": solo las unidades que son palabras llevan plural.
  const unidad = (u, n) => n !== 1 && /^[a-záéíóúñ]{4,}$/.test(u) ? `${u}s` : u;
  for (const m of r.materiales) {
    estado.comprasAdicionales[m.id] = r2((estado.comprasAdicionales[m.id] || 0) + m.cantidad);
    hecho.push(`${r2(m.cantidad)} ${unidad(insumo(m.id).unidad, m.cantidad)} de ${insumo(m.id).nombre.toLowerCase()} (a Compras)`);
  }
  if (r.noSoportado.length) pendiente.push(`no se calcula: ${r.noSoportado.map(x => x.replace(/ \(.*\)/, "")).join(", ")}`);
  estado.avisoRapido = hecho.length
    ? `Se agregó: ${hecho.join(" · ")}.${pendiente.length ? ` (${pendiente.join("; ")})` : ""}`
    : pendiente.length ? `No se agregó nada: ${pendiente.join("; ")}.`
      : "No se entendió qué agregar. Escríbalo de otra forma, por ejemplo «pañetar 20 m²» o «10 bultos de cemento».";
  if (hecho.length) estado.textoRapido = "";
}
