/**
 * Datos del modelo de texto:
 * - EJEMPLOS: frases etiquetadas por tipo de construcción (aprendizaje supervisado).
 * - PRUEBA_INTERPRETE: frases nuevas (no están en el entrenamiento) para medir el intérprete completo.
 */

export const EJEMPLOS = {
  muro: [
    "quiero levantar un muro de 6 metros de largo", "necesito una pared divisoria", "construir una tapia en el patio",
    "cerramiento del lote en bloque", "hacer un muro de cerramiento de 12 por 2,5", "levantar una pared de ladrillo",
    "muro medianero con la casa vecina", "pared para dividir la sala", "muro de 4 metros con una ventana",
    "quiero cerrar el patio con una pared", "tapia perimetral para la finca", "muro en bloque de concreto de 3 metros de alto",
    "una pared nueva en la habitación", "muro confinado de 8 x 2.4", "separar el garaje con un muro", "pared de fachada",
    "levantar el muro del antejardín", "construir una pared en mampostería", "dividir el local con un muro",
    "pared de 5 m de largo y 2,5 de alto", "hacer un muro para el lindero", "quiero una pared entre la cocina y la sala",
    "cerca en ladrillo para el lote", "muro de bloque de arcilla", "arreglar la pared del patio", "cerco en bloque para la finca",
    "necesito 4 muros", "paredes para dividir la oficina", "levantar un muro divisorio de 3 metros", "cerrar el lote para que no se metan"
  ],
  bano: [
    "remodelar el baño", "quiero hacer un baño de 2 x 1,5", "construir un baño nuevo en el segundo piso",
    "baño con ducha y sanitario", "necesito un baño social", "hacer una unidad sanitaria",
    "enchapar el baño y cambiar la ducha", "baño auxiliar de 1.5 por 1.2", "agregar un baño a la habitación principal",
    "baño privado con lavamanos", "construir la ducha y el sanitario", "un baño para el local", "baño completo con enchape",
    "baño de servicio en el patio", "quiero un baño pequeño", "batería de baños para el colegio",
    "baño con muros de 2,4 de alto", "hacer el cuarto de baño", "arreglar el baño y poner cerámica",
    "montar un sanitario y un lavamanos", "baño amplio para personas con discapacidad", "ducha nueva con impermeabilización",
    "baño de 2 metros por 1.8", "quiero un baño en el primer piso", "hacer donde bañarse", "poner un inodoro y una ducha",
    "wc para el local", "baño para las visitas", "bano con enchape", "construir 2 baños"
  ],
  cocina: [
    "remodelar la cocina", "hacer una cocina integral", "cocina con mesón de 2,5 metros",
    "construir una cocina nueva de 3 x 2.5", "quiero una cocineta en el apartaestudio", "mesón en concreto para la cocina",
    "cocina abierta hacia la sala", "hacer el lavaplatos y el mesón", "cocina para el restaurante",
    "cambiar el piso de la cocina", "cocina en L con mesón enchapado", "ampliar la cocina", "cocina de 3 metros por 2",
    "zona de cocina y lavadero", "cocina con salpicadero en cerámica", "montar un mesón de 3 m",
    "cocina pequeña para la finca", "construir la cocina del segundo piso", "quiero un mesón con lavaplatos",
    "cocina con isla", "cocina con estufa y horno", "remodelación de cocina y mesón",
    "cocina de 2,5 x 2 con muros de 2,4", "hacer la cocina de la casa", "cosina integral", "cocina con lavaplatos y estufa",
    "hacer la cocina nueva", "cocineta para el apartamento", "cocina y comedor", "donde cocinar en la finca"
  ],
  cuarto: [
    "construir una habitación", "quiero una habitación de 3 x 3", "hacer un cuarto útil en el patio",
    "una alcoba adicional para el niño", "construir una bodega de 4 por 5", "levantar un garaje cerrado",
    "hacer una oficina en el primer piso", "un local comercial de 5 x 6", "cuarto de estudio",
    "habitación principal de 4 x 3,5", "encerrar el patio para hacer un cuarto", "depósito para herramientas",
    "cuarto de ropas", "dormitorio en el segundo piso", "salón pequeño para reuniones", "bodega para guardar materiales",
    "consultorio de 3 por 4", "hacer una pieza para arrendar", "garaje para un carro", "oficina independiente en el lote",
    "cuarto de 3 metros por 3", "una alcoba con clóset", "cuarto para la empleada", "habitación con ventana grande",
    "local para una tienda", "estudio de 2,5 x 3", "construir dos habitaciones", "cuarto de máquinas",
    "taller pequeño de carpintería", "un espacio para guardar las herramientas"
  ],
  casa: [
    "construir una casa de un piso", "quiero hacer mi casa en el lote", "vivienda de 10 x 7",
    "casa de 70 metros cuadrados con dos baños", "construir una vivienda nueva", "casa campestre en la finca",
    "hacer una casa de 8 por 12", "vivienda de interés social", "casa con tres habitaciones y un baño",
    "levantar una casa completa", "obra gris de una casa", "construcción de vivienda unifamiliar",
    "casa pequeña de 6 x 9", "quiero construir la casa entera", "una casita en el campo",
    "casa de una planta con sala comedor", "construir la vivienda en el lote de 7 por 14", "casa con patio y dos baños",
    "casa en bloque de arcilla", "vivienda rural", "casa para arrendar", "construir la casa desde cero",
    "casa de 9 metros por 6 con muros de 2,5", "proyecto de vivienda de un nivel", "un apartamento de 60 m2",
    "casita de dos alcobas", "vivienda de 3 habitaciones con cocina", "construir mi hogar", "casa en el lote de mi papá",
    "donde vivir con mi familia"
  ]
};

// Frases nuevas (no están en el entrenamiento) para medir el intérprete completo.
export const PRUEBA_INTERPRETE = [
  ["necesito 4 muros de 3 metros por 2.5", ["4 muro"]],
  ["quiero una habitación de 3x4", ["1 cuarto"]],
  ["pañetar la sala de 20 m2", ["PAN-01"]],
  ["hacer el piso de la sala de 5 x 4 en cerámica", ["ACB-02"]],
  ["una bodega de 4 por 6", ["1 cuarto"]],
  ["un baño y una cocina", ["1 bano", "1 cocina"]],
  ["arreglar la pared del patio de 10 m", ["1 muro"]],
  ["construir un cuarto útil", ["1 cuarto"]],
  ["quiero hacer donde bañarme", ["1 bano"]],
  ["levantar la tapia del lote de 20 metros", ["1 muro"]],
  ["un apartamento de 60 m2", ["1 casa"]],
  ["enchapar la cocina", ["ACB-01"]],
  ["un garaje", ["1 cuarto"]],
  ["hacer 2 baños de 2x2", ["2 bano"]],
  ["cosina integral", ["1 cocina"]],
  ["casa de 9 x 7 con dos baños y cocina", ["1 casa"]],
  ["3 muros de 4 x 2,5 y 2 de 6 x 2,5", ["3 muro", "2 muro"]],
  ["impermeabilizar la terraza de 30 m2 y hacer un mesón de 2 m", ["IMP-01", "MES-01"]],
  ["donde guardar las herramientas", ["1 cuarto"]],
  ["un baño de 2 x 1,5 y enchapar la cocina", ["1 bano", "ACB-01"]]
];
