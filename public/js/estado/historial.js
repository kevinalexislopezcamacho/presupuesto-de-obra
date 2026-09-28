/**
 * "Mis obras": obras terminadas, guardadas en el navegador de cada dispositivo (almacenamiento local).
 * Así cada persona ve solo las suyas y siguen ahí al volver a entrar, sin inicio de sesión, aunque la
 * herramienta esté publicada en un servicio sin disco permanente. El resumen (total, días, avance) lo
 * calcula el servidor al guardar, con los mismos cálculos del presupuesto.
 */
import * as api from "../api/cliente.js";
import { estado, datosDeObra, cargarDatosObra, reiniciarObra, PANTALLA } from "./estado.js";
import { detenerCronometro } from "../utilidades/cronometro.js";

const CLAVE = "presupuesto-obra-cali:mis-obras";

export const historial = {
  lista: [],          // resúmenes: [{ id, nombre, creada, actualizada, resumen, ejecucion, tiempo }]
  cargado: false,
  borrar: null        // id de la obra que espera confirmación para borrarse
};

/** Todas las obras guardadas en este navegador, con sus datos. */
function leer() {
  try {
    const obras = JSON.parse(localStorage.getItem(CLAVE) || "[]");
    return Array.isArray(obras) ? obras : [];
  } catch {
    return [];
  }
}

function escribir(obras) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(obras));
  } catch {
    throw new Error("No se pudo guardar la obra en este navegador (puede estar en modo incógnito o sin espacio).");
  }
}

/** Resumen para la lista, con los mismos datos que usa la pantalla de resultado. */
async function resumenDe(datos) {
  const c = await api.calcular(datos);
  return {
    total: Math.round(c.presupuesto.total), porInvertir: Math.round(c.presupuesto.porInvertir),
    dias: c.cronograma.avance.falta, avance: Math.round(c.cronograma.avance.pct * 100)
  };
}

const aLista = ({ datos, ...resto }) => ({ ...resto, ejecucion: datos.ejecucion, tiempo: datos.tiempo || null });
const nuevoId = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function cargarHistorial() {
  // Se pide que el navegador no borre estos datos cuando necesite espacio (no todos lo permiten).
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
  historial.lista = leer().sort((a, b) => String(b.actualizada).localeCompare(String(a.actualizada))).map(aLista);
  historial.cargado = true;
}

/** Guarda la obra actual (nueva o ya existente) y vuelve al inicio. */
export async function guardarObraActual(nombre) {
  detenerCronometro();
  const datos = datosDeObra(), obras = leer(), ahora = new Date().toISOString();
  const resumen = await resumenDe(datos);
  const anterior = estado.obraId && obras.find(o => o.id === estado.obraId);
  if (anterior) Object.assign(anterior, { nombre, actualizada: ahora, datos, resumen });
  else obras.push({ id: nuevoId(), nombre, creada: ahora, actualizada: ahora, datos, resumen });
  escribir(obras);
  reiniciarObra();
  estado.pantalla = PANTALLA.INICIO;
  estado.mensaje = `“${nombre}” quedó guardada en Mis obras.`;
  await cargarHistorial();
}

/** Abre una obra guardada en la pantalla de resultado. */
export async function abrirObra(id) {
  const obra = leer().find(o => o.id === id);
  if (!obra) throw new Error("Esa obra ya no está guardada en este navegador.");
  reiniciarObra();
  cargarDatosObra(obra.datos);
  Object.assign(estado, {
    obraId: obra.id, nombreObra: obra.nombre, pantalla: PANTALLA.RESULTADO, pasoMateriales: "faltan", mensaje: "",
    ejecucion: estado.ejecucion || "directo"
  });
}

export async function borrarObra(id) {
  escribir(leer().filter(o => o.id !== id));
  historial.borrar = null;
  await cargarHistorial();
}
