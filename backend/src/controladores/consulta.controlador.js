/**
 * Controladores de consulta, lenguaje natural y cálculo: reciben datos ya validados (req.datos),
 * llaman al servicio y responden JSON. No tienen lógica de negocio.
 * @param {ReturnType<import("../servicios/interprete.servicio.js").crearServicioInterprete>} interprete
 */
import { obtenerCatalogo } from "../servicios/catalogo.servicio.js";
import { obtenerDiagnostico } from "../servicios/diagnostico.servicio.js";
import { calcularObra } from "../servicios/calculo.servicio.js";
import { buscarOficial, capitulosOficiales, itemOficial } from "../servicios/listas-oficiales.servicio.js";
import { noEncontrado } from "../utilidades/error-http.js";
import { presupuestoExcel } from "../servicios/exportacion.servicio.js";

export const crearControladorConsulta = interprete => ({
  salud: (_req, res) => res.json({ estado: "ok" }),
  catalogo: (_req, res) => res.json(obtenerCatalogo()),
  diagnostico: (_req, res) => res.json({ ...obtenerDiagnostico(), ia: interprete.estadoIA() }),

  interpretarDescripcion: async (req, res) => res.json(await interprete.interpretarObra(req.datos.texto)),
  interpretarMedidas: async (req, res) => res.json(await interprete.leerMedidas(req.datos.texto, req.datos.tipo)),
  interpretarMateriales: async (req, res) => res.json(await interprete.leerMateriales(req.datos.texto, req.datos.obra)),

  calcular: (req, res) => res.json(calcularObra(req.datos.obra)),

  /** Presupuesto en Excel: se descarga con el nombre de la obra. */
  exportarExcel: async (req, res) => {
    const archivo = await presupuestoExcel(req.datos.obra, req.datos.nombre);
    const nombre = (req.datos.nombre || "presupuesto").replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim().slice(0, 60) || "presupuesto";
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", `attachment; filename="Presupuesto.xlsx"; filename*=UTF-8''${encodeURIComponent(nombre)}.xlsx`);
    res.send(archivo);
  },

  buscarOficial: (req, res) => res.json(buscarOficial(req.datos)),
  capitulosOficiales: (_req, res) => res.json(capitulosOficiales()),
  itemOficial: (req, res) => {
    const item = itemOficial(req.params.codigo);
    if (!item) throw noEncontrado("No existe ese ítem en la lista oficial.");
    res.json(item);
  }
});
