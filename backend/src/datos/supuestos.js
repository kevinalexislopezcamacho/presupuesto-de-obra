/**
 * Supuestos de cálculo: explícitos para poder defenderlos y ajustarlos.
 */

export const SUPUESTOS = {
  sepColumnas: 3.0,          // m entre columnas de confinamiento (verificar con NSR-10 Título E)
  aceroConfinamiento: 3.3,   // kg de acero por m de columna o viga de confinamiento
  aceroCimentacion: 5.0,     // kg de acero por m de viga de cimentación
  puerta: 1.68,              // m² (0,80 × 2,10)
  ventana: 0.6,              // m² ventana típica de baño o cocina
  ventanaCuarto: 1.44,       // m² ventana de habitación (1,2 × 1,2)
  ventanaMuro: 1.2,          // m² ventana típica en un muro suelto (1,0 × 1,2)
  alturaEnchape: 2.1,        // m de enchape en baño
  murosInternosCasa: 0.6,    // muros internos ≈ 60 % del perímetro de la casa
  vanosCasa: 0.12,           // puertas y ventanas ≈ 12 % del área de muro
  zapataPorColumna: 0.144,   // m³ (0,60 × 0,60 × 0,40)
  enchapePorBano: 13,        // m² de enchape de pared por baño típico
  pisoPorBano: 3,            // m² de piso por baño típico
  alturaMaxSinRevision: 3.0, // m; por encima se recomienda revisión estructural
  // Cimentación y movimiento de tierra (aprobados por el equipo; conviene revisión de un ingeniero)
  anchoZanjaViga: 0.40,      // m de ancho de la zanja de la viga de cimentación
  fondoZanjaViga: 0.50,      // m de profundidad de la zanja
  seccionVigaCimentacion: 0.05, // m³ de concreto por m de viga (0,20 × 0,25 m)
  ladoExcavacionZapata: 0.80,   // m por lado de la excavación de cada zapata
  fondoExcavacionZapata: 0.60,  // m de profundidad
  espesorSolado: 0.05,       // m de concreto de limpieza bajo vigas y zapatas
  esponjamiento: 1.3,        // la tierra suelta ocupa 30 % más que en el terreno
  franjaReplanteoMuro: 0.40  // m de franja en planta para localizar y replantear un muro suelto
};
