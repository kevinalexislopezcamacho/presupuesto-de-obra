/**
 * Presupuesto en Excel (.xlsx) con el formato de un presupuesto de obra: capítulos, ítems numerados,
 * valores parciales y subtotales con fórmulas, AIU, APU de cada ítem, memoria de cantidades,
 * lista de compras y cronograma.
 */
import ExcelJS from "exceljs";
import { INSUMOS, FECHA_PRECIOS } from "../datos/precios.js";
import { calcularObra } from "./calculo.servicio.js";
import { limpiarObra } from "./obra-entrada.js";

const PESOS = '"$" #,##0';
const NUMERO = "#,##0.00";
const GRIS = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EEE5" } };
const BORDE = { top: { style: "thin", color: { argb: "FFD9D0C1" } }, bottom: { style: "thin", color: { argb: "FFD9D0C1" } } };

function encabezado(hoja, titulo, nombre, obra) {
  hoja.addRow([titulo]).font = { bold: true, size: 14 };
  hoja.addRow(["Proyecto", nombre]);
  hoja.addRow(["Fecha", new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })]);
  hoja.addRow(["Precios de referencia", `Cali, consultados el ${FECHA_PRECIOS}; ítems oficiales: Gobernación del Valle 2024`]);
  hoja.addRow(["Valor", obra.ejecucion === "contratista" ? "Con AIU (la ejecuta un contratista)" : "Costo directo, sin AIU"]);
  for (let i = 2; i <= 5; i++) hoja.getRow(i).getCell(1).font = { bold: true, color: { argb: "FF71675A" } };
  hoja.addRow([]);
}

function filaTitulos(hoja, titulos) {
  const fila = hoja.addRow(titulos);
  fila.font = { bold: true };
  fila.eachCell(c => { c.fill = GRIS; c.border = BORDE; });
  return fila;
}

/**
 * @param {object} entrada datos de la obra
 * @param {string} nombre nombre del proyecto
 * @returns {Promise<Buffer>} el archivo .xlsx
 */
