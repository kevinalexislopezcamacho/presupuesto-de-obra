/**
 * Estado de la aplicación: una sola fuente de verdad.
 * - Datos de la obra: lo que describe la persona (se envía al backend para calcular).
 * - Estado de pantalla: en qué paso va, qué pestaña ve, qué está escribiendo.
 * - calculo: la última respuesta del backend para estos datos.
 * El borrador se guarda en el navegador para no perderlo al recargar.
 */
import { CLAVE_BORRADOR } from "../config.js";
import { catalogo, medidasPorDefecto } from "./catalogo.js";
import { proximoLunes, esISO } from "../utilidades/fechas.js";

export const PANTALLA = Object.freeze({
  INICIO: "inicio", OBRA: "obra", MEDIDAS: "medidas", MATERIALES: "materiales",
  RESULTADO: "resultado", FUENTES: "fuentes", OFICIAL: "oficial"
});
/** Pasos numerados en la barra de progreso. */
export const PASOS = [PANTALLA.OBRA, PANTALLA.MEDIDAS, PANTALLA.MATERIALES];
const SUBPASOS_MATERIALES = ["tengo", "revision", "faltan"];

const nuevoId = prefijo => `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nuevaClave = () => nuevoId("m");

/**
 * Una parte de la obra (un muro, un baño…) con sus medidas y cuántas iguales.
 * `porDefecto`: medidas que la persona no dio (se muestran como "de ejemplo" hasta que las cambie).
 * `excluir`: actividades que pidió quitar ("sin enchape").
 */
export function nuevoElemento(tipo, medidas = {}, cantidad = 1, estimadas = [], excluir = [], remodelacion = false, huecos = []) {
  const base = medidasPorDefecto(tipo);
  const porDefecto = Object.keys(base).filter(k => k !== "sistema" && !(k in medidas));
  return { id: nuevoId("e"), tipo, cantidad, medidas: { ...base, ...medidas }, estimadas, porDefecto, excluir, remodelacion, huecos };
}

/** Formulario vacío para agregar un ítem cotizado. */
export const cotizadoVacio = () => ({ nombre: "", unidad: "und", cantidad: "", precio: "", fuente: "", error: "" });
/** Código de un ítem cotizado nuevo. */
export const nuevoIdCotizado = () => nuevoId("c");

/** Datos de una obra vacía. */
const obraVacia = () => ({
  texto: "",
  elementos: [],          // [{ id, tipo, cantidad, medidas, estimadas }]
  extras: [],             // trabajos sueltos: [{ codigo, cantidad, nota? }]
  cotizados: [],          // lo que no está en la base, con el precio de una cotización: [{ id, nombre, unidad, cantidad, precio, fuente }]
  disponibles: {},        // materiales que ya tiene: { idInsumo: cantidad }
  comprasAdicionales: {}, // materiales que se compran aparte (cuadro rápido del presupuesto): { idInsumo: cantidad }
  anotados: [],           // lo que escribió que tiene: [{ clave, id|null, texto, nota, decision }]
  comprados: [],          // materiales marcados como comprados
  hechas: [],             // actividades marcadas como hechas
  reemplazos: {},         // cambios de material: { original: nuevo }
  cambiosMat: [],         // cambios hechos, para recomendar y deshacer: [{ de, a, valido, texto, sistema }]
  ejecucion: "directo",   // "directo" (costo directo) o "contratista" (se suma el AIU, desde la pestaña Presupuesto)
  aiu: { ...(catalogo?.aiuPorDefecto || { a: 0, i: 0, u: 0, iva: 0 }) },
  inicioObra: proximoLunes(),
  precios: {},            // precios de las cotizaciones por insumo: { cem: 31000 }
  preciosActividad: {},   // precios cotizados por actividad: { "CON-05": 45000 }
  observaciones: [],      // pedidos que no se pudieron aplicar tal cual: [{ texto, nota }]
  tiempo: { inicio: new Date().toISOString(), fin: null, ms: 0 }   // cronómetro para la validación
});

// Estado de pantalla que se reinicia con cada obra nueva.
const pantallaVacia = () => ({
  interpretacion: null,   // { texto, res }: lo que se entendió de la descripción
  ocupado: "",            // mensaje mientras se espera una respuesta lenta (la IA)
  avisoMateriales: "",    // aviso de la última lectura de materiales (por ejemplo, si no se pudo usar la IA)
  textoMateriales: "",
  pasoMateriales: "tengo",
  modoFaltan: null,       // en "lo que falta": null · "tengo" · "comprar"
  faltanVista: null,      // materiales que faltaban al abrir "sí, tengo algunos"
  tab: "presupuesto",
  busqueda: "",
  abrirCatalogo: false,
  confirmarReinicio: false,
  obraId: null,
  nombreObra: "",
  calculo: null,
  lineaAbierta: null,     // ítem del presupuesto con su APU a la vista
  nuevoCotizado: cotizadoVacio(),   // lo que se va escribiendo en "Ítems cotizados"
  textoRapido: "",        // cuadro rápido del presupuesto: lo que se va escribiendo
  avisoRapido: "",        // y qué se agregó la última vez
  oficial: { q: "", capitulo: "", resultado: null, capitulos: null, buscando: false }
});

export const estado = {
  pantalla: PANTALLA.INICIO,
  volverA: PANTALLA.INICIO,   // a dónde regresar desde "fuentes"
  mensaje: "",                // aviso en el inicio ("quedó guardada…")
  error: "",                  // error de conexión o del servidor
  diagnostico: null,
  ejemploInicio: null,        // presupuesto de ejemplo de la pantalla de inicio (se calcula al abrir)
  ...obraVacia(),
  ...pantallaVacia()
};

const CAMPOS_OBRA = Object.keys(obraVacia());
const CAMPOS_BORRADOR = [...CAMPOS_OBRA, "pantalla", "pasoMateriales", "modoFaltan", "obraId", "nombreObra"];

/** Solo los datos de la obra, como los recibe el backend. */
export const datosDeObra = () => Object.fromEntries(CAMPOS_OBRA.map(k => [k, estado[k]]));

/** Deja todo listo para empezar una obra nueva. */
export function reiniciarObra() {
  Object.assign(estado, obraVacia(), pantallaVacia());
}

/** Carga los datos de una obra guardada (o de un borrador), ignorando lo que no corresponde. */
export function cargarDatosObra(datos = {}) {
  const base = obraVacia();
  for (const k of CAMPOS_OBRA) if (datos[k] !== undefined && datos[k] !== null) base[k] = datos[k];
  if (!esISO(base.inicioObra)) base.inicioObra = proximoLunes();
  // Obras guardadas con una versión anterior: completar los campos nuevos de cada parte.
  base.elementos = (base.elementos || []).map(e => ({ estimadas: [], porDefecto: [], excluir: [], remodelacion: false, huecos: [], ...e }));
  if (!base.tiempo) base.tiempo = { inicio: null, fin: null, ms: 0 };
  Object.assign(estado, base);
}

export function guardarBorrador() {
  try {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(Object.fromEntries(CAMPOS_BORRADOR.map(k => [k, estado[k]]))));
  } catch { /* sin almacenamiento: se trabaja en memoria */ }
}

export function cargarBorrador() {
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || "null"); } catch { guardado = null; }
  if (!guardado) return;
  cargarDatosObra(guardado);
  // Borradores de antes: la pantalla de modalidad ya no existe; se sigue en el presupuesto.
  if (guardado.pantalla === "ejecucion") guardado.pantalla = PANTALLA.RESULTADO;
  if (Object.values(PANTALLA).includes(guardado.pantalla) && ![PANTALLA.FUENTES, PANTALLA.OFICIAL].includes(guardado.pantalla)) estado.pantalla = guardado.pantalla;
  if (SUBPASOS_MATERIALES.includes(guardado.pasoMateriales)) estado.pasoMateriales = guardado.pasoMateriales;
  if (["tengo", "comprar"].includes(guardado.modoFaltan)) estado.modoFaltan = guardado.modoFaltan;
  estado.obraId = guardado.obraId || null;
  estado.nombreObra = guardado.nombreObra || "";
  // Sin nada que calcular no tiene sentido quedarse en pasos posteriores.
  const vacia = !estado.elementos.length && !estado.extras.length && !estado.cotizados.length;
  if (vacia && ![PANTALLA.INICIO, PANTALLA.OBRA].includes(estado.pantalla)) estado.pantalla = PANTALLA.OBRA;
}
