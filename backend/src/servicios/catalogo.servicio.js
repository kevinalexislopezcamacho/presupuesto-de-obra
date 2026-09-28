/**
 * Catálogo: datos de referencia que el cliente necesita para dibujar formularios y textos
 * (tipos de obra, insumos, APU con su costo, reemplazos posibles, tiendas y fuentes).
 * Se calcula una sola vez: los datos no cambian mientras el servidor está encendido.
 */
import { APU } from "../datos/apu.js";
import {
  INSUMOS, FECHA_PRECIOS, SMMLV_2026, SALARIO_OFICIAL, FACTOR_PRESTACIONAL, HORAS_MES, AUX_TRANSPORTE_2026, HERRAMIENTA_MENOR
} from "../datos/precios.js";
import { REFERENCIAS_OFICIALES } from "../datos/referencias-oficiales.js";
import { ALTERNATIVAS, CONVERSIONES } from "../datos/materiales.js";
import { TIENDAS_CALI } from "../datos/tiendas.js";
import { TIPOS, TIPOS_OBRA, NOMBRES_TIPO } from "../datos/tipos-obra.js";
import { AIU_CALI_2026 } from "../dominio/presupuesto.js";
import { analizarAPU, cuadrilla } from "../dominio/apu.js";
import { actividadesDelTipo } from "../dominio/actividades.js";
import { FASES, ordenFase } from "../dominio/cronograma.js";
import { UNIDADES_COTIZADO } from "./obra-entrada.js";
import { HUECOS_TIPICOS, HUECO_TIPICO } from "../dominio/huecos.js";
import { LIMITE_REFERENCIA } from "../datos/referencias-oficiales.js";
import { CAPITULOS } from "../datos/capitulos.js";
import { DEMOLICIONES } from "../dominio/actividades.js";
import { fuenteOficial } from "./listas-oficiales.servicio.js";

// Actividades de cada tipo en el orden en que se construyen (para mostrar qué incluye y poder quitar alguna).
const actividadesOrdenadas = tipo => actividadesDelTipo(tipo).map(codigo => ({ codigo })).sort(ordenFase).map(l => l.codigo);

let catalogo = null;

/** @returns {object} catálogo completo (se arma la primera vez y luego se reutiliza) */
export function obtenerCatalogo() {
  if (catalogo) return catalogo;
  catalogo = {
    fechaPrecios: FECHA_PRECIOS,
    tiposObra: TIPOS_OBRA,
    tipos: Object.fromEntries(TIPOS_OBRA.map(t => [t, { ...TIPOS[t], actividades: actividadesOrdenadas(t) }])),
    nombresTipo: NOMBRES_TIPO,
    insumos: INSUMOS,
    apu: APU.map(a => {
      const analisis = analizarAPU(a, INSUMOS);
      return {
        codigo: a.codigo, nombre: a.nombre, corto: a.corto, unidad: a.unidad, categoria: a.categoria, rendimiento: a.rendimiento,
        cuadrilla: a.insumos.length ? cuadrilla(a) : null, oficial: a.oficial || null, unitario: analisis.unitario, herramienta: analisis.herramienta,
        insumos: analisis.lineas.map(l => ({ id: l.id, cantidad: l.cantidad, parcial: l.parcial }))
      };
    }),
    alternativas: ALTERNATIVAS,
    conversiones: CONVERSIONES,
    tiendas: TIENDAS_CALI,
    fases: FASES.map(f => f.nombre),
    aiuPorDefecto: AIU_CALI_2026,
    manoDeObra: {
      smmlv: SMMLV_2026, salarioOficial: SALARIO_OFICIAL, factorPrestacional: FACTOR_PRESTACIONAL,
      horasMes: HORAS_MES, auxilioTransporte: AUX_TRANSPORTE_2026, herramientaMenor: HERRAMIENTA_MENOR
    },
    referenciasOficiales: REFERENCIAS_OFICIALES,
    capitulos: CAPITULOS.map(({ numero, nombre }) => ({ numero, nombre })),
    demoliciones: Object.values(DEMOLICIONES),       // se agregan a una parte marcada como remodelación
    listaOficial: fuenteOficial(),
    // Puertas y ventanas: las típicas de cada tipo de obra (de ahí se parte al detallarlas) y las medidas típicas.
    huecos: { tipicos: HUECOS_TIPICOS, medidas: HUECO_TIPICO },
    unidadesCotizado: UNIDADES_COTIZADO,
    limiteReferencia: LIMITE_REFERENCIA      // diferencia con la referencia oficial equivalente que se marca
  };
  return catalogo;
}
