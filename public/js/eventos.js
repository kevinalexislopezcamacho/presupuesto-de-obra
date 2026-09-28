/**
 * Eventos de la interfaz. Cada botón declara qué hace con un atributo data-*;
 * aquí se traduce ese atributo en un cambio del estado.
 */
import * as api from "./api/cliente.js";
import { estado, PANTALLA, reiniciarObra, nuevoElemento } from "./estado/estado.js";
import { nombreCortoApu } from "./estado/catalogo.js";
import { historial, guardarObraActual, abrirObra, borrarObra } from "./estado/historial.js";
import {
  aplicarInterpretacion, resolverDuda, cambiarMaterial, deshacerCambio, agregarMateriales, quitarMaterial,
  dejarAparte, convertirCantidad, agregarElemento, alternarActividad, alternarRemodelacion, agregarTrabajo, ponerPrecio, marcar,
  agregarHueco, quitarHueco, cambiarHueco, faltaEnCotizado, agregarCotizado, cambiarCotizado, agregarRapido
} from "./acciones/obra.js";
import { descargarExcel, imprimirPresupuesto, descargarTiempos } from "./acciones/exportar.js";
import { textoPresupuesto, textoCompras } from "./acciones/exportar.js";
import { copiar } from "./utilidades/navegador.js";
import { esISO } from "./utilidades/fechas.js";
import { cambiarTema } from "./utilidades/tema.js";
import { actualizar, render, avisoBreve } from "./render.js";
import { FRASES_EJEMPLO } from "./vistas/obra.js";
import { nombrePorDefecto } from "./vistas/comunes.js";

const $ = selector => document.querySelector(selector);
const obra = cambio => actualizar(cambio, { calcular: true });   // cambios que afectan el cálculo
const pantalla = cambio => actualizar(cambio);                    // cambios solo de pantalla

const ir = destino => pantalla(() => {
  estado.pantalla = destino;
  estado.confirmarReinicio = false;
  if (destino !== PANTALLA.INICIO) estado.mensaje = "";
});

/** Muestra un mensaje mientras llega una respuesta lenta (la IA puede tardar unos segundos). */
async function esperando(mensaje, tarea) {
  estado.ocupado = mensaje;
  render();
  try { await tarea(); } finally { estado.ocupado = ""; }
}

/** Busca en la lista oficial (o trae más resultados de la misma búsqueda). */
async function buscarOficial(mas = false) {
  const o = estado.oficial;
  if (o.buscando) return;
  o.buscando = true;
  render();
  try {
    if (!o.capitulos) o.capitulos = await api.capitulosOficiales();
    const r = await api.buscarOficial({ q: o.q, capitulo: o.capitulo, desde: mas && o.resultado ? o.resultado.items.length : 0 });
    o.resultado = mas && o.resultado ? { ...r, items: [...o.resultado.items, ...r.items] } : r;
    estado.error = "";
  } catch (e) {
    estado.error = e.message;
  } finally {
    o.buscando = false;
    render();
  }
}

/** Interpreta la descripción; si todo quedó claro pasa a las medidas, si no, pregunta. */
const interpretar = () => {
  const texto = estado.texto.trim();
  if (!texto) return ir(PANTALLA.MEDIDAS);
  if (estado.ocupado) return;
  // Ya se entendió este mismo texto y no quedan dudas (solo cosas que no se calculan): se sigue con eso.
  const previa = estado.interpretacion;
  if (previa?.texto === texto && !previa.res.dudas.length) return ACCIONES["seguir-interpretacion"]();
  return obra(() => esperando("Interpretando la descripción…", async () => {
    const res = await api.interpretarObra(texto);
    estado.interpretacion = { texto, res };
    if (!res.dudas.length && !res.noSoportado.length) {
      aplicarInterpretacion(res);
      estado.abrirCatalogo = !res.partes.length && !res.trabajos.length;
      estado.pantalla = PANTALLA.MEDIDAS;
    }
  }));
};

