/**
 * Instrucciones (prompt) y esquemas JSON para la IA. Se arman con los mismos datos de la herramienta
 * (tipos de obra, APU, insumos, lo que no se calcula), así que si se agrega una actividad o un insumo
 * la IA lo conoce sin tocar este archivo.
 */
import { APU } from "../datos/apu.js";
import { INSUMOS } from "../datos/precios.js";
import { TIPOS_HUECO, FORMAS_HUECO } from "../dominio/huecos.js";
import { TIPOS } from "../datos/tipos-obra.js";
import { TRABAJOS, NO_SOPORTADO } from "../datos/lenguaje.js";
import { actividadesDelTipo } from "../dominio/actividades.js";

const TIPOS_OBRA = Object.keys(TIPOS);
const CODIGOS_APU = APU.map(a => a.codigo);
const CODIGOS_TRABAJO = TRABAJOS.map(t => t.codigo);
const MATERIALES = Object.entries(INSUMOS).filter(([, i]) => i.tipo === "material");
export const CATEGORIAS_NO_SOPORTADO = NO_SOPORTADO.map(([, nombre]) => nombre);
export const UNIDADES_IA = ["bulto", "kg", "lb", "m3", "m2", "m", "und", "varilla", "caja", "tubo", "rollo", "viaje", "ninguna"];
export const CALIBRES = ["1/4", "3/8", "1/2", "5/8", "3/4", "no-dice"];
// Lo que ya existe en una remodelación: muros, su estructura y la placa de piso.
const ESTRUCTURA = ["MAM-01", "MAM-02", "CON-01", "CON-02", "CON-05", "ACE-01", "CON-04", "CON-03"];

const apu = codigo => APU.find(a => a.codigo === codigo);
const COMO_SE_MIDE = {
  pared: "m² de pared: area, o largo y alto; si es sobre un espacio, largo y ancho del espacio",
  piso: "m² de piso: area, o largo y ancho", largo: "metros lineales: largo (en columnas: conteo y alto)",
  zapatas: "conteo de zapatas", cantidad: "conteo de puntos"
};

const REGLAS = `REGLAS OBLIGATORIAS
1. Números: usa exactamente los que escribió la persona. No redondees, no inventes, no completes medidas que no dijo: déjalas en null. Solo puedes pasar centímetros o milímetros a metros. En Colombia la coma es decimal (2,5 = 2.5) y el punto separa miles (1.500 = 1500).
2. "texto" es siempre una copia literal del fragmento del mensaje, sin corregir ortografía ni cambiar palabras.
3. Usa solo los tipos, códigos e identificadores de las listas. Nunca inventes otros.
4. Nada de lo que pidió la persona se puede perder. Si pidió algo que no queda representado exactamente en los datos (una marca, un material o acabado distinto al de la lista, el tamaño de una puerta o ventana, una condición especial), ponlo en "observaciones" con el texto literal y una nota corta y neutral, en español formal e impersonal (sin tutear), que diga qué hará la herramienta.
5. Si no sabes qué es algo, ponlo en "dudas" con los tipos más probables (dos o más). Es mejor preguntar que adivinar. Si el tipo es claro aunque no dé medidas ("una pared divisoria", "cerramiento del lote"), no es una duda: es una parte con las medidas en null, y la herramienta pone medidas de ejemplo para que la persona las corrija.
6. No agregues nada que la persona no pidió.`;

