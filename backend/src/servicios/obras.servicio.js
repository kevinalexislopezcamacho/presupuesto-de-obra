/**
 * Obras terminadas ("Mis obras"): se guardan con sus datos y un resumen calculado en el servidor,
 * para que el total, los días que faltan y el avance siempre salgan de los mismos cálculos.
 */
import { randomUUID } from "node:crypto";
import { noEncontrado } from "../utilidades/error-http.js";
import { limpiarObra } from "./obra-entrada.js";
import { resumirObra } from "./calculo.servicio.js";

/** Vista corta para listas: sin los datos completos. */
const aResumen = ({ datos, ...resto }) => ({ ...resto, ejecucion: datos.ejecucion, tiempo: datos.tiempo || null });

export class ServicioObras {
  /** @param {import("../repositorios/obras.repositorio.js").RepositorioObras} repositorio */
  constructor(repositorio) {
    this.repositorio = repositorio;
  }

  async listar() {
    const obras = await this.repositorio.listar();
    return obras.sort((a, b) => String(b.actualizada).localeCompare(String(a.actualizada))).map(aResumen);
  }

  async obtener(id) {
    const obra = await this.repositorio.obtener(id);
    if (!obra) throw noEncontrado("No existe una obra con ese identificador.");
    return obra;
  }

  async crear({ nombre, datos }) {
    const ahora = new Date().toISOString();
    const limpios = limpiarObra(datos);
    return this.repositorio.guardar({
      id: randomUUID(), nombre, creada: ahora, actualizada: ahora, datos: limpios, resumen: resumirObra(limpios)
    });
  }

  async actualizar(id, { nombre, datos }) {
    const anterior = await this.obtener(id);
    const limpios = limpiarObra(datos);
    return this.repositorio.guardar({
      ...anterior, nombre, actualizada: new Date().toISOString(), datos: limpios, resumen: resumirObra(limpios)
    });
  }

  async eliminar(id) {
    if (!(await this.repositorio.eliminar(id))) throw noEncontrado("No existe una obra con ese identificador.");
  }
}
