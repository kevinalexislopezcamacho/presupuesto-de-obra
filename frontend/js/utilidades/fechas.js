/**
 * Calendario de obra: días hábiles de lunes a viernes (no descuenta festivos).
 */
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const aFecha = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const aISO = f => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
export const esISO = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
export const fechaCorta = f => `${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]}`;

export function proximoLunes() {
  const f = new Date();
  f.setHours(0, 0, 0, 0);
  while (f.getDay() !== 1) f.setDate(f.getDate() + 1);
  return aISO(f);
}

/** Fecha del día hábil número n (0 = primer día hábil desde el inicio). */
export function diaHabil(inicioISO, n) {
  const f = aFecha(inicioISO);
  const finDeSemana = () => f.getDay() === 0 || f.getDay() === 6;
  while (finDeSemana()) f.setDate(f.getDate() + 1);
  for (let k = 0; k < n; k++) do f.setDate(f.getDate() + 1); while (finDeSemana());
  return f;
}