/** Instrucciones para entender la descripción de la obra. */
export function instruccionesObra() {
  const tipos = TIPOS_OBRA.map(t => {
    const campos = TIPOS[t].campos.map(([c, etiqueta]) => `${c} (${etiqueta.toLowerCase()})`).join(", ");
    const incluye = actividadesDelTipo(t).map(c => `${c} ${apu(c).corto}`).join(", ");
    return `- ${t}: ${TIPOS[t].nombre.replace(/^Una? /, "")} (${TIPOS[t].desc}). Medidas: ${campos}. Incluye: ${incluye}.`;
  }).join("\n");
  const trabajos = TRABAJOS.map(t => `- ${t.codigo}: ${apu(t.codigo).nombre} (${apu(t.codigo).unidad}). Se mide en ${COMO_SE_MIDE[t.medida]}.`).join("\n");
  const materiales = MATERIALES.map(([id, i]) => `- ${id}: ${i.nombre} (${i.unidad})`).join("\n");

  return `Eres el intérprete de una herramienta que hace presupuestos de obras pequeñas de un piso en Cali (Colombia). Convierte lo que escribe la persona en datos. No calculas precios ni cantidades de material: eso lo hace la herramienta con fórmulas revisadas.

${REGLAS}

PARTES: construcciones completas.
${tipos}
- "cantidad" = cuántas iguales ("4 muros" = 4; "dos baños" = 2). Si no lo dice, 1.
- "3 muros de 4 x 2,5 y 2 de 6 x 2,5" son dos partes: 3 muros y 2 muros, cada una con sus medidas.
- Una casa incluye sus baños, cocina y habitaciones: "casa de 9 x 7 con dos baños y cocina" es UNA parte casa con banos = 2. En cambio "3 habitaciones con un baño" son dos partes.
- En una casa, el número de habitaciones, alcobas o cocinas no cambia el cálculo: se calcula con el área de la planta, el alto de los muros y el número de baños. No pongas observaciones sobre eso ni digas que se ajustará: la herramienta agrega sola una nota que lo explica.
- En un muro, "A x B" es largo x alto. En un espacio, "A x B" es largo x ancho y "A x B x C" es largo x ancho x alto.
- "area": solo si dio el área en m² en vez de largo y ancho ("un apartamento de 60 m2"); deja largo y ancho en null.
- "puertas" y "ventanas": cuántas dijo en un muro; "vanos": solo si dio los m² de puertas y ventanas.
- "huecos": si describe la forma o las medidas de una puerta o ventana ("puerta en arco", "ventana circular de 60 cm de diámetro", "ojo de buey", "2 puertas de 0,9 x 2,1"). Forma "arco" es arco de medio punto: "alto" es el alto total, hasta la clave del arco; si da un solo número, es el ancho. En "circular" va el "diametro". Las medidas que no dijo van en null. Si usa "huecos", deja "puertas", "ventanas" y "vanos" en null. La hoja de la puerta o ventana (carpintería) no se calcula: el hueco sí se descuenta del muro.
- "sistema": "concreto" si pidió bloque de concreto o de cemento; "arcilla" si pidió ladrillo o bloque de arcilla; si no, "sin-especificar".
- "excluir": códigos de las actividades de esa parte que la persona pidió NO incluir ("sin enchape" → ACB-01; "sin piso" → ACB-02). Si dice remodelar, arreglar o renovar un espacio que ya existe, o que los muros ya están, excluye el muro, su estructura y la placa de contrapiso (${ESTRUCTURA.join(", ")}), marca "remodelacion": true y agrega una observación que lo explique. Con "remodelacion" la herramienta agrega sola la demolición del enchape (DEM-01) y del piso (DEM-02) que se van a cambiar; si dice que no hay que demoler algo, excluye ese código.

TRABAJOS SUELTOS: cuando pide un trabajo y no un espacio completo.
${trabajos}
- Copia las medidas tal como las dijo: area, largo, ancho, alto o conteo. Si el trabajo es sobre un espacio ("enchapar el baño de 2 x 1,5"), indica el tipo de espacio en "espacio"; si no, "ninguno".
- "pañetar y enchapar un muro de 5 x 2,4" son dos trabajos con las mismas medidas.

MATERIALES QUE YA TIENE: si la descripción dice que ya tiene materiales ("tengo 20 bultos de cemento"), ponlos en "materiales" con la cantidad y la unidad tal como las escribió. Si el material no está en la lista, usa "otro".
${materiales}

NO SE CALCULA (va en "noSoportado" con su categoría): ${CATEGORIAS_NO_SOPORTADO.join("; ")}. Si es otra cosa que no se puede calcular, categoría "otro". Lo que no se calcula no borra lo demás: "un baño nuevo en el segundo piso" es una parte bano y además noSoportado con la categoría "más de un piso (se calcula uno solo)".

EJEMPLOS
- "4 muros de 3 x 2,5 en bloque de concreto y un baño de 2x1,5 sin enchape" → partes: muro cantidad 4, largo 3, alto 2.5, sistema concreto; bano cantidad 1, largo 2, ancho 1.5, alto null, excluir [ACB-01].
- "remodelar la cocina de 3 x 2,5 con porcelanato y mesón de 2 m" → parte cocina largo 3, ancho 2.5, meson 2, excluir la estructura; observaciones: "remodelar" (no se incluyen muros, estructura ni placa porque ya existen; se pueden activar en Medidas) y "con porcelanato" (se calcula con la cerámica de piso de referencia; se puede poner el precio del porcelanato en Precios).
- "pañetar la sala de 20 m2, ya tengo 10 bultos de cemento" → trabajo PAN-01 area 20; materiales: cem, cantidad 10, unidad bulto.
- "casa de 9 x 7 con dos baños, techo en teja y pintura" → parte casa largo 9, ancho 7, banos 2; noSoportado: techo en teja (techos o cubiertas), pintura (pintura).
- "necesito una pared divisoria" → parte muro cantidad 1, largo null, alto null.
- "muro de 4 x 2,5 con una puerta en arco de 1 m de ancho" → parte muro largo 4, alto 2.5; huecos: puerta, forma arco, cantidad 1, ancho 1, alto null, diametro null.
- "algo bonito para el patio" → dudas: ese texto, opciones muro y cuarto.`;
}

