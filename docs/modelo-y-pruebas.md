# Modelo de texto y pruebas

Generado con `npm run docs` desde `backend/src/dominio/texto`.

## Cómo se entiende lo que escribe la persona

1. **Reglas**: separan la frase en partes (“un baño y una cocina”, “… con un baño”) y leen cantidades (“4 muros”) y medidas (“3 x 2,5”, “12mx15m”, “de 10 m”, “70 m2”, “300 cm”).
2. **Palabras clave**: muro, pared, tapia, baño, cocina, habitación, bodega, garaje, casa, apartamento… y trabajos sueltos (pañetar, enchapar, piso, placa, mesón, columnas…).
3. **Naive Bayes multinomial con suavizado de Laplace** para las partes sin palabra clave: raíces de palabras, pares de palabras y trigramas de letras (tolera errores como “cosina”). Si la confianza es menor a 60 %, la herramienta pregunta.

## Evaluación del modelo

- Datos: 150 frases etiquetadas en 5 clases (muro, bano, cocina, cuarto, casa).
- Método: validación cruzada de 5 pliegues (ninguna frase se evalúa con un modelo que la vio).
- **Exactitud: 84,0 %** (126 de 150).

Matriz de confusión (filas = clase real, columnas = predicción):

| | muro | bano | cocina | cuarto | casa |
|---|---:|---:|---:|---:|---:|
| **muro** | 26 | 0 | 3 | 1 | 0 |
| **bano** | 0 | 28 | 0 | 2 | 0 |
| **cocina** | 0 | 0 | 30 | 0 | 0 |
| **cuarto** | 4 | 3 | 1 | 18 | 4 |
| **casa** | 2 | 0 | 2 | 2 | 24 |

### Métricas por clase

| Clase | Precisión | Recall | F1 | Frases |
|---|---:|---:|---:|---:|
| muro | 81,3 % | 86,7 % | 83,9 % | 30 |
| bano | 90,3 % | 93,3 % | 91,8 % | 30 |
| cocina | 83,3 % | 100,0 % | 90,9 % | 30 |
| cuarto | 78,3 % | 60,0 % | 67,9 % | 30 |
| casa | 85,7 % | 80,0 % | 82,8 % | 30 |
| **Promedio macro** | 83,8 % | 84,0 % | 83,5 % | 150 |

### Comparación con modelos simples (líneas base)

| Modelo | Exactitud |
|---|---:|
| Naive Bayes solo (validación cruzada) | 84,0 % |
| Clase más frecuente | 20,0 % (30 de 150) |
| Solo palabras clave | 94,0 % (141 de 150) |
| Palabras clave + Naive Bayes (como funciona la herramienta) | 98,0 % (147 de 150) |

Casi todas las frases de entrenamiento nombran el tipo de construcción (“baño”, “muro”…): por eso las palabras clave solas aciertan 94,0 %. La herramienta usa las palabras clave primero y el modelo solo cuando la frase no nombra el tipo; así acierta 98,0 %. En esta colección solo 6 frases no nombran el tipo (el modelo acertó 6): para medir mejor el aporte del modelo hacen falta más frases reales de ese estilo, por ejemplo las que escriban los arquitectos en la validación.

La evaluación de la IA (Gemini) con los mismos datos está en [evaluacion-ia.md](evaluacion-ia.md) (se genera con `npm run ia:evaluar`).

## Intérprete completo con frases nuevas

**20 de 20** frases que no están en el entrenamiento.

| Frase | Esperado | Obtenido | |
|---|---|---|---|
| necesito 4 muros de 3 metros por 2.5 | 4 muro | 4 muro | ✓ |
| quiero una habitación de 3x4 | 1 cuarto | 1 cuarto | ✓ |
| pañetar la sala de 20 m2 | PAN-01 | PAN-01 | ✓ |
| hacer el piso de la sala de 5 x 4 en cerámica | ACB-02 | ACB-02 | ✓ |
| una bodega de 4 por 6 | 1 cuarto | 1 cuarto | ✓ |
| un baño y una cocina | 1 bano, 1 cocina | 1 bano, 1 cocina | ✓ |
| arreglar la pared del patio de 10 m | 1 muro | 1 muro | ✓ |
| construir un cuarto útil | 1 cuarto | 1 cuarto | ✓ |
| quiero hacer donde bañarme | 1 bano | 1 bano | ✓ |
| levantar la tapia del lote de 20 metros | 1 muro | 1 muro | ✓ |
| un apartamento de 60 m2 | 1 casa | 1 casa | ✓ |
| enchapar la cocina | ACB-01 | ACB-01 | ✓ |
| un garaje | 1 cuarto | 1 cuarto | ✓ |
| hacer 2 baños de 2x2 | 2 bano | 2 bano | ✓ |
| cosina integral | 1 cocina | 1 cocina | ✓ |
| casa de 9 x 7 con dos baños y cocina | 1 casa | 1 casa | ✓ |
| 3 muros de 4 x 2,5 y 2 de 6 x 2,5 | 3 muro, 2 muro | 3 muro, 2 muro | ✓ |
| impermeabilizar la terraza de 30 m2 y hacer un mesón de 2 m | IMP-01, MES-01 | IMP-01, MES-01 | ✓ |
| donde guardar las herramientas | 1 cuarto | 1 cuarto | ✓ |
| un baño de 2 x 1,5 y enchapar la cocina | 1 bano, ACB-01 | 1 bano, ACB-01 | ✓ |

## IA (Gemini), opcional

Si hay `GEMINI_API_KEY` en `backend/.env`, la descripción y los materiales los entiende primero Gemini, con una respuesta JSON de esquema fijo. La herramienta no le cree a ciegas (`src/ia/verificar.js`):

- Cada número debe estar en lo que escribió la persona (o ser el mismo en cm o mm pasado a metros); si no, se descarta y se avisa.
- Solo se aceptan tipos, códigos de actividad e insumos que existen.
- Las cantidades de los trabajos y las conversiones de unidades las calcula la herramienta, no la IA.
- Lo que la persona pidió y no se puede aplicar tal cual (una marca, un acabado distinto) queda en *observaciones*, a la vista.
- Si la IA no está configurada, tarda más de lo permitido, falla o no encuentra nada, se usa el intérprete por reglas de arriba.

## Pruebas automáticas

`npm test` (en la carpeta backend) corre las pruebas de `backend/pruebas`: dominio (APU, actividades, presupuesto, cronograma, intérprete, materiales), IA (verificación de números, códigos, fallas y caché, con una IA de prueba), repositorio (fallos de escritura), servicios (cálculo, exclusiones y precios propios) y API (todas las rutas, errores y CRUD de obras).
