/**
 * Precios oficiales (costo directo) para contrastar los APU propios.
 * Solo las referencias equivalentes (el mismo elemento, material y formato, con valor verificado) cuentan para marcar
 * una actividad que se aleja más de LIMITE_REFERENCIA; las marcadas `equivalente: false` se muestran como orientativas.
 */
export const LIMITE_REFERENCIA = 0.25;

// Cali 2026: Resolución 4151.010.21.1.84 del 21 de abril de 2026, Secretaría de Infraestructura.
// EMCALI 2025: Listado de precios unitarios para redes de acueducto y alcantarillado.
// Gobernación 2024: Decreto 1.22-1441 del 14 de agosto de 2024, listado de precios de referencia del Valle del Cauca.
const URL_CALI = "https://www.cali.gov.co/documentos/1045/precios-unitarios/";
const URL_EMCALI = "https://www.emcali.com.co/documents/d/guest/lista-de-precios-emcali-2025-oficial";
const URL_GOB = "https://www.valledelcauca.gov.co/publicaciones/83513/listo-el-decreto-con-el-listado-de-precios-de-referencia-para-obras-civiles-en-el-valle-del-cauca/";
const gob = (item, desc, precio, nota) => ({ fuente: "Gobernación 2024", url: URL_GOB, item, desc, precio, nota });
export const REFERENCIAS_OFICIALES = {
  // La lista del Valle no tiene muro en bloque N.º 5 común: ninguna de estas es equivalente.
  "MAM-01": [{ ...gob("140207", "Muro bloque estructural cerámico 12×20×30", 94686, "bloque estructural, más costoso que el N.º 5 común"), equivalente: false },
             { fuente: "EMCALI 2025", url: URL_EMCALI, item: "10003637", desc: "Mampostería de ladrillo común en soga", precio: 80590, nota: "ladrillo en vez de bloque N.º 5", equivalente: false }],
  "MAM-02": [gob("140106", "Muro bloque concreto 12×19×39", 70357, "mismo sistema")],
  "CON-01": [gob("130201", "Columna amarre muro", 62577, "por metro")],
  "CON-02": [gob("130403", "Viga concreto amarre muro 10-12×20 cm", 49131, "misma sección"),
             { fuente: "Cali 2026", url: URL_CALI, item: "116", desc: "Vigueta de amarre 15×15 cm, 3500 PSI", precio: 51966, nota: "sección parecida (225 frente a 240 cm²)" }],
  "CON-05": [gob("120301", "Viga cimiento enlace H = 20-40 cm, 3100 PSI", Math.round(861389 * 0.05), "$861.389/m³ × 0,05 m³/m"),
             { fuente: "Cali 2026", url: URL_CALI, item: "119", desc: "Vigueta de amarre 20×25 cm, 3000 PSI, con formaleta, acelerante y curado", precio: 71398, nota: "misma sección; sin acero" }],
  "CON-04": [gob("120213", "Zapata concreto 3000 PSI con formaleta", 566145, "por m³")],
  "CON-03": [gob("200122", "Contrapiso concreto e = 10 cm, 2500 PSI", 74847, "este APU es de 21 MPa (3000 PSI)"),
             { fuente: "Cali 2026", url: URL_CALI, item: "102", desc: "Andén en concreto e = 10 cm, 3000 PSI", precio: 117452, nota: "es un andén (vías), no un contrapiso", equivalente: false }],
  "PAN-01": [gob("190110", "Repello muro 1:4", 27792, "misma mezcla"),
             { fuente: "EMCALI 2025", url: URL_EMCALI, item: "10003627", desc: "Repello con mortero 3000 PSI", precio: 31300, nota: "espesor 2,5 a 3 cm; este APU es de 1,5 cm", equivalente: false }],
  "ACB-01": [gob("190524", "Enchape cerámica 20×30 de 1.ª calidad", 73541, "formato distinto (este APU usa 30×60)")],
  "ACB-02": [gob("200223", "Piso cerámica 40-42,5 × 40-42,5 cm, tráfico 3", 83408, "formato verificado más cercano (este APU usa 51×51)")],
  "MES-01": [gob("140403", "Mesón en concreto A hasta 60 cm, H = 5-8 cm", 126663, "sin enchape; este APU lo incluye")],
  "ACE-01": [gob("120101", "Acero de refuerzo flejado 60000 PSI", 6590, "por kg"),
             { fuente: "Cali 2026", url: URL_CALI, item: "138", desc: "Acero de refuerzo 60000 PSI", precio: 8096, nota: "por kg" },
             { fuente: "EMCALI 2025", url: URL_EMCALI, item: "10000521", desc: "Suministro, corte, figuración y colocación de acero", precio: 4854, nota: "por kg" }],
  "ACE-02": [gob("130106", "Malla electrosoldada M-0.84", Math.round(7779 * 1.32), "$7.779/kg × 1,32 kg/m²"),
             { fuente: "Cali 2026", url: URL_CALI, item: "139", desc: "Malla electrosoldada M-084 15×15", precio: Math.round(9287 * 1.32), nota: "$9.287/kg × 1,32 kg/m²" },
             { fuente: "EMCALI 2025", url: URL_EMCALI, item: "10000569", desc: "Suministro y colocación de malla electrosoldada", precio: Math.round(5028 * 1.32), nota: "$5.028/kg × 1,32 kg/m²" }]
};
