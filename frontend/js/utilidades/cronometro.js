/**
 * Cronómetro de la obra para la validación (objetivo 5): cuenta el tiempo activo armando el presupuesto,
 * desde "Nueva obra" hasta "Terminado". Solo suma cuando la pestaña está a la vista y hubo actividad
 * en los últimos 2 minutos, para no contar pausas largas.
 */
import { estado, PANTALLA } from "../estado/estado.js";

const PASO_MS = 5000, INACTIVO_MS = 2 * 60 * 1000;
let ultimaActividad = Date.now();

export function iniciarCronometro() {
  for (const evento of ["click", "keydown", "input", "scroll", "touchstart"]) addEventListener(evento, () => { ultimaActividad = Date.now(); }, { passive: true });
  setInterval(() => {
    const armando = ![PANTALLA.INICIO, PANTALLA.FUENTES].includes(estado.pantalla);   // en el inicio no se está armando la obra
    const t = estado.tiempo;
    if (!t || t.fin || !armando || document.visibilityState !== "visible" || Date.now() - ultimaActividad > INACTIVO_MS) return;
    t.ms += PASO_MS;
  }, PASO_MS);
}

/** Marca el final (al guardar la obra por primera vez). */
export function detenerCronometro() {
  if (estado.tiempo && !estado.tiempo.fin) estado.tiempo.fin = new Date().toISOString();
}

/** "12 min", "1 h 5 min" */
export function duracion(ms) {
  const min = Math.round((ms || 0) / 60000);
  if (min < 1) return "menos de 1 min";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
