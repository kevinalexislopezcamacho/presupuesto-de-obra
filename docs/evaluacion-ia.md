# Evaluación de la IA (Gemini)

Generado con `npm run ia:evaluar` el 27 de septiembre de 2026. Modelos que respondieron: gemini-3.5-flash-lite (170).

## Intérprete completo con 20 frases nuevas

| Motor | Frases correctas |
|---|---:|
| Gemini, verificado por la herramienta | 19 de 20 |
| Reglas + Naive Bayes | 20 de 20 |

| Frase | Esperado | Gemini | Reglas |
|---|---|---|---|
| necesito 4 muros de 3 metros por 2.5 | 4 muro | 4 muro ✓ | 4 muro ✓ |
| quiero una habitación de 3x4 | 1 cuarto | 1 cuarto ✓ | 1 cuarto ✓ |
| pañetar la sala de 20 m2 | PAN-01 | PAN-01 ✓ | PAN-01 ✓ |
| hacer el piso de la sala de 5 x 4 en cerámica | ACB-02 | ACB-02 ✓ | ACB-02 ✓ |
| una bodega de 4 por 6 | 1 cuarto | 1 cuarto ✓ | 1 cuarto ✓ |
| un baño y una cocina | 1 bano, 1 cocina | 1 bano, 1 cocina ✓ | 1 bano, 1 cocina ✓ |
| arreglar la pared del patio de 10 m | 1 muro | 1 muro ✓ | 1 muro ✓ |
| construir un cuarto útil | 1 cuarto | 1 cuarto ✓ | 1 cuarto ✓ |
| quiero hacer donde bañarme | 1 bano | 1 bano ✓ | 1 bano ✓ |
| levantar la tapia del lote de 20 metros | 1 muro | 1 muro ✓ | 1 muro ✓ |
| un apartamento de 60 m2 | 1 casa | 1 casa ✓ | 1 casa ✓ |
| enchapar la cocina | ACB-01 | ACB-01 ✓ | ACB-01 ✓ |
| un garaje | 1 cuarto | 1 cuarto ✓ | 1 cuarto ✓ |
| hacer 2 baños de 2x2 | 2 bano | 2 bano ✓ | 2 bano ✓ |
| cosina integral | 1 cocina | 1 cocina ✓ | 1 cocina ✓ |
| casa de 9 x 7 con dos baños y cocina | 1 casa | 1 casa ✓ | 1 casa ✓ |
| 3 muros de 4 x 2,5 y 2 de 6 x 2,5 | 3 muro, 2 muro | 3 muro, 2 muro ✓ | 3 muro, 2 muro ✓ |
| impermeabilizar la terraza de 30 m2 y hacer un mesón de 2 m | IMP-01, MES-01 | IMP-01, MES-01 ✓ | IMP-01, MES-01 ✓ |
| donde guardar las herramientas | 1 cuarto | — ✗ | 1 cuarto ✓ |
| un baño de 2 x 1,5 y enchapar la cocina | 1 bano, ACB-01 | 1 bano, ACB-01 ✓ | 1 bano, ACB-01 ✓ |

## Clasificación de las 150 frases etiquetadas

Tipo de la primera parte que entiende Gemini, sin entrenamiento con estas frases. Se compara con el Naive Bayes en validación cruzada de 5 pliegues.

| Modelo | Exactitud | F1 macro |
|---|---:|---:|
| Gemini | 89,3 % (134 de 150) | 93,9 % |
| Naive Bayes (validación cruzada) | 84,0 % | 83,5 % |

| Clase | Precisión | Recall | F1 |
|---|---:|---:|---:|
| muro | 100,0 % | 100,0 % | 100,0 % |
| bano | 100,0 % | 86,7 % | 92,9 % |
| cocina | 100,0 % | 83,3 % | 90,9 % |
| cuarto | 96,6 % | 93,3 % | 94,9 % |
| casa | 100,0 % | 83,3 % | 90,9 % |

Una frase cuenta como acierto solo si la primera parte que entiende Gemini es del tipo de la etiqueta. Las demás cuentan como no encontradas y bajan el recall.

### Frases que no coinciden con la etiqueta (16)

Trabajo suelto: 5; pregunta a la persona: 10; otro tipo: 1.

Un "trabajo suelto" es otra lectura de la frase: por ejemplo, "cambiar el piso de la cocina" como el trabajo de piso y no como una cocina completa. La etiqueta pide el espacio completo; cuál sirve más depende de la obra, y la persona puede corregirlo en Medidas.

| Frase | Etiqueta | Qué entendió Gemini | Detalle |
|---|---|---|---|
| enchapar el baño y cambiar la ducha | bano | Trabajo suelto | ACB-01, HID-01 |
| batería de baños para el colegio | bano | Pregunta a la persona | bano o casa |
| montar un sanitario y un lavamanos | bano | Pregunta a la persona | bano o casa |
| ducha nueva con impermeabilización | bano | Trabajo suelto | IMP-01 |
| mesón en concreto para la cocina | cocina | Trabajo suelto | MES-01 |
| cocina abierta hacia la sala | cocina | Pregunta a la persona | cocina o cuarto |
| montar un mesón de 3 m | cocina | Trabajo suelto | MES-01 |
| quiero un mesón con lavaplatos | cocina | Trabajo suelto | MES-01 |
| donde cocinar en la finca | cocina | Pregunta a la persona | cocina o cuarto |
| un local comercial de 5 x 6 | cuarto | Pregunta a la persona | cuarto o muro |
| local para una tienda | cuarto | Pregunta a la persona | cuarto o muro |
| vivienda de interés social | casa | Pregunta a la persona | casa o cuarto |
| casita de dos alcobas | casa | Pregunta a la persona | casa o cuarto |
| vivienda de 3 habitaciones con cocina | casa | Otro tipo | cuarto |
| construir mi hogar | casa | Pregunta a la persona | casa o cuarto |
| donde vivir con mi familia | casa | Pregunta a la persona | casa o cuarto |
