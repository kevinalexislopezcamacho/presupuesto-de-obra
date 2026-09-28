/**
 * Rutas de la API (todas bajo /api). Ver docs/api.md para ejemplos.
 */
import { Router } from "express";
import { validar, validarConsulta } from "../middlewares/validar.js";
import { esquemaTexto, esquemaMedidas, esquemaMateriales, esquemaCalculo, esquemaObraGuardada, esquemaBusquedaOficial, esquemaExportacion } from "../validacion/esquemas.js";
import { crearControladorConsulta } from "../controladores/consulta.controlador.js";
import { crearControladorObras } from "../controladores/obras.controlador.js";

/**
 * @param {{
 *   servicioObras: import("../servicios/obras.servicio.js").ServicioObras,
 *   servicioInterprete: ReturnType<import("../servicios/interprete.servicio.js").crearServicioInterprete>
 * }} dependencias
 */
export function crearRutas({ servicioObras, servicioInterprete }) {
  const rutas = Router();
  const consulta = crearControladorConsulta(servicioInterprete);
  const obras = crearControladorObras(servicioObras);

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

  rutas.get("/obras", obras.listar);
  rutas.post("/obras", validar(esquemaObraGuardada), obras.crear);
  rutas.get("/obras/:id", obras.obtener);
  rutas.put("/obras/:id", validar(esquemaObraGuardada), obras.actualizar);
  rutas.delete("/obras/:id", obras.eliminar);

  return rutas;
}