/* ---------- Botones con data-accion="…" ---------- */
const ACCIONES = {
  nueva: () => pantalla(() => { reiniciarObra(); estado.mensaje = ""; estado.pantalla = PANTALLA.OBRA; }),
  volver: () => ir(estado.volverA),
  "agregar-rapido": () => (estado.ocupado ? undefined : obra(() => esperando("Agregando…", agregarRapido))),
  "agregar-cotizado": () => {
    const falta = faltaEnCotizado();
    if (falta) return pantalla(() => { estado.nuevoCotizado.error = falta; });
    return obra(() => agregarCotizado());
  },
  "ver-presupuesto": () => { estado.tab = "presupuesto"; return ir(PANTALLA.RESULTADO); },
  // El AIU se suma si la obra la ejecuta un contratista.
  "alternar-aiu": () => obra(() => { estado.ejecucion = estado.ejecucion === "contratista" ? "directo" : "contratista"; }),
  interpretar,
  "seguir-interpretacion": () => obra(() => { aplicarInterpretacion(estado.interpretacion.res); estado.pantalla = PANTALLA.MEDIDAS; }),
  "agregar-materiales": () => (estado.ocupado ? undefined : obra(() => esperando("Leyendo los materiales…", agregarMateriales))),
  "copiar-presupuesto": () => copiar(textoPresupuesto()).then(ok => avisoBreve(ok ? "Tabla copiada: se puede pegar en Excel." : "No se pudo copiar.")),
  "copiar-compras": () => copiar(textoCompras()).then(ok => avisoBreve(ok ? "Lista de compras copiada." : "No se pudo copiar.")),
  "buscar-oficial": () => buscarOficial(),
  "mas-oficial": () => buscarOficial(true),
  "descargar-excel": boton => {
    boton.disabled = true;
    return descargarExcel().then(() => avisoBreve("Excel descargado."), e => avisoBreve(e.message)).finally(() => { boton.disabled = false; });
  },
  "descargar-pdf": () => imprimirPresupuesto(),
  "descargar-tiempos": () => descargarTiempos(historial.lista),
  reiniciar: () => pantalla(() => { estado.confirmarReinicio = true; }),
  "reiniciar-no": () => pantalla(() => { estado.confirmarReinicio = false; }),
  "reiniciar-si": () => pantalla(() => { reiniciarObra(); estado.pantalla = PANTALLA.INICIO; estado.mensaje = ""; }),
  terminar: boton => {
    boton.disabled = true;
    return pantalla(() => guardarObraActual((estado.nombreObra || "").trim() || nombrePorDefecto()));
  }
};

