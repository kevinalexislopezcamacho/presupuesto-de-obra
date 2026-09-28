/**
 * Tipos de construcción que calcula la herramienta, con sus medidas y valores por defecto.
 */

export const TIPOS = {
  muro:   { nombre: "Un muro", desc: "Pared en mampostería confinada",
            campos: [["largo", "Largo del muro", 6], ["alto", "Alto", 2.5], ["vanos", "Área de puertas y ventanas (m²)", 0]] },
  bano:   { nombre: "Un baño", desc: "Muros, piso, enchape y puntos",
            campos: [["largo", "Largo", 2.0], ["ancho", "Ancho", 1.5], ["alto", "Alto de muros", 2.4]] },
  cocina: { nombre: "Una cocina", desc: "Muros, piso, mesón y puntos",
            campos: [["largo", "Largo", 3.0], ["ancho", "Ancho", 2.5], ["alto", "Alto de muros", 2.4], ["meson", "Largo del mesón", 2.5]] },
  cuarto: { nombre: "Un cuarto", desc: "Habitación, bodega, oficina o garaje",
            campos: [["largo", "Largo", 3.0], ["ancho", "Ancho", 3.0], ["alto", "Alto de muros", 2.4]] },
  casa:   { nombre: "Una casa", desc: "Un piso, obra gris y acabados básicos",
            campos: [["largo", "Largo de la planta", 10], ["ancho", "Ancho de la planta", 7], ["alto", "Alto de muros", 2.5], ["banos", "Número de baños", 1]] }
};
/** Los tipos de construcción, en el orden en que se muestran. */
export const TIPOS_OBRA = Object.keys(TIPOS);

// Nombres para mostrar cantidades ("4 muros", "1 baño").
export const NOMBRES_TIPO = {
  muro: ["muro", "muros"], bano: ["baño", "baños"], cocina: ["cocina", "cocinas"],
  cuarto: ["cuarto", "cuartos"], casa: ["casa", "casas"]
};