/** Instrucciones para leer los materiales que la persona dice tener. */
export function instruccionesMateriales() {
  const materiales = MATERIALES.map(([id, i]) => `- ${id}: ${i.nombre} (${i.unidad})`).join("\n");
  return `Eres el asistente de una herramienta de presupuestos de obra en Cali (Colombia). La persona escribe los materiales de construcción que ya tiene; conviértelos en datos, uno por material.

${REGLAS}

- "id": el insumo de la lista que corresponde; "otro" si no está (y el nombre como lo dijo en "nombre").
- "cantidad" y "unidad": tal como las escribió (${UNIDADES_IA.filter(u => u !== "ninguna").join(", ")}). Si cuenta piezas ("300 ladrillos", "4 codos"), la unidad es "und". Si no dijo unidad, "ninguna". Si no dijo cantidad, null.
- "calibre": si son varillas y dijo el calibre; si no, "no-dice".
- "tipoDicho": true solo si dijo el tipo exacto que distingue materiales parecidos: bloque de arcilla o de concreto; cerámica de piso o de pared; tubería sanitaria (desagüe) o de presión (agua).
- "20 bultos de cemento y 3 de pegante" son dos materiales.

INSUMOS
${materiales}`;
}

const nulo = (tipo, descripcion) => ({ type: [tipo, "null"], description: descripcion });
const texto = descripcion => ({ type: "string", description: descripcion });
const LITERAL = "Copia literal del fragmento del mensaje";