/* ---------- Botones con otros data-* (el orden importa: gana el primero que exista) ---------- */
const CLICS = [
  ["accion", (valor, _ds, boton) => ACCIONES[valor]?.(boton)],
  ["ir", valor => ir(valor)],
  ["vista", valor => {
    pantalla(() => { if (estado.pantalla !== valor) estado.volverA = estado.pantalla; estado.pantalla = valor; });
    if (valor === PANTALLA.OFICIAL && !estado.oficial.capitulos) buscarOficial();
  }],
  ["sugerenciaOficial", valor => { estado.oficial.q = valor; return buscarOficial(); }],
  ["agregarOficial", valor => {
    const campo = $(`#o-${valor}`), cantidad = parseFloat(campo.value);
    if (!(cantidad > 0)) return campo.focus();
    return obra(() => agregarTrabajo(`GOB-${valor}`, cantidad)).then(() => avisoBreve(`Ítem ${valor} agregado al presupuesto.`));
  }],
  ["remodelacion", valor => obra(() => alternarRemodelacion(valor))],
  ["linea", valor => pantalla(() => { estado.lineaAbierta = estado.lineaAbierta === valor ? null : valor; })],
  ["ejemplo", valor => { estado.texto = FRASES_EJEMPLO[Number(valor)]; return interpretar(); }],
  ["tipo", valor => obra(() => {
    Object.assign(estado, { texto: "", interpretacion: null, extras: [], hechas: [], comprados: [], abrirCatalogo: valor === "libre", pantalla: PANTALLA.MEDIDAS });
    estado.elementos = valor === "libre" ? [] : [nuevoElemento(valor)];
  })],
  ["duda", (valor, ds) => obra(async () => {
    await resolverDuda(Number(valor), ds.dudaTipo);
    const res = estado.interpretacion.res;
    if (!res.dudas.length && !res.noSoportado.length) { aplicarInterpretacion(res); estado.pantalla = PANTALLA.MEDIDAS; }
  })],
  ["agregarElemento", valor => obra(() => agregarElemento(valor))],
  ["alternar", (valor, ds) => obra(() => alternarActividad(valor, ds.codigo))],
  ["quitarElemento", valor => obra(() => { estado.elementos = estado.elementos.filter(x => x.id !== valor); })],
  ["agregarTrabajo", valor => {
    const campo = $(`#x-${valor}`), cantidad = parseFloat(campo.value);
    if (!(cantidad > 0)) return campo.focus();
    return obra(() => agregarTrabajo(valor, cantidad));
  }],
  ["quitarTrabajo", valor => obra(() => { estado.extras = estado.extras.filter(x => x.codigo !== valor); })],
  ["agregarHueco", valor => obra(() => agregarHueco(valor))],
  ["quitarHueco", (valor, ds) => obra(() => quitarHueco(valor, Number(ds.indice)))],
  ["quitarCotizado", valor => obra(() => { estado.cotizados = estado.cotizados.filter(x => x.id !== valor); })],
  ["quitarAdicional", valor => obra(() => { delete estado.comprasAdicionales[valor]; })],
  ["materiales", valor => pantalla(() => { estado.pantalla = PANTALLA.MATERIALES; estado.pasoMateriales = valor; })],
  ["quitarMaterial", valor => obra(() => quitarMaterial(valor))],
  ["aparte", valor => pantalla(() => dejarAparte(valor))],
  ["cambiarDe", (valor, ds) => obra(() => cambiarMaterial(valor, ds.cambiarA))],
  ["deshacer", valor => obra(() => deshacerCambio(valor))],
  ["convertir", valor => obra(() => convertirCantidad(valor))],
  ["irCatalogo", valor => pantalla(() => { estado.busqueda = nombreCortoApu(valor); estado.abrirCatalogo = true; estado.pantalla = PANTALLA.MEDIDAS; })],
  ["modoFaltan", valor => pantalla(() => {
    estado.modoFaltan = valor;
    if (valor === "tengo") estado.faltanVista = estado.calculo.materiales.items.filter(i => i.falta > 1e-9).map(i => i.id);
  })],
  ["tab", valor => pantalla(() => { estado.tab = valor; })],
  ["usarReferencia", (valor, ds) => obra(() => ponerPrecio("preciosActividad", valor, Number(ds.valor)))],
  ["quitarPrecio", valor => obra(() => ponerPrecio("precios", valor, 0))],
  ["quitarPrecioActividad", valor => obra(() => ponerPrecio("preciosActividad", valor, 0))],
  ["tema", () => cambiarTema()],
  ["abrir", valor => obra(() => abrirObra(valor))],
  ["borrar", valor => { historial.borrar = valor; render(); }],
  ["borrarNo", () => { historial.borrar = null; render(); }],
  ["borrarSi", valor => pantalla(() => borrarObra(valor))]
];

