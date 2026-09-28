/**
 * Estado del sistema: integridad de la base de APU y calidad del modelo de texto.
 */
import { APU } from "../datos/apu.js";
import { INSUMOS, FECHA_PRECIOS } from "../datos/precios.js";
import { EJEMPLOS } from "../datos/entrenamiento.js";
import { validarBase } from "../dominio/apu.js";
import { EVALUACION, UMBRAL_CONFIANZA } from "../dominio/texto/modelo.js";
import { evaluarInterprete } from "../dominio/texto/interprete.js";
import { metricasPorClase, baseMayoritaria, basePalabrasClave, sistemaCombinado } from "../dominio/texto/metricas.js";

let diagnostico = null;

/** @returns {object} resultado de las revisiones (se calcula una vez) */
export function obtenerDiagnostico() {
  if (diagnostico) return diagnostico;
  const erroresBase = validarBase(APU, INSUMOS);
  const interprete = evaluarInterprete();
  diagnostico = {
    estado: erroresBase.length ? "con-errores" : "ok",
    fechaPrecios: FECHA_PRECIOS,
    base: { apu: APU.length, insumos: Object.keys(INSUMOS).length, errores: erroresBase },
    modelo: {
      algoritmo: "Naive Bayes multinomial con suavizado de Laplace",
      frases: Object.values(EJEMPLOS).reduce((s, l) => s + l.length, 0),
      umbralConfianza: UMBRAL_CONFIANZA,
      ...EVALUACION, predicciones: undefined,
      metricas: metricasPorClase(EVALUACION.matriz, EVALUACION.clases),
      lineasBase: [baseMayoritaria(EJEMPLOS), basePalabrasClave(EJEMPLOS)],
      combinado: sistemaCombinado(EVALUACION.predicciones)
    },
    interprete
  };
  return diagnostico;
}