/** Esquema de la respuesta para la descripción de la obra. */
export const ESQUEMA_OBRA = {
  type: "object",
  properties: {
    partes: { type: "array", items: { type: "object", properties: {
      texto: texto(LITERAL),
      tipo: { type: "string", enum: TIPOS_OBRA },
      cantidad: { type: "integer", description: "Cuántas iguales; 1 si no lo dice" },
      largo: nulo("number", "metros"), ancho: nulo("number", "metros"), alto: nulo("number", "metros"),
      area: nulo("number", "m², solo si dio el área en vez de largo y ancho"),
      vanos: nulo("number", "m² de puertas y ventanas, solo si los dio en m²"),
      puertas: nulo("integer", "cuántas puertas dijo (muro)"), ventanas: nulo("integer", "cuántas ventanas dijo (muro)"),
      huecos: { type: "array", description: "Puertas y ventanas con forma o medidas; vacío si no las describe", items: { type: "object", properties: {
        texto: texto(LITERAL),
        tipo: { type: "string", enum: TIPOS_HUECO },
        forma: { type: "string", enum: FORMAS_HUECO },
        cantidad: { type: "integer", description: "cuántas iguales; 1 si no lo dice" },
        ancho: nulo("number", "metros"), alto: nulo("number", "metros; en arco, el alto total hasta la clave"),
        diametro: nulo("number", "metros, solo si es circular")
      }, required: ["texto", "tipo", "forma", "cantidad", "ancho", "alto", "diametro"] } },
      meson: nulo("number", "metros de mesón (cocina)"), banos: nulo("integer", "número de baños (casa)"),
      sistema: { type: "string", enum: ["arcilla", "concreto", "sin-especificar"] },
      excluir: { type: "array", items: { type: "string", enum: CODIGOS_APU } },
      remodelacion: { type: "boolean", description: "true si el espacio ya existe y se va a remodelar, arreglar o renovar" }
    }, required: ["texto", "tipo", "cantidad", "largo", "ancho", "alto", "area", "vanos", "puertas", "ventanas", "huecos", "meson", "banos", "sistema", "excluir", "remodelacion"] } },
    trabajos: { type: "array", items: { type: "object", properties: {
      texto: texto(LITERAL),
      codigo: { type: "string", enum: CODIGOS_TRABAJO },
      area: nulo("number", "m²"), largo: nulo("number", "metros"), ancho: nulo("number", "metros"), alto: nulo("number", "metros"),
      conteo: nulo("integer", "número de puntos, columnas o zapatas"),
      espacio: { type: "string", enum: [...TIPOS_OBRA, "ninguno"] }
    }, required: ["texto", "codigo", "area", "largo", "ancho", "alto", "conteo", "espacio"] } },
    materiales: { type: "array", items: { type: "object", properties: {
      texto: texto(LITERAL),
      id: { type: "string", enum: [...MATERIALES.map(([id]) => id), "otro"] },
      cantidad: nulo("number", "tal como la escribió"),
      unidad: { type: "string", enum: UNIDADES_IA }
    }, required: ["texto", "id", "cantidad", "unidad"] } },
    observaciones: { type: "array", items: { type: "object", properties: {
      texto: texto(LITERAL), nota: texto("Qué hará la herramienta con ese pedido, en una frase")
    }, required: ["texto", "nota"] } },
    noSoportado: { type: "array", items: { type: "object", properties: {
      texto: texto(LITERAL), categoria: { type: "string", enum: [...CATEGORIAS_NO_SOPORTADO, "otro"] }
    }, required: ["texto", "categoria"] } },
    dudas: { type: "array", items: { type: "object", properties: {
      texto: texto(LITERAL), opciones: { type: "array", items: { type: "string", enum: TIPOS_OBRA } }
    }, required: ["texto", "opciones"] } }
  },
  required: ["partes", "trabajos", "materiales", "observaciones", "noSoportado", "dudas"]
};

/** Esquema de la respuesta para los materiales que la persona tiene. */
export const ESQUEMA_MATERIALES = {
  type: "object",
  properties: {
    materiales: { type: "array", items: { type: "object", properties: {
      texto: texto(LITERAL),
      id: { type: "string", enum: [...MATERIALES.map(([id]) => id), "otro"] },
      nombre: texto("El material como lo nombró la persona"),
      cantidad: nulo("number", "tal como la escribió"),
      unidad: { type: "string", enum: UNIDADES_IA },
      calibre: { type: "string", enum: CALIBRES },
      tipoDicho: { type: "boolean" }
    }, required: ["texto", "id", "nombre", "cantidad", "unidad", "calibre", "tipoDicho"] } }
  },
  required: ["materiales"]
};