/* ---------- Campos que cambian (data-* en inputs, selects y casillas) ---------- */
const numero = v => parseFloat(v);
const CAMBIOS = [
  ["medida", (campo, ds) => obra(() => {
    const el = estado.elementos.find(e => e.id === ds.el);
    if (!el) return;
    el.medidas[ds.medida] = ds.medida === "sistema" ? campo.value : numero(campo.value);
    el.estimadas = el.estimadas.filter(k => k !== ds.medida);
    el.porDefecto = el.porDefecto.filter(k => k !== ds.medida);
    if (ds.medida === "sistema") estado.cambiosMat = estado.cambiosMat.filter(c => !c.sistema);
  })],
  ["cantidadElemento", (campo, ds) => obra(() => {
    const el = estado.elementos.find(e => e.id === ds.cantidadElemento);
    if (el) el.cantidad = Math.max(1, Math.round(numero(campo.value) || 1));
  })],
  ["hueco", (campo, ds) => obra(() => cambiarHueco(ds.hueco, Number(ds.indice), ds.campo, campo.value))],
  ["cotizado", (campo, ds) => obra(() => cambiarCotizado(ds.cotizado, ds.campo, campo.value))],
  ["extra", (campo, ds) => obra(() => {
    const x = estado.extras.find(y => y.codigo === ds.extra);
    if (x) x.cantidad = Math.max(0, numero(campo.value) || 0);
  })],
  ["tengo", (campo, ds) => obra(() => {
    const v = numero(campo.value);
    if (v > 0) estado.disponibles[ds.tengo] = v; else delete estado.disponibles[ds.tengo];
  })],
  ["hecha", (campo, ds) => obra(() => marcar("hechas", ds.hecha, campo.checked))],
  ["comprado", (campo, ds) => obra(() => marcar("comprados", ds.comprado, campo.checked))],
  ["precio", (campo, ds) => obra(() => ponerPrecio("precios", ds.precio, numero(campo.value)))],
  ["precioActividad", (campo, ds) => obra(() => ponerPrecio("preciosActividad", ds.precioActividad, numero(campo.value)))],
  ["oficialCapitulo", campo => { estado.oficial.capitulo = campo.value; buscarOficial(); }],
  ["inicio", campo => { if (esISO(campo.value)) pantalla(() => { estado.inicioObra = campo.value; }); }],
  ["conAiu", campo => obra(() => { estado.ejecucion = campo.checked ? "contratista" : "directo"; })],
  ["aiu", (campo, ds) => {
    const v = numero(campo.value);
    if (v >= 0 && v <= 100) obra(() => { estado.aiu[ds.aiu] = v / 100; });
  }]
];

/* ---------- Mientras se escribe (sin volver a dibujar, salvo la búsqueda) ---------- */
const ESCRITURA = {
  "texto-obra": v => { estado.texto = v; },
  "texto-materiales": v => { estado.textoMateriales = v; },
  "nombre-obra": v => { estado.nombreObra = v; },
  "oficial-q": v => { estado.oficial.q = v; },
  rapido: v => { estado.textoRapido = v; },
  "cot-nombre": v => { estado.nuevoCotizado.nombre = v; },
  "cot-unidad": v => { estado.nuevoCotizado.unidad = v; },
  "cot-cantidad": v => { estado.nuevoCotizado.cantidad = v; },
  "cot-precio": v => { estado.nuevoCotizado.precio = v; },
  "cot-fuente": v => { estado.nuevoCotizado.fuente = v; },
  busqueda: v => { estado.busqueda = v; render(); }
};

export function registrarEventos() {
  document.addEventListener("click", e => {
    const boton = e.target.closest("button");
    if (!boton || boton.disabled) return;
    const ds = boton.dataset;
    const clic = CLICS.find(([clave]) => ds[clave] !== undefined);
    if (clic) clic[1](ds[clic[0]], ds, boton);
  });

  document.addEventListener("change", e => {
    const ds = e.target.dataset;
    const cambio = CAMBIOS.find(([clave]) => ds[clave] !== undefined);
    if (cambio) cambio[1](e.target, ds);
  });

  document.addEventListener("input", e => ESCRITURA[e.target.id]?.(e.target.value));

  // Recordar si el catálogo de trabajos está abierto al volver a dibujar.
  document.addEventListener("toggle", e => { if (e.target.id === "det-cat") estado.abrirCatalogo = e.target.open; }, true);

  // Enter: interpreta la descripción, agrega materiales o agrega un trabajo del catálogo.
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const id = e.target.id || "";
    if (id === "texto-obra") { e.preventDefault(); interpretar(); }
    else if (id === "texto-materiales") { e.preventDefault(); ACCIONES["agregar-materiales"](); }
    else if (id === "oficial-q") { e.preventDefault(); buscarOficial(); }
    else if (id.startsWith("cot-")) { e.preventDefault(); ACCIONES["agregar-cotizado"](); }
    else if (id === "rapido") { e.preventDefault(); ACCIONES["agregar-rapido"](); }
    else if (id.startsWith("o-")) $(`[data-agregar-oficial="${id.slice(2)}"]`)?.click();
    else if (id.startsWith("x-")) $(`[data-agregar-trabajo="${id.slice(2)}"]`)?.click();
  });
}

