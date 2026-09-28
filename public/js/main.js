/**
 * Punto de entrada del frontend: carga el catálogo, recupera el borrador,
 * registra los eventos y dibuja la primera pantalla.
 */
import * as api from "./api/cliente.js";
import { cargarCatalogo, catalogo } from "./estado/catalogo.js";
import { estado, reiniciarObra, cargarBorrador } from "./estado/estado.js";
import { cargarHistorial } from "./estado/historial.js";
import { registrarEventos } from "./eventos.js";
import { render, recalcular, USAN_CALCULO } from "./render.js";
import { esc } from "./utilidades/formato.js";
import { EJEMPLO_INICIO } from "./vistas/inicio.js";
import { aplicarTema } from "./utilidades/tema.js";
import { iniciarCronometro } from "./utilidades/cronometro.js";

/** Pie de página con la fecha de los precios y el estado de la base y del modelo. */
function escribirPie() {
  const d = estado.diagnostico;
  const partes = [`Precios de Cali consultados el ${catalogo.fechaPrecios}.`];
  if (d) {
    partes.push(`Base: ${d.base.apu} APU y ${d.base.insumos} insumos, ${d.base.errores.length ? `${d.base.errores.length} errores` : "sin errores"}.`);
    partes.push(`Modelo de texto: ${Math.round(d.modelo.exactitud * 100)} % de exactitud en validación cruzada.`);
    partes.push(d.ia?.activa ? `IA: ${d.ia.proveedor} (${d.ia.modelo}), verificada por la herramienta.` : "IA desactivada: se entiende el texto con reglas.");
  }
  document.querySelector("#pie").textContent = partes.join(" ");
}

async function cargarDiagnostico() {
  try { estado.diagnostico = await api.obtenerDiagnostico(); } catch { /* es informativo: la app funciona sin él */ }
  escribirPie();
}

async function iniciar() {
  aplicarTema();
  try {
    await cargarCatalogo();
  } catch (e) {
    document.querySelector("#app").innerHTML = `<div class="aviso no" role="alert"><strong>No se pudo iniciar.</strong>${esc(e.message)}</div>`;
    return;
  }
  reiniciarObra();
  cargarBorrador();
  registrarEventos();
  iniciarCronometro();
  escribirPie();
  render();

  const tareas = [cargarHistorial().catch(e => { estado.error = e.message; }), cargarDiagnostico().then(render),
    // El ejemplo de la portada se calcula con los precios vigentes; si falla, la portada se ve sin él.
    api.calcular(EJEMPLO_INICIO).then(c => { estado.ejemploInicio = c; }).catch(() => {})];
  if (USAN_CALCULO.includes(estado.pantalla)) tareas.push(recalcular());
  await Promise.all(tareas);
  render();
}

iniciar();
