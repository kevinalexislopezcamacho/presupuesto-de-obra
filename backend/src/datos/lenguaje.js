/**
 * Vocabulario del intérprete: palabras vacías, números escritos, palabras que nombran
 * cada construcción, trabajos sueltos y lo que la herramienta todavía no calcula.
 * Todo se compara con texto normalizado (minúsculas y sin tildes).
 */

// Palabras que no aportan al clasificador.
export const PALABRAS_VACIAS = new Set(("de la el los las un una unos unas y o en para con que mi me mis a al del por se lo es su " +
  "quiero necesito hacer construir nuevo nueva nuevos m mts metro metros cm x no algo cosa ahi alla aqui solo muy tambien").split(" "));

export const NUM_PALABRAS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20 };
export const RE_NUM_PAL = "un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte";

// Palabras que nombran cada tipo de construcción (texto ya normalizado, sin tildes).
export const PALABRAS_TIPO = {
  muro: /\b(muros?|pared(es)?|tapias?|cercas?|cercos?|cerramientos?|divisiones|division|divisori[oa]s?|medianer[oa]s?|culatas?)\b/,
  bano: /\b(banos?|banito|wc|sanitarios?|inodoros?|duchas?|unidad sanitaria|banarse|banarme)\b/,
  cocina: /\b(cocinas?|cocineta|cosina|cocinar)\b/,
  cuarto: /\b(habitacion(es)?|cuartos?|alcobas?|dormitorios?|piezas?|bodegas?|garajes?|oficinas?|locales|local|depositos?|consultorios?|estudio|taller(es)?|salon)\b/,
  casa: /\b(casas?|casita|viviendas?|apartamentos?|apartaestudio|hogar)\b/
};

// Trabajos sueltos que se pueden pedir sin construir un espacio completo.
export const TRABAJOS = [
  { codigo: "PAN-01", re: /\b(panet\w*|repell?\w*|revoc\w*|revoqu\w*)/, medida: "pared" },
  { codigo: "IMP-01", re: /\bimpermeabiliz\w*/, medida: "piso" },
  { codigo: "CON-03", re: /\b(placa|contrapiso|losa|plancha)\b|\bpiso (en|de) (concreto|cemento)\b/, medida: "piso" },
  { codigo: "ACB-01", re: /\b(enchap\w*|azulej\w*)/, medida: "pared" },
  { codigo: "ACB-02", re: /\b(piso|pisos|baldos\w*|porcelanat\w*|embaldos\w*)\b/, medida: "piso" },
  { codigo: "MES-01", re: /\bmeson(es)?\b/, medida: "largo" },
  { codigo: "CON-01", re: /\bcolumnas?\b/, medida: "largo" },
  { codigo: "CON-02", re: /\bvigas?\b/, medida: "largo" },
  { codigo: "CON-04", re: /\bzapatas?\b/, medida: "zapatas" },
  { codigo: "HID-01", re: /\b(puntos? (hidra\w*|sanitari\w*|hidrosanitari\w*|de agua)|tuberias?|desagues?)\b/, medida: "cantidad" },
  { codigo: "ACE-02", re: /\bmalla\b/, medida: "piso" }
];

// Lo que va justo antes de un trabajo y lo niega: "sin enchape", "sin cambiar el piso", "no quiero mesón".
export const RE_NEGACION = /\b(sin|no)(?:\s+(?:cambiar|hacer|poner|incluir|incluyas|hagas|pongas|tocar|quiero|necesito|el|la|los|las|lo|un|una|nuevo|nueva|nuevos|nuevas))*\s*$/;
// Remodelar un espacio que ya existe: no se cobran muros, estructura ni placa.
export const RE_REMODELAR = /\b(remodel\w*|arregl\w*|renov\w*|reform\w*|adecu\w*)/;
// Los muros ya están: no se cobran muros ni su estructura.
export const RE_MUROS_EXISTEN = /\b(sin (?:hacer |construir |levantar )?(?:los )?(?:muros|paredes)|(?:muros|paredes) ya (?:estan|existen|hech[oa]s)|ya (?:tengo|tiene|hay) (?:los )?(?:muros|paredes))\b/;
export const ESTRUCTURA = ["MAM-01", "MAM-02", "CON-01", "CON-02", "CON-05", "ACE-01", "CON-04"];
// Acabados que la herramienta calcula con los materiales de referencia (se avisa para poner su precio).
export const ACABADOS_ESPECIALES = /\b(porcelanat\w*|marmol|granito|madera|laminad\w*|vinil\w*|piedra|gres|microcemento)\b/;

// Cosas que la herramienta todavía no calcula.
export const NO_SOPORTADO = [
  [/\b(techo|techos|cubierta|tejas?|tejado)\b/, "techos o cubiertas"], [/\b(escaleras?)\b/, "escaleras"],
  [/\b(piscinas?)\b/, "piscinas"], [/\b(pintur\w*|pintar)\b/, "pintura"], [/\b(electric\w*|tomacorrientes?|cableado)\b/, "instalaciones eléctricas"],
  [/\b(dos pisos|2 pisos|dos plantas|tres pisos|3 pisos|segundo piso|segunda planta|tercer piso|otro piso|otra planta|planta alta|entrepiso|placa aerea|mezzanine|altillo)\b/, "más de un piso (se calcula uno solo)"],
  [/\b(cielo raso|cielorraso|drywall|superboard)\b/, "cielo raso o drywall"], [/\b(ventanas? nuevas?|puertas? nuevas?|carpinteria)\b/, "puertas, ventanas y carpintería"],
  // Obras exteriores que no son muros ni placas: sin esto, "un kiosko en el patio" se entendería como un muro.
  [/\b(kioscos?|kioskos?|quioscos?|pergolas?|marquesinas?|enramadas?|ramadas?|(?:parqueaderos?|garajes?|cocheras?) cubiert[oa]s?)\b/, "kioscos, pérgolas y marquesinas (llevan cubierta)"],
  [/\b(jacuzzis?|hidromasajes?|saunas?|turcos?)\b/, "jacuzzis, saunas y turcos"],
  [/\b(bbq|asador(?:es)?|barbacoas?)\b/, "asadores y BBQ"], [/\b(canchas?)\b/, "canchas deportivas"]
];
