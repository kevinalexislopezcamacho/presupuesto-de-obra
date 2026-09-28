# API

Todas las rutas están bajo `/api` y responden JSON.

Cuando hay un error, la respuesta es `{ "error": { "mensaje": "…" } }` con uno de estos códigos:

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos o JSON mal formado |
| 404 | La ruta o la obra no existen |
| 413 | Cuerpo de la petición demasiado grande |
| 500 | Error inesperado del servidor |

## Consulta

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/api/salud` | `{ "estado": "ok" }` |
| GET | `/api/catalogo` | Tipos de obra con sus medidas, insumos (precio, fuente, enlace), APU con costo unitario, reemplazos posibles, conversiones, tiendas, fases, AIU por defecto, mano de obra y referencias oficiales |
| GET | `/api/diagnostico` | Estado de la base de APU, exactitud del modelo (validación cruzada y matriz de confusión), resultado del intérprete con frases nuevas e `ia: { activa, proveedor, via, modelo, modelos }` (nunca la clave) |

## Lenguaje natural

### POST `/api/interpretaciones/obra`

Entiende la descripción de la obra. Si hay clave de Gemini, la entiende primero la IA y la herramienta verifica la respuesta; si no, o si la IA falla, usa el intérprete por reglas. La respuesta tiene la misma forma en los dos casos.

```json
{ "texto": "4 muros de 3 x 2,5 y un baño de 2 x 1,5 sin enchape, ya tengo 10 bultos de cemento" }
```

Respuesta:

```json
{
  "motor": "ia",
  "proveedor": "Gemini",
  "via": "AI Studio",
  "modelo": "gemini-3.5-flash-lite",
  "partes": [
    { "tipo": "muro", "cantidad": 4, "medidas": { "largo": 3, "alto": 2.5 }, "sistema": null, "excluir": [], "fuente": "la IA", "…": "…" },
    { "tipo": "bano", "cantidad": 1, "medidas": { "largo": 2, "ancho": 1.5 }, "excluir": ["ACB-01"], "…": "…" }
  ],
  "trabajos": [],
  "materiales": [{ "texto": "ya tengo 10 bultos de cemento", "id": "cem", "cantidad": 10, "nota": "" }],
  "observaciones": [],
  "dudas": [],
  "noSoportado": [],
  "verificacion": []
}
```

- `motor`: `"ia"` o `"reglas"`. Si se quiso usar la IA y no se pudo, llega `avisoIA` con la razón.
- `partes[].excluir`: códigos de actividades que la persona pidió quitar ("sin enchape" → `ACB-01`).
- `trabajos`: trabajos sueltos, cada uno con `codigo` y `cantidad`, más `detalle` (la cuenta: "5 × 4 m") y `aviso` cuando aplica (por ejemplo, columnas grandes). La cantidad la calcula la herramienta a partir de las medidas escritas.
- `materiales`: materiales que la descripción dice que ya se tienen, ya en la unidad de cálculo.
- `observaciones`: pedidos que no se pueden aplicar tal cual (`{ texto, nota }`), por ejemplo "con porcelanato".
- `verificacion`: datos que la IA propuso y se descartaron porque no estaban en el texto.
- `dudas`: partes que no entendió, con el `ranking` de tipos más probables.
- `noSoportado`: cosas que la herramienta no calcula, como techos o pintura.

### POST `/api/interpretaciones/medidas`

Lee las medidas de un trozo de texto para un tipo de construcción ya elegido.

```json
{ "texto": "de 3 x 4 con muros de 2,4 de alto", "tipo": "cuarto" }
```

### POST `/api/interpretaciones/materiales`

Lee los materiales que la persona dice tener y los convierte a la unidad de cálculo. El campo `obra` es opcional: si se envía, sirve para elegir entre materiales parecidos (por ejemplo, "bloques" sin decir de qué tipo). También usa la IA si está configurada.

```json
{ "texto": "20 bultos de cemento, 1.500 ladrillos, una volqueta de arena y 10 varillas de 1/2", "obra": { "elementos": [{ "tipo": "muro" }] } }
```

Respuesta:

```json
{
  "motor": "reglas",
  "materiales": [
    { "texto": "20 bultos de cemento", "id": "cem", "cantidad": 20, "nota": "" },
    { "texto": "1.500 ladrillos", "id": "blq", "cantidad": 1500, "nota": "" },
    { "texto": "una volqueta de arena", "id": "are", "cantidad": null, "nota": "Escribiste 1 volqueta, pero no sé cuántos m³ son: escribe la cantidad en m³." },
    { "texto": "10 varillas de 1/2", "id": "acr", "cantidad": 59.6, "nota": "10 varillas de 1/2\" × 6 m ≈ 59,6 kg" }
  ],
  "verificacion": []
}
```

- `texto` es lo que escribió la persona, tal cual.
- El punto separa miles ("1.500" = 1500) y la coma, decimales ("2,5").
- Si una cantidad no se puede pasar con seguridad a la unidad del insumo (una volqueta, varillas sin calibre), llega `cantidad: null` con una `nota` que pide el dato: nunca se inventa.

## Cálculo

### POST `/api/calculos`

Calcula todo a partir de los datos de la obra, sin guardar nada.

```json
{
  "obra": {
    "elementos": [{ "id": "e1", "tipo": "bano", "cantidad": 1, "medidas": { "largo": 2, "ancho": 1.5, "alto": 2.4, "sistema": "arcilla" }, "excluir": ["ACB-01"] }],
    "extras": [{ "codigo": "PAN-01", "cantidad": 20 }],
    "disponibles": { "cem": 10 },
    "comprados": ["cpa"],
    "hechas": ["CON-05"],
    "reemplazos": {},
    "ejecucion": "contratista",
    "aiu": { "a": 0.2909, "i": 0.01, "u": 0.05, "iva": 0.19 },
    "precios": { "cem": 31000 },
    "preciosActividad": { "CON-05": 45000 }
  }
}
```

Todos los campos de `obra` son opcionales. Lo que no se reconoce se descarta.

- `elementos[].excluir`: actividades que no se calculan en esa parte. Quitar un muro quita el de arcilla y el de concreto.
- `elementos[].remodelacion`: `true` si el espacio ya existe; se agregan la demolición del enchape (DEM-01) y del piso (DEM-02) que se cambian.
- `elementos[].huecos`: puertas y ventanas con su forma, `[{ "tipo": "puerta", "forma": "arco", "ancho": 1, "alto": 2.1, "diametro": null, "cantidad": 1 }]`. `tipo`: `puerta` o `ventana`; `forma`: `rectangular` (ancho × alto), `arco` (de medio punto; `alto` es el alto total) o `circular` (`diametro`). Si hay huecos, su área reemplaza la de las puertas y ventanas típicas (o `medidas.vanos` en un muro) y se descuenta del bloque, el pañete y el enchape. Una medida que falta toma el valor típico y queda en `porDefecto`.
- `cotizados`: lo que no está en la base ni en la lista oficial, con el precio de una cotización: `[{ "id": "c1", "nombre": "Puerta en arco en madera", "unidad": "und", "cantidad": 1, "precio": 1200000, "fuente": "Carpintería El Roble" }]`. Unidades: und, m, m², m³, gl, kg, día, mes, viaje. Van al capítulo "Ítems cotizados" con el código `COT-<id>` y no se programan en el cronograma. Los que no tienen nombre, cantidad o precio se descartan.
- `tiempo`: cronómetro para la validación, `{ inicio, fin, ms }` (tiempo activo en milisegundos).
- `precios`: precio de la cotización por insumo, que reemplaza al de referencia en todos los cálculos.
- `preciosActividad`: precio cotizado por unidad de una actividad completa, que reemplaza al calculado con el APU.

Respuesta:

| Campo | Contenido |
|---|---|
| `elementos` | Errores y recomendaciones por cada parte de la obra, las actividades que genera y sus puertas y ventanas detalladas con el área de cada una (`huecos[].area`, `areaHuecos`) |
| `lineas` | Actividades en el orden del presupuesto, con `item` ("3.2"), `capitulo` (`{ numero, nombre }`), cantidad, costo unitario (`unitario`), total, rendimiento y fase, `composicion` (el APU: insumos con cantidad, precio y parcial, herramienta menor y cuadrilla; o el precio `oficial`) y `memoria` (de dónde sale la cantidad, por parte de la obra). También traen `unitarioAPU` (lo calculado), `precioPropio` (si se usa una cotización) y `referencias` (precios oficiales con su `diferencia`) |
| `requeridos` | Materiales que necesita la obra |
| `materiales` | Para cada material: lo que necesita, lo que tiene, lo que falta y la cantidad a comprar |
| `recomendaciones` | Opinión sobre cada material que la persona tiene: `usa`, `reemplaza` u `otra-actividad` |
| `compras` | Lista de compras con cantidades, costos y `precioPropio` |
| `precios` | Cada insumo que usa la obra: `precio` en uso, `referencia` y `propio` |
| `presupuesto` | Costo directo, AIU, IVA, total, valor de los materiales propios y lo que falta por invertir |
| `cronograma` | `orden` (actividades en el orden en que se construyen), `tramos` (pendientes con inicio y duración), `avance` y `sinProgramar` (ítems oficiales sin rendimiento publicado) |

### POST `/api/exportaciones/excel`

Descarga el presupuesto en Excel (.xlsx). Cuerpo: `{ "obra": { … }, "nombre": "Baño del patio" }`. Hojas: Presupuesto (capítulos, ítems numerados, valores parciales y subtotales con fórmulas, AIU), APU, Memoria de cantidades, Compras y Cronograma.

## Lista oficial de precios (Gobernación del Valle 2024)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/api/listas-oficiales/gobernacion-2024?q=&capitulo=&unidad=&limite=&desde=` | `{ fuente, documento, url, total, items }`. Cada ítem: `codigo`, `actividad`, `unidad`, `valor`, `verificado`, `capitulo`, `nombreCapitulo`, `pagina` (del PDF) y `unidadDe` (`pdf` o `listado-2019`). Cada palabra de `q` debe ser el comienzo de una palabra del ítem o de su capítulo ("pint" encuentra "pintura"; "arco" no encuentra "marco"; "puertas" encuentra "puerta"). Primero van los que la dicen en su nombre. |
| GET | `/api/listas-oficiales/gobernacion-2024/capitulos` | Capítulos con cuántos ítems tiene cada uno |
| GET | `/api/listas-oficiales/gobernacion-2024/:codigo` | Un ítem (404 si no existe) |

Un ítem oficial se agrega al presupuesto como actividad suelta con el código `GOB-<código>`: `"extras": [{ "codigo": "GOB-290302", "cantidad": 20 }]`. Su costo es el precio oficial y va al último capítulo, "Ítems de la lista oficial".

## Obras guardadas

"Mis obras" se guarda en el navegador de cada dispositivo (almacenamiento local), así que la API no tiene rutas para guardar obras. El resumen de cada una (total, días, avance) sale de `POST /api/calculos`.
