import { test } from "node:test";
import assert from "node:assert/strict";
import { predecir } from "../../src/dominio/texto/clasificador.js";
import { MODELO, EVALUACION } from "../../src/dominio/texto/modelo.js";
import { interpretarTexto, extraerMedidas, evaluarInterprete } from "../../src/dominio/texto/interprete.js";

const resumen = r => [...r.partes.map(p => `${p.cantidad} ${p.tipo}`), ...r.trabajos.map(t => t.codigo)].join();

test("modelo: exactitud de al menos 80 % en validación cruzada", () => {
  assert.equal(EVALUACION.pliegues, 5);
  assert.ok(EVALUACION.exactitud >= 0.8, `exactitud ${EVALUACION.exactitud}`);
});

test("modelo: reconoce frases sin palabra clave", () => {
  assert.equal(predecir(MODELO, "me gustaría un mesón con lavaplatos").tipo, "cocina");
  assert.equal(predecir(MODELO, "poner una ducha y un sanitario").tipo, "bano");
});

test("medidas: par, altura, centímetros, sistema y números en palabras", () => {
  assert.deepEqual(extraerMedidas("baño de 2 x 1,5 con muros de 2,4 de alto", "bano").medidas, { largo: 2, ancho: 1.5, alto: 2.4 });
  const muro = extraerMedidas("muro de 300 cm de largo y 2,5 de alto en bloque de concreto", "muro");
  assert.equal(muro.medidas.largo, 3);
  assert.equal(muro.sistema, "concreto");
  assert.equal(extraerMedidas("casa de 8 por 12 con dos baños", "casa").medidas.banos, 2);
});

test("texto: cantidades, varias construcciones y grupos con otras medidas", () => {
  assert.equal(resumen(interpretarTexto("necesito 4 muros de 3 x 2,5")), "4 muro");
  assert.equal(resumen(interpretarTexto("un baño de 2x1,5 y una cocina de 3 por 2,5")), "1 bano,1 cocina");
  const grupos = interpretarTexto("3 muros de 4 x 2,5 en bloque de concreto y 2 de 6 x 2,5");
  assert.equal(grupos.partes[1].cantidad, 2);
  assert.equal(grupos.partes[1].medidas.largo, 6);
  assert.equal(grupos.partes[1].sistema, "concreto");      // el segundo grupo son los mismos muros
});

test("texto: “con un baño” es otra parte, pero la casa incluye sus baños", () => {
  assert.equal(resumen(interpretarTexto("3 habitaciones de 3 x 3,5 con un baño de 2 x 1,5")), "3 cuarto,1 bano");
  const casa = interpretarTexto("una casa de 9 x 7 con 2 baños");
  assert.equal(casa.partes.length, 1);
  assert.equal(casa.partes[0].medidas.banos, 2);
});

test("texto: trabajos sueltos con su cantidad", () => {
  const r = interpretarTexto("pañetar y enchapar un muro de 5 x 2,4");
  assert.equal(r.trabajos.length, 2);
  assert.ok(r.trabajos.every(t => t.cantidad === 12));
});

test("texto: medidas pegadas (12mx15m)", () => {
  const p = interpretarTexto("4 muros de pared de 12mx15m").partes[0];
  assert.equal(p.cantidad, 4);
  assert.deepEqual([p.medidas.largo, p.medidas.alto], [12, 15]);
});

test("texto: columnas grandes explican la cantidad y piden ingeniero", () => {
  const t = interpretarTexto("6 columnas de 15m de alto y 1m de diametro").trabajos[0];
  assert.equal(t.cantidad, 90);
  assert.match(t.detalle, /6 columnas × 15 m/);
  assert.match(t.aviso, /ingeniero/);
});

test("texto: lo que no se calcula no se inventa", () => {
  const r = interpretarTexto("un segundo piso con techo en teja");
  assert.equal(r.partes.length + r.trabajos.length, 0);
  assert.equal(r.noSoportado.length, 2);
});

test("texto: “sin …” quita esa actividad en vez de agregarla", () => {
  const r = interpretarTexto("un baño de 2 x 1,5 sin enchape");
  assert.deepEqual(r.partes[0].excluir, ["ACB-01"]);
  assert.equal(r.trabajos.length, 0);
});

test("texto: remodelar no cobra muros, estructura ni placa; los detalles de la parte no son trabajos aparte", () => {
  const r = interpretarTexto("remodelar el baño de 2 x 1,5 sin cambiar el piso, con enchape en porcelanato");
  assert.equal(resumen(r), "1 bano");
  for (const c of ["ACB-02", "MAM-01", "CON-05", "CON-03"]) assert.ok(r.partes[0].excluir.includes(c), c);
  assert.ok(!r.partes[0].excluir.includes("ACB-01"));
  assert.deepEqual(r.observaciones.map(o => o.texto).sort(), ["porcelanato", "remodelar"]);
});

test("texto: “los muros ya están” y “piso en cerámica” son detalles de la parte anterior", () => {
  const cocina = interpretarTexto("una cocina de 3 x 2,5, los muros ya están");
  assert.equal(resumen(cocina), "1 cocina");
  assert.ok(cocina.partes[0].excluir.includes("MAM-01") && !cocina.partes[0].excluir.includes("CON-03"));
  assert.equal(resumen(interpretarTexto("un baño sin ventana y piso en cerámica")), "1 bano");
  assert.equal(resumen(interpretarTexto("un baño y pañetar la sala de 20 m2")), "1 bano,PAN-01");
});

test("texto: pregunta cuando no entiende", () => {
  assert.equal(interpretarTexto("algo bonito para el patio").dudas.length, 1);
});

test("intérprete completo: al menos 90 % con frases nuevas", () => {
  const { aciertos, total } = evaluarInterprete();
  assert.ok(aciertos / total >= 0.9, `${aciertos} de ${total}`);
});
