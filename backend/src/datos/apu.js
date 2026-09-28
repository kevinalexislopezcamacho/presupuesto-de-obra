/**
 * Análisis de precios unitarios (APU): insumos por unidad de actividad.
 * `rendimiento` = unidades que hace la cuadrilla en un día de 8 h. La cuadrilla es 1 oficial con los ayudantes
 * que indican las horas-hombre (casi siempre 1; 2 en concretos vaciados, medio en enchapes).
 * `corto` = nombre breve para mostrar y para que la IA lo reconozca.
 */

// Listado de la Gobernación del Valle 2024 (Decreto 1.22-1441): ver datos/listas-oficiales.
const URL_GOBERNACION_2024 = "https://cdnm.heyzine.com/files/uploaded/6974b64a5ee54ea4f0181b50808c40b0d7260a79.pdf";
const gob = (item, precio) => ({ fuente: "Gobernación del Valle 2024", item, precio, url: URL_GOBERNACION_2024 });

export const APU = [
  { codigo: "MAM-01", corto: "Muro en bloque de arcilla", categoria: "Mampostería", unidad: "m²", rendimiento: 12, nombre: "Muro en bloque de arcilla N.º 5, mampostería confinada",
    insumos: [["blq", 13.5], ["cem", 0.21], ["are", 0.029], ["agu", 0.007], ["mof", 0.67], ["may", 0.67]] },
  { codigo: "MAM-02", corto: "Muro en bloque de concreto", categoria: "Mampostería", unidad: "m²", rendimiento: 11, nombre: "Muro en bloque de concreto 12×20×40, mampostería confinada",
    insumos: [["blc", 12.5], ["cem", 0.16], ["are", 0.022], ["agu", 0.005], ["mof", 0.73], ["may", 0.73]] },
  { codigo: "CON-01", corto: "Columnas de confinamiento", categoria: "Concreto", unidad: "m", rendimiento: 10, nombre: "Columna de confinamiento 0,12 × 0,20 m, concreto 21 MPa",
    insumos: [["cem", 0.168], ["are", 0.0134], ["gra", 0.0202], ["agu", 0.0046], ["for", 0.52], ["pun", 0.04], ["mez", 0.05], ["mof", 0.8], ["may", 0.8]] },
  { codigo: "CON-02", corto: "Viga de amarre", categoria: "Concreto", unidad: "m", rendimiento: 12, nombre: "Viga de confinamiento 0,12 × 0,20 m, concreto 21 MPa",
    insumos: [["cem", 0.168], ["are", 0.0134], ["gra", 0.0202], ["agu", 0.0046], ["for", 0.44], ["pun", 0.04], ["mez", 0.05], ["mof", 0.67], ["may", 0.67]] },
  { codigo: "CON-03", corto: "Placa de contrapiso", categoria: "Concreto", unidad: "m²", rendimiento: 20, nombre: "Placa de contrapiso en concreto 21 MPa, e = 0,10 m",
    insumos: [["cem", 0.7], ["are", 0.056], ["gra", 0.084], ["agu", 0.019], ["mez", 0.08], ["vib", 0.05], ["mof", 0.4], ["may", 0.8]] },
  { codigo: "CON-04", corto: "Zapatas", categoria: "Concreto", unidad: "m³", rendimiento: 2, nombre: "Zapata en concreto 21 MPa",
    insumos: [["cem", 7], ["are", 0.56], ["gra", 0.84], ["agu", 0.19], ["for", 2], ["pun", 0.3], ["mez", 0.8], ["vib", 0.5], ["mof", 4], ["may", 8]] },
  { codigo: "CON-05", corto: "Viga de cimentación", categoria: "Concreto", unidad: "m", rendimiento: 8, nombre: "Viga de cimentación 0,20 × 0,25 m, concreto 21 MPa",
    insumos: [["cem", 0.35], ["are", 0.028], ["gra", 0.042], ["agu", 0.0095], ["for", 0.5], ["pun", 0.05], ["mez", 0.1], ["mof", 1], ["may", 2]] },
  { codigo: "ACE-01", corto: "Acero de refuerzo", categoria: "Acero de refuerzo", unidad: "kg", rendimiento: 200, nombre: "Acero de refuerzo fy 420 MPa, figurado y amarrado",
    insumos: [["acr", 1.05], ["alb", 0.02], ["mof", 0.04], ["may", 0.04]] },
  { codigo: "ACE-02", corto: "Malla electrosoldada", categoria: "Acero de refuerzo", unidad: "m²", rendimiento: 250, nombre: "Malla electrosoldada D-84 instalada",
    insumos: [["mal", 1.05], ["alb", 0.01], ["mof", 0.032], ["may", 0.032]] },
  // Rendimiento 12,5 m²/día: APU público de pañete liso sobre muros (catálogo CIO de Bogotá, 0,08 jornales de cuadrilla
  // por m², SECOP 2019) y mano de obra de la lista oficial de Boyacá 2022 (ítem 1.05.13). Antes eran 20 m²/día.
  { codigo: "PAN-01", corto: "Pañete", categoria: "Acabados", unidad: "m²", rendimiento: 12.5, nombre: "Pañete liso 1:4 sobre muro, e = 1,5 cm",
    insumos: [["cem", 0.13], ["are", 0.018], ["agu", 0.004], ["mof", 0.64], ["may", 0.64]] },
  { codigo: "ACB-01", corto: "Enchape de paredes", categoria: "Acabados", unidad: "m²", rendimiento: 10, nombre: "Enchape cerámico de pared",
    insumos: [["cpa", 1.05], ["peg", 0.2], ["boq", 0.3], ["mof", 0.8], ["may", 0.4]] },
  { codigo: "ACB-02", corto: "Piso en cerámica", categoria: "Acabados", unidad: "m²", rendimiento: 12, nombre: "Piso en cerámica",
    insumos: [["cpi", 1.05], ["peg", 0.2], ["boq", 0.3], ["mof", 0.67], ["may", 0.33]] },
  { codigo: "IMP-01", corto: "Impermeabilización", categoria: "Acabados", unidad: "m²", rendimiento: 25, nombre: "Impermeabilización cementicia de piso y ducha",
    insumos: [["imp", 2], ["mof", 0.3], ["may", 0.3]] },
  { codigo: "MES-01", corto: "Mesón", categoria: "Acabados", unidad: "m", rendimiento: 4, nombre: "Mesón en concreto de 0,60 m enchapado",
    insumos: [["cem", 0.25], ["are", 0.02], ["gra", 0.03], ["agu", 0.007], ["acr", 3], ["for", 0.8], ["cpi", 0.7], ["peg", 0.15], ["boq", 0.2], ["mof", 2], ["may", 2]] },
  { codigo: "HID-01", corto: "Puntos de agua y desagüe", categoria: "Instalaciones", unidad: "und", rendimiento: 4, nombre: "Punto hidrosanitario (agua y desagüe)",
    insumos: [["tps", 3], ["tpp", 3], ["acc", 4], ["mof", 2], ["may", 2]] },

  // Ítems con precio oficial: la Gobernación publica el valor por unidad, pero no su composición.
  // El rendimiento es de referencia (para el cronograma) y conviene confirmarlo con quien haga la obra.
  { codigo: "PRE-01", corto: "Localización y replanteo", categoria: "Preliminares", unidad: "m²", rendimiento: 150, nombre: "Localización y replanteo de obra arquitectónica",
    insumos: [], oficial: gob("100113", 5392) },
  { codigo: "DEM-01", corto: "Demolición de enchape", categoria: "Preliminares", unidad: "m²", rendimiento: 15, nombre: "Demolición de enchape cerámico de muro",
    insumos: [], oficial: gob("100305", 12080) },
  { codigo: "DEM-02", corto: "Demolición de piso", categoria: "Preliminares", unidad: "m²", rendimiento: 15, nombre: "Demolición de piso cerámico con mortero",
    insumos: [], oficial: gob("100407", 8288) },
  { codigo: "EXC-01", corto: "Excavación manual", categoria: "Movimiento de tierra", unidad: "m³", rendimiento: 3.5, nombre: "Excavación manual en tierra",
    insumos: [], oficial: gob("100601", 26555) },
  { codigo: "EXC-02", corto: "Relleno compactado", categoria: "Movimiento de tierra", unidad: "m³", rendimiento: 5, nombre: "Relleno con material del sitio compactado con rana",
    insumos: [], oficial: gob("100618", 31134) },
  { codigo: "EXC-03", corto: "Retiro de sobrantes", categoria: "Movimiento de tierra", unidad: "m³", rendimiento: 20, nombre: "Cargue y retiro de sobrantes en volqueta (hasta 10 km)",
    insumos: [], oficial: gob("100628", 28681) },
  { codigo: "CON-06", corto: "Concreto de limpieza", categoria: "Concreto", unidad: "m²", rendimiento: 25, nombre: "Concreto de limpieza (solado) e = 0,05 m, 3000 psi",
    insumos: [], oficial: gob("120210", 32609) }
];
