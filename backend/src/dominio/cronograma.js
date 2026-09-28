/**
 * Cronograma: actividades una tras otra, en el orden en que se construye.
 */

// Cada actividad pertenece a una fase de construcción.
export const FASES = [
  { nombre: "Preliminares y demoliciones", codigos: ["PRE-01", "DEM-01", "DEM-02"] },
  { nombre: "Cimentación", codigos: ["EXC-01", "CON-06", "CON-04", "CON-05", "EXC-02", "EXC-03"] },
  { nombre: "Estructura y muros", codigos: ["ACE-01", "MAM-01", "MAM-02", "CON-01", "CON-02"] },
  { nombre: "Placa de piso", codigos: ["ACE-02", "CON-03"] },
  { nombre: "Instalaciones", codigos: ["HID-01"] },
  { nombre: "Acabados", codigos: ["PAN-01", "IMP-01", "ACB-01", "ACB-02", "MES-01"] }
];
/** Índice de la fase de una actividad (las desconocidas van al final). */
export const faseDe = codigo => { const i = FASES.findIndex(f => f.codigos.includes(codigo)); return i < 0 ? FASES.length : i; };
const posicion = codigo => { const f = FASES[faseDe(codigo)]; return f ? f.codigos.indexOf(codigo) : 0; };
/** Comparador para ordenar actividades por fase y, dentro de la fase, por orden de ejecución. */
export const ordenFase = (a, b) => faseDe(a.codigo) - faseDe(b.codigo) || posicion(a.codigo) - posicion(b.codigo);

/** Días de una actividad, redondeados a medios días (mínimo medio día). */
const diasActividad = l => Math.max(0.5, Math.ceil((l.cantidad / l.rendimiento) * 2) / 2);

// Actividades en secuencia.
export function calcularCronograma(lineas) {
  let inicio = 0;
  return lineas.map(l => {
    const dias = diasActividad(l);
    const tramo = { ...l, inicio, dias };
    inicio += dias;
    return tramo;
  });
}

// Avance según lo que ya está hecho.
export function avanceObra(lineas, hechas) {
  const total = lineas.reduce((s, l) => s + diasActividad(l), 0);
  const hecho = lineas.filter(l => hechas.includes(l.codigo)).reduce((s, l) => s + diasActividad(l), 0);
  return { total, hecho, falta: total - hecho, pct: total ? hecho / total : 0 };
}