export async function presupuestoExcel(entrada, nombre = "Obra") {
  const obra = limpiarObra(entrada), c = calcularObra(entrada);
  const libro = new ExcelJS.Workbook();
  libro.creator = "Presupuesto de obra Cali";

  // ---------- Presupuesto ----------
  const hp = libro.addWorksheet("Presupuesto", { views: [{ state: "frozen", ySplit: 7 }] });
  hp.columns = [{ width: 8 }, { width: 58 }, { width: 9 }, { width: 12 }, { width: 16 }, { width: 18 }];
  encabezado(hp, "PRESUPUESTO DE OBRA", nombre, obra);
  filaTitulos(hp, ["Ítem", "Descripción", "Unidad", "Cantidad", "Valor unitario", "Valor parcial"]);
  const subtotales = [];
  const capitulos = [...new Map(c.lineas.map(l => [l.capitulo.numero, l.capitulo])).values()];
  for (const cap of capitulos) {
    const titulo = hp.addRow([String(cap.numero), cap.nombre.toUpperCase()]);
    titulo.font = { bold: true };
    const desde = hp.rowCount + 1;
    for (const l of c.lineas.filter(x => x.capitulo.numero === cap.numero)) {
      const fila = hp.addRow([l.item, l.nombre + (l.precioPropio || l.composicion.cotizacion ? " (precio cotizado)" : ""), l.unidad, l.cantidad, Math.round(l.unitario)]);
      fila.getCell(6).value = { formula: `D${fila.number}*E${fila.number}`, result: Math.round(l.cantidad * l.unitario) };
      fila.getCell(4).numFmt = NUMERO; fila.getCell(5).numFmt = PESOS; fila.getCell(6).numFmt = PESOS;
    }
    const hasta = hp.rowCount;
    const sub = hp.addRow(["", `Subtotal capítulo ${cap.numero}`]);
    sub.getCell(6).value = { formula: `SUM(F${desde}:F${hasta})` };
    sub.getCell(6).numFmt = PESOS; sub.font = { bold: true };
    subtotales.push(`F${sub.number}`);
  }
  hp.addRow([]);
  const directo = hp.addRow(["", "COSTO DIRECTO"]);
  directo.getCell(6).value = { formula: subtotales.join("+") || "0" };
  directo.getCell(6).numFmt = PESOS; directo.font = { bold: true };
  let totalFormula = `F${directo.number}`;
  if (obra.ejecucion === "contratista") {
    const pct = (etiqueta, valor, base) => {
      const f = hp.addRow(["", etiqueta, "", valor]);
      f.getCell(4).numFmt = "0.00%";
      f.getCell(6).value = { formula: `${base}*D${f.number}` }; f.getCell(6).numFmt = PESOS;
      return f.number;
    };
    const a = pct("Administración", obra.aiu.a, `F${directo.number}`);
    const i = pct("Imprevistos", obra.aiu.i, `F${directo.number}`);
    const u = pct("Utilidad", obra.aiu.u, `F${directo.number}`);
    const iva = pct("IVA sobre la utilidad", obra.aiu.iva, `F${u}`);
    totalFormula = `F${directo.number}+F${a}+F${i}+F${u}+F${iva}`;
  }
  const total = hp.addRow(["", obra.ejecucion === "contratista" ? "VALOR TOTAL CON AIU" : "VALOR TOTAL"]);
  total.getCell(6).value = { formula: totalFormula, result: Math.round(c.presupuesto.total) };
  total.getCell(6).numFmt = PESOS; total.font = { bold: true, size: 12 };
  hp.addRow([]);
  if (c.presupuesto.rango) {
    // Rango: si las actividades que se alejan de su referencia oficial equivalente costaran lo oficial.
    const r = hp.addRow(["", `Rango: si ${c.presupuesto.rango.actividades.length} actividades costaran lo de su referencia oficial, el total sería`, "", "", "", Math.round(c.presupuesto.rango.total)]);
    r.getCell(6).numFmt = PESOS; r.font = { italic: true };
  }
  hp.addRow(["", "Valores en pesos colombianos. Mano de obra con prestaciones sociales 2026. Precios de referencia: confirme con cotizaciones antes de contratar."]).font = { italic: true, color: { argb: "FF71675A" } };

  // ---------- APU ----------
  const ha = libro.addWorksheet("APU");
  ha.columns = [{ width: 44 }, { width: 9 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 40 }];
  encabezado(ha, "ANÁLISIS DE PRECIOS UNITARIOS", nombre, obra);
  for (const l of c.lineas) {
    ha.addRow([`${l.item}  ${l.codigo} · ${l.nombre}`, `por ${l.unidad}`]).font = { bold: true };
    const comp = l.composicion;
    if (comp.oficial) {
      const f = ha.addRow([`Precio oficial: ${comp.oficial.fuente}, ítem ${comp.oficial.item}`, "", "", "", comp.oficial.precio, "La entidad no publica la composición"]);
      f.getCell(5).numFmt = PESOS;
    } else if (comp.cotizacion) {
      const f = ha.addRow([`Precio cotizado${comp.cotizacion.fuente ? `: ${comp.cotizacion.fuente}` : ""}`, "", "", "", comp.cotizacion.precio, "No está en la base de la herramienta: se usa la cotización"]);
      f.getCell(5).numFmt = PESOS;
    } else {
      filaTitulos(ha, ["Insumo", "Unidad", "Cantidad", "Precio", "Parcial", "Fuente"]);
      const desde = ha.rowCount + 1;
      for (const x of comp.insumos) {
        const ins = INSUMOS[x.id];
        const f = ha.addRow([ins.nombre, ins.unidad, x.cantidad, Math.round(x.precio), null, x.propio ? "Cotización" : `${ins.fuente} (${ins.fecha})`]);
        f.getCell(5).value = { formula: `C${f.number}*D${f.number}` };
        f.getCell(3).numFmt = "0.0###"; f.getCell(4).numFmt = PESOS; f.getCell(5).numFmt = PESOS;
      }
      const hasta = ha.rowCount;
      const h = ha.addRow(["Herramienta menor (5 % de la mano de obra)", "", "", "", Math.round(comp.herramienta)]);
      h.getCell(5).numFmt = PESOS;
      const t = ha.addRow(["Costo unitario", "", "", "", null, comp.cuadrilla ? `Rendimiento ${l.rendimiento} ${l.unidad}/día; cuadrilla ${comp.cuadrilla.oficiales} oficial + ${comp.cuadrilla.ayudantes} ayudante(s)` : ""]);
      t.getCell(5).value = { formula: `SUM(E${desde}:E${hasta})+E${h.number}` };
      t.getCell(5).numFmt = PESOS; t.font = { bold: true };
    }
    if (l.precioPropio) ha.addRow([`En el presupuesto se usa el precio cotizado: $ ${Math.round(l.unitario).toLocaleString("es-CO")} por ${l.unidad}`]).font = { italic: true };
    ha.addRow([]);
  }

  // ---------- Memoria de cantidades ----------
  const hm = libro.addWorksheet("Memoria de cantidades");
  hm.columns = [{ width: 8 }, { width: 40 }, { width: 30 }, { width: 70 }, { width: 12 }, { width: 8 }];
  encabezado(hm, "MEMORIA DE CANTIDADES", nombre, obra);
  filaTitulos(hm, ["Ítem", "Actividad", "Parte de la obra", "Cálculo", "Cantidad", "Unidad"]);
  for (const l of c.lineas) for (const m of l.memoria) {
    const f = hm.addRow([l.item, l.nombre, m.parte || "", m.texto, m.cantidad, l.unidad]);
    f.getCell(5).numFmt = NUMERO;
  }

  // ---------- Compras ----------
  const hc = libro.addWorksheet("Compras");
  hc.columns = [{ width: 40 }, { width: 12 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 30 }];
  encabezado(hc, "LISTA DE COMPRAS", nombre, obra);
  filaTitulos(hc, ["Material", "Cantidad", "Unidad", "Costo aprox.", "Estado", "Dónde"]);
  for (const x of c.compras) {
    const ins = INSUMOS[x.id];
    const f = hc.addRow([ins.nombre, x.cantidad, ins.unidad, Math.round(x.costo), x.comprado ? "Comprado" : "Por comprar", ins.tienda || ""]);
    f.getCell(4).numFmt = PESOS;
  }

  // ---------- Cronograma ----------
  const hk = libro.addWorksheet("Cronograma");
  hk.columns = [{ width: 44 }, { width: 28 }, { width: 14 }, { width: 14 }];
  encabezado(hk, "CRONOGRAMA (días hábiles desde el inicio)", nombre, obra);
  filaTitulos(hk, ["Actividad", "Fase", "Empieza (día)", "Duración (días)"]);
  const porCodigo = new Map(c.lineas.map(l => [l.codigo, l]));
  for (const t of c.cronograma.tramos) {
    const l = porCodigo.get(t.codigo);
    hk.addRow([l.nombre, l.fase, t.inicio + 1, t.dias]);
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}
