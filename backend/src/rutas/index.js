/**
 * Rutas de la API (todas bajo /api). Ver docs/api.md para ejemplos.
 */
import { Router } from "express";
import { validar, validarConsulta } from "../middlewares/validar.js";
import { esquemaTexto, esquemaMedidas, esquemaMateriales, esquemaCalculo, esquemaBusquedaOficial, esquemaExportacion } from "../validacion/esquemas.js";
import { crearControladorConsulta } from "../controladores/consulta.controlador.js";

/**
 * @param {{ servicioInterprete: ReturnType<import("../servicios/interprete.servicio.js").crearServicioInterprete> }} dependencias
 */
export function crearRutas({ servicioInterprete }) {
  const rutas = Router();
  const consulta = crearControladorConsulta(servicioInterprete);

  rutas.get("/salud", consulta.salud);
  rutas.get("/catalogo", consulta.catalogo);
  rutas.get("/diagnostico", consulta.diagnostico);

  rutas.post("/interpretaciones/obra", validar(esquemaTexto), consulta.interpretarDescripcion);
  rutas.post("/interpretaciones/medidas", validar(esquemaMedidas), consulta.interpretarMedidas);
  rutas.post("/interpretaciones/materiales", validar(esquemaMateriales), consulta.interpretarMateriales);

  rutas.post("/calculos", validar(esquemaCalculo), consulta.calcular);
  rutas.post("/exportaciones/excel", validar(esquemaExportacion), consulta.exportarExcel);

  rutas.get("/listas-oficiales/gobernacion-2024", validarConsulta(esquemaBusquedaOficial), consulta.buscarOficial);
  rutas.get("/listas-oficiales/gobernacion-2024/capitulos", consulta.capitulosOficiales);
  rutas.get("/listas-oficiales/gobernacion-2024/:codigo", consulta.itemOficial);

  return rutas;
}
