/**
 * Formato de números, dinero y texto para mostrar en pantalla.
 */
export const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
/** Coeficientes del APU (0,022 m³ de arena por m²): con dos decimales el parcial no cuadraría. */
export const coef = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 });
export const r2 = x => Math.round(x * 100) / 100;

/** Escapa texto para insertarlo en HTML sin riesgo. */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);

/** "14 bultos", "1 bulto", "3 m³" */
export const cantU = (n, u) => `${num.format(n)} ${u === "bulto" && n !== 1 ? "bultos" : u}`;

/** ["techos", "escaleras", "pintura"] → "techos, escaleras y pintura" */
export const listaY = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** Minúsculas y sin tildes, para buscar. */
export const normalizar = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// El intérprete trabaja sin tildes; al mostrar las palabras se les devuelven.
const TILDES = { bano: "baño", banos: "baños", banito: "bañito", habitacion: "habitación", salon: "salón", deposito: "depósito", banarme: "bañarme", banarse: "bañarse" };
export const conTildes = p => TILDES[p] || p;
