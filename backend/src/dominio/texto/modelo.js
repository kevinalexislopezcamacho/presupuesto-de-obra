/**
 * Modelo entrenado una sola vez al iniciar el servidor, y su evaluación honesta.
 */

import { EJEMPLOS } from "../../datos/entrenamiento.js";
import { entrenar, evaluar } from "./clasificador.js";

export const MODELO = entrenar(EJEMPLOS);             // modelo final: usa todas las frases
export const EVALUACION = evaluar(EJEMPLOS);          // métrica honesta: validación cruzada, ninguna frase se prueba con un modelo que la vio
export const UMBRAL_CONFIANZA = 0.6;
