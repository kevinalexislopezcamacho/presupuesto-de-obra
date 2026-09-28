/**
 * Conocimiento sobre materiales: reemplazos válidos, sinónimos, unidades y conversiones.
 */

// Reemplazos entre materiales que el sistema sabe sugerir.
export const SUSTITUTOS = [
  { falta: "blq", tiene: "blc", valido: true, sistema: "concreto",
    texto: "Hay bloque de concreto disponible: los muros se pueden hacer en bloque de concreto en lugar de arcilla." },
  { falta: "blc", tiene: "blq", valido: true, sistema: "arcilla",
    texto: "Hay bloque de arcilla disponible: los muros se pueden hacer en bloque de arcilla en lugar de concreto." },
  { falta: "cpa", tiene: "cpi", valido: true,
    texto: "La cerámica de piso también sirve en pared: la que sobre se puede usar para el enchape." },
  { falta: "cpi", tiene: "cpa", valido: false,
    texto: "La cerámica de pared no sirve para piso: es menos resistente al tráfico y se raya. Hay que comprar cerámica de piso." },
  { falta: "acr", tiene: "mal", valido: false,
    texto: "La malla electrosoldada no reemplaza el acero de columnas y vigas de confinamiento." }
];

// Cambios de material que la herramienta sabe evaluar (misma unidad de medida).
export const ALTERNATIVAS = {
  blq: [{ por: "blc", valido: true, sistema: "concreto",
          texto: "Sirve. El muro se hace en bloque de concreto: van 12,5 bloques por m² en lugar de 13,5." }],
  blc: [{ por: "blq", valido: true, sistema: "arcilla",
          texto: "Sirve. El muro se hace en bloque de arcilla N.º 5: van 13,5 bloques por m²." }],
  cpa: [{ por: "cpi", valido: true,
          texto: "Sirve. La cerámica de piso también se puede pegar en paredes: es más resistente, aunque más cara." }],
  cpi: [{ por: "cpa", valido: false,
          texto: "No es lo correcto. La cerámica de pared es más delgada: en el piso se raya y se quiebra con el tráfico. Se debe usar cerámica de piso." }],
  tps: [{ por: "tpp", valido: false,
          texto: "No es lo correcto. La tubería de presión de 1/2\" es para el agua limpia; el desagüe necesita tubería sanitaria de 2\" o más, si no se tapa." }],
  tpp: [{ por: "tps", valido: false,
          texto: "No es lo correcto. La tubería sanitaria no aguanta presión: para el agua que llega a las llaves se usa tubería de presión." }]
};

// Pistas de unidades: cuando alguien escribe una cantidad en otra unidad.
export const CONVERSIONES = {
  cem: { factor: 1 / 50, pregunta: "¿La cantidad está en kilos? El cemento se cuenta en bultos de 50 kg." },
  peg: { factor: 1 / 25, pregunta: "¿La cantidad está en kilos? El pegante viene en bultos de 25 kg." },
  are: { factor: 1 / 36, pregunta: "¿La cantidad está en bultos? Un m³ de arena son unos 36 bultos de 40 kg." },
  gra: { factor: 1 / 30, pregunta: "¿La cantidad está en bultos? Un m³ de triturado son unos 30 bultos de 50 kg." }
};

// Otros nombres con que la gente busca cada material.
export const SINONIMOS_INSUMO = {
  acr: "varilla varillas hierro fierro acero", blq: "ladrillo bloque arcilla numero 5", blc: "bloque cemento concreto",
  cpi: "baldosa ceramica piso tableta", cpa: "azulejo ceramica pared enchape", tps: "tubo tubos tuberia desague sanitario sanitaria",
  tpp: "tubo tubos tuberia agua presion", peg: "pegacor pegante", boq: "boquilla fragua", imp: "sika impermeabilizante",
  gra: "grava triturado piedra gravilla", pun: "clavo clavos puntilla", mal: "malla", alb: "alambre",
  cem: "cemento bulto", are: "arena", for: "formaleta tabla tablas madera", acc: "codo codos tee accesorios"
};

// Unidades que se reconocen al escribir; el orden importa (m³ antes que m).
export const UNIDADES_TEXTO = [
  ["m³", "m3|mt3|mts3|metros? cubicos?"], ["m²", "m2|mt2|mts2|metros? cuadrados?"], ["bulto", "bultos?|sacos?|bolsas?"],
  ["kg", "kg|kgs|kilos?|kilogramos?"], ["lb", "lb|lbs|libras?"], ["und", "und|unds|unidades?|piezas?"],
  ["varilla", "varillas?"], ["tubo", "tubos?"], ["caja", "cajas?"], ["rollo", "rollos?"], ["viaje", "viajes?|volquetas?"],
  ["m", "m|mt|mts|metros?|ml"]
].map(([u, s]) => ({ u, inicio: new RegExp(`^(?:${s})\\b`), dentro: new RegExp(`\\b(?:${s})\\b`, "g") }));
export const PESO_VARILLA = { "1/4": 1.5, "3/8": 3.36, "1/2": 5.96, "5/8": 9.31, "3/4": 13.4 };   // kg por varilla de 6 m
// Conversión de lo escrito a la unidad del insumo: [factor, explicación].
export const CONVERSION_TEXTO = {
  "cem:kg": [1 / 50, "el cemento viene en bultos de 50 kg"], "cem:und": [1, ""], "peg:kg": [1 / 25, "el pegante viene en bultos de 25 kg"], "peg:und": [1, ""],
  "are:bulto": [1 / 36, "1 m³ de arena son unos 36 bultos"], "gra:bulto": [1 / 30, "1 m³ de triturado son unos 30 bultos"],
  "imp:bulto": [25, "bulto de 25 kg"], "alb:rollo": [10, "rollo de 10 kg"], "alb:lb": [0.4536, "1 lb = 0,45 kg"], "acr:lb": [0.4536, "1 lb = 0,45 kg"],
  "boq:lb": [0.4536, "1 lb = 0,45 kg"], "pun:kg": [2.2046, "1 kg = 2,2 lb"], "cpa:caja": [1.44, "cajas de 1,44 m²"], "cpi:caja": [1.44, "cajas de 1,44 m²"],
  "tps:tubo": [6, "tubos de 6 m"], "tpp:tubo": [6, "tubos de 6 m"], "mal:und": [14.1, "malla de 6 × 2,35 m"], "acc:und": [1, ""], "blq:und": [1, ""], "blc:und": [1, ""]
};
// Materiales que se confunden si no se dice el tipo: se elige el que usa la obra.
export const AMBIGUOS = [
  { ids: ["blq", "blc"], tipo: /arcilla|ladrill|concreto|cemento/ },
  { ids: ["cpa", "cpi"], tipo: /piso|pared|baldos|azulej|enchap|tablet/ },
  { ids: ["tps", "tpp"], tipo: /desag|sanitari|presion|agua|1\/2|\b2\b/ }
];
