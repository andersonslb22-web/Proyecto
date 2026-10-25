# Contrato UX: análisis y pronósticos de fútbol

## Alcance y autoridad

Este documento define la experiencia de una aplicación web personal para analizar un partido con datos introducidos manualmente. La aplicación frontend usa React, TypeScript y Vite; el cálculo determinista del navegador es local. La solicitud opcional de justificaciones envía el expediente al servidor local para validación; Gemini solo recibe métricas mínimas de candidatos elegibles.

La persona usuaria pega o edita JSON v1 compatible con datos tipo Sofascore/Opta. No se consulta una API externa de partidos. La especificación del contrato técnico prevalece sobre documentos históricos de `Colchones/`. El botón de ejemplo carga `examples/partido.json`, transcrito de `Partido.txt` (Lille–Galatasaray), solo mediante acción explícita; cargarlo no ejecuta el análisis. `Prueba-partido.txt` se conserva como fixture de prueba Juventus–Lazio.

**Principio de decisión aprobado:** un motor determinista local controla cálculos, elegibilidad, penalizaciones y resultados. Gemini solo redacta justificaciones opcionales de candidatos elegibles; no calcula, corrige cifras, completa faltantes ni modifica resultados.

## Objetivo y usuario

- **Usuario:** una persona que introduce y revisa manualmente información de un partido y sus equipos.
- **Objetivo principal:** obtener una comparación legible y una evaluación trazable de mercados permitidos, incluyendo datos faltantes, límites y motivos del resultado.
- **Acción principal:** pegar/editar los datos, validarlos y solicitar el análisis.
- **Fuera de alcance:** ingestión automática de fixtures, cuotas o estadísticas; mercados distintos de los seis enumerados; persistencia asumida; asesoramiento financiero.

## Estructura y flujo

Una sola vista de análisis de partido, ordenada en este flujo:

1. **Entrada:** campo de texto amplio para pegar/editar JSON; controles para cargar el ejemplo fuente, validar y analizar. Cargar el fixture nunca analiza automáticamente. No hay autoguardado ni persistencia.
2. **Expediente:** identificación del partido y expediente de cada equipo, con estado de validación y lista de problemas localizados.
3. **Comparación:** estadísticas visibles de ambos equipos en columnas paralelas y grupos semánticos. Mostrar unidades, periodo/fuente si fueron aportados y valores no disponibles de forma inequívoca.
4. **Evaluación:** seis mercados como máximo, cada uno con tarjeta explicable y estado. Sin sugerencias de mercados fuera del catálogo.
5. **Detalle:** datos originales, métricas derivadas, procedencia de cada cálculo, penalizaciones, MOP y explicación cualitativa disponibles para inspección.

En móvil, los equipos se muestran en bloques consecutivos o mediante selector de equipo que conserve una comparación accesible; los grupos estadísticos no deben desaparecer ni depender solo del color. La entrada se puede plegar después de analizar, pero su contenido no se pierde durante la sesión.

## Expediente y validaciones

El expediente requiere partido y exactamente dos equipos. El schema JSON v1 y sus campos obligatorios se definen en `docs/CONTRATO_TECNICO.md`.

### Partido

Presentar los datos del partido y equipos, competición, fecha, localía y estadísticas aportadas. Las cuotas y precios no forman parte de la entrada ni de los cálculos. Validar que el bloque pueda interpretarse, que exista un partido y que se puedan identificar dos equipos distintos. Los errores señalan el campo o la ubicación disponible y permiten volver al editor sin borrar el contenido.

### Cada equipo

Mostrar un estado separado para equipo local y visitante. Validar la presencia e identificación de ambos, la asociación de sus estadísticas al equipo correcto, y los valores numéricos cuando un campo esté presente. Rechazar o señalar valores con tipo/formato incompatible, unidades incoherentes explícitas y valores no finitos; no corregirlos silenciosamente. Las reglas de rango y si una ausencia es dato faltante o no evaluable están pendientes.

### Entrada y corrección

- Entrada vacía: no ejecutar análisis; indicar que falta el expediente.
- Sintaxis inválida: indicar error de parseo y ubicación si está disponible; conservar el texto íntegro para corregir.
- Estructura incompleta o inválida: listar los campos/entidades afectados, no presentar resultados como válidos y ofrecer volver a editar.
- Validación correcta: confirmación visible de que la entrada es interpretable, sin dar a entender que las cifras son verdaderas o verificadas externamente.
- Reanálisis: tras editar, invalidar visiblemente los resultados anteriores hasta completar otra validación/análisis; no mezclar resultados de dos versiones.

Los mensajes deben distinguir **error de formato**, **dato ausente**, **dato inválido** y **no evaluable**. El significado operacional de dato faltante frente a no evaluable es un bloqueo de producto. No inventar valores, historiales ni sustituciones.

## Comparación estadística

Presentar las siguientes métricas visibles para cada equipo y, cuando corresponda, un total combinado claramente etiquetado. La ausencia de dato se representa como “No disponible” o el estado que apruebe el contrato, nunca como cero.

| Grupo | Estadísticas visibles |
|---|---|
| Ofensiva | Goles, xG, xGOT, disparos totales, tiros a puerta, disparos desviados, tiros bloqueados, grandes ocasiones creadas y falladas |
| Ritmo | Posesión, pases en campo contrario, córners |
| Defensa/portería | Goles recibidos, xGA, goles evitados, despejes, errores que conducen al gol y errores que llevan a disparo separados |
| Fricción | Faltas, tarjetas, duelos ganados (conteo) |

Las estadísticas originales conservan su valor y unidad tal como se introdujeron. Un total combinado, promedio, diferencial, ajuste u otra métrica calculada se identifica como **Derivada** y no reemplaza el dato fuente. La relación visible debe permitir inspeccionar para cada derivada: valor(es) de origen, operación/fórmula, unidad, precisión/redondeo y versión del cálculo cuando estén definidos. No exponer una derivada como confiable si depende de datos ausentes o de una fórmula pendiente.

Los datos estadísticos del motor deben ser promedios por partido `season_to_date`, con muestra positiva y alcance conocido. Los valores originales conservan unidad, estado y `source_label`; las derivaciones indican la operación aplicada.

## Mercados y reglas visibles

Catálogo cerrado de destino, selección y fallback. Los totales de goles/córners y goles individuales generan únicamente selecciones Over; nunca ofrecen under, BTTS, hándicap positivo ni mercados fuera de los seis contratos.

| Mercado permitido | Colchón/requisito comunicado |
|---|---|
| Victoria simple 1/2 | Diferencial de xG neto de al menos `+0.40` |
| Doble oportunidad 1X/X2 | Margen de imbatibilidad de al menos `+0.15` |
| Hándicap asiático negativo | Ventaja de hándicap de al menos `2.80 goles` |
| Córners totales Over | Proyección frente a línea con colchón base `3.5` córners |
| Goles totales over/under | Proyección frente a línea con colchón base `1.2` goles |
| Goles individuales over/under | Proyección del equipo frente a línea con colchón base `0.8` goles |

Modificadores requeridos, visibles cuando apliquen:

- Faltas combinadas `>= 26`: `-5` puntos y `+0.5` al colchón de totales e hándicap.
- Baja: `-10` solo si `confirmation=confirmed`, `starter=true` e `is_structural=true`, con tope acumulado `-25`.
- Portero rival con goles evitados `>= 1.20`: `-15` en victoria simple y overs de goles individuales/totales; no córners, unders ni hándicap.
- Grandes ocasiones falladas `>= 2.0`: `-10` al subtotal normalizado de confirmación según mercado; no doble oportunidad.
- Score expresado en escala `0–100`, con límite inferior y superior. Si las penalizaciones superan la base, el mínimo mostrado es 0; no permitir score superior a 100.
- No se calcula valor esperado, probabilidad implícita ni ningún indicador que dependa de cuotas.

El score aplica matrices adaptadas y normalizadas 55/45, regla terminal score `<50`, gates/MOP y fallback del contrato técnico. El resultado es una evaluación determinista basada en entrada manual, no una garantía estadística.

## Tarjeta explicable y estados de decisión

Cada tarjeta muestra, cuando estén disponibles y definidos:

- Mercado y selección dentro del catálogo, score `0–100` y estado.
- Debajo de “Trazabilidad del motor”, “Trazabilidad del score” desglosa los aportes normalizados de confirmación/respaldo, las penalizaciones, límites aplicados y score final.
- Línea generada por el motor, margen MOP y cálculo/definición aplicados; no se solicitan cuotas.
- Prueba de colchón: valor observado, umbral, unidad y resultado aprobado/no aprobado/no evaluable.
- Ajustes y penalizaciones como partidas separadas, con condición activada y procedencia.
- Datos faltantes/no evaluables que afectan el resultado, sin sustituirlos por cero.
- Cualitativo de IA separado de los hechos y cifras del motor, con los datos fuente referenciados.
- Aviso persistente: “La IA no inventa ni corrige cifras. El análisis se basa en los datos introducidos; no constituye garantía de resultado”.

Usar exactamente los estados de negocio requeridos, distinguiéndolos visualmente y con texto:

- **Escalar:** ajustar la línea generada según los límites MOP del contrato; mostrar línea anterior/nueva y recalcular score y colchón.
- **Elegible:** score `>=50` y colchón/MOP aprobado. Gemini puede justificarlo, no cambiar su estado.
- **Fallback:** intentar primero una línea conservadora generada del mismo mercado y recalcular todo; después, si aplica, doble oportunidad vinculada al equipo con mayor `net_xg`. Nunca salir del catálogo.
- **Rechazado:** incluye score `<50` terminal o fallo de colchón/MOP. El score `<50` no activa fallback.
- **No evaluable:** faltan datos que una regla requiere. No se imputa ni se presenta como cero.

Un estado de carga no implica que un pronóstico esté aprobado. Si Gemini falla, las cifras/validaciones deterministas siguen identificadas por separado y el cualitativo se marca como no disponible; no fabricar una respuesta de IA.

## Estados de pantalla

- **Vacío inicial:** editor disponible, sin fixture ni estadísticas de ejemplo que parezcan reales; instrucción breve para pegar datos.
- **Carga:** indicar qué proceso está ocurriendo (validación o análisis) y evitar resultados obsoletos interactivos.
- **Error de parseo/validación:** error asociado al partido o equipo, ubicación si disponible, texto preservado y acción de corrección.
- **Éxito de validación:** indicar expediente interpretable; no afirmar veracidad externa.
- **Éxito de análisis:** mostrar comparación y tarjetas con trazabilidad y estados; los mercados no evaluables siguen visibles con su motivo.
- **Fallo de análisis/IA:** mensaje concreto, conservar la entrada y permitir reintentar. Fallo de IA no borra ni altera los resultados deterministas.
- **Sin datos suficientes:** informar qué falta y qué candidatos quedan no evaluables con la semántica del contrato técnico.

## Sistema visual, responsive y accesibilidad

Dirección funcional y sobria para uso repetido: encabezados compactos, jerarquía clara entre entrada, comparación y veredicto, números alineados para facilitar lectura, unidades adyacentes y color reservado para estados. No depender solo del color: cada estado incluye etiqueta textual e icono con nombre accesible. Diferenciar originales y derivados con etiqueta visible y patrón consistente.

- Escritorio: editor y resumen de expediente en zona superior; comparación lado a lado; detalle y tarjetas ordenados por mercado.
- Móvil: una columna; controles de entrada a ancho disponible; comparación por equipos sin tablas que requieran desplazamiento horizontal para acceder a valores; tarjetas apiladas.
- Teclado: todos los controles alcanzables en orden lógico; editor, validación, análisis y detalles operables sin ratón; foco visible; no atrapar el foco en paneles expandibles.
- Accesibilidad: etiquetas programáticas, encabezados jerárquicos, unidades legibles por lector de pantalla, mensajes de error asociados al campo y anunciados al aparecer; foco llevado al resumen de errores tras validar y al resumen de resultados tras analizar, sin moverlo durante carga.
- Contraste suficiente para texto y estados; zoom/reflow sin pérdida de contenido o acciones. No usar color como única codificación.

## Reglas aprobadas

Las fórmulas, matrices 55/45, penalizaciones, gates, límites MOP y fallback se definen en `docs/CONTRATO_TECNICO.md`. El motor aplica esas reglas localmente y conserva una traza por candidato; el JSON contiene únicamente las dos cuotas de victoria simple para identificar el favorito, sin calcular precio, probabilidad implícita ni +EV. Un dato faltante requerido deja el candidato `not_evaluable`, no se imputa ni se sustituye por otro indicador fuera de las adaptaciones documentadas.

## Supuestos conservadores explícitos

- El input manual es la fuente de datos y no se verifica contra proveedores externos. Si incluye una tabla estructurada, el motor deriva urgencia con la regla explícita del contrato; Gemini no la calcula.
- El catálogo de seis mercados es una enumeración cerrada incluso para fallback; ninguna excepción histórica lo amplía.
- Las estadísticas faltantes no se sustituyen por cero ni por promedios inferidos; se señalan y el candidato queda no evaluable cuando la regla depende de ellas.
- Una cifra original no se altera; toda transformación se muestra aparte y con fórmula/origen según el contrato.
- Se analiza un partido por vez y no se asume persistencia entre sesiones.
- El ejemplo de interfaz es Lille–Galatasaray desde `Partido.txt`; Juventus–Lazio desde `Prueba-partido.txt` se usa como suite principal de pruebas y no como entrada precargada.
- Gemini solo redacta justificaciones en español de candidatos que el servidor ya marcó elegibles. No recibe nombres de equipos ni expediente crudo, y no es fuente de hechos, cifras ni elegibilidad.

## Criterios de aceptación verificables

1. La vista permite pegar y editar una entrada estructurada manual, incluida la tabla de clasificación cuando esté disponible; no hay llamada ni dependencia de API de partidos.
2. Una entrada vacía, con sintaxis incorrecta o con expediente/equipo inválido produce un error localizado, conserva el texto y no muestra análisis como válido.
3. Partido, local y visitante tienen estado de validación independiente; los errores de cada equipo se pueden identificar sin confundir sus estadísticas.
4. El comparador incluye las 18 estadísticas requeridas y las métricas adicionales incluidas en las fuentes (22 en total, incluidos centros por partido), en sus cuatro grupos, para ambos equipos; una ausencia no se representa como cero.
5. Se distinguen datos originales de métricas derivadas; cada derivada expone origen y fórmula aprobada, o se marca no evaluable si no existe fórmula/dato suficiente.
6. La interfaz presenta únicamente victoria simple 1/2, doble oportunidad 1X/X2, hándicap asiático negativo, goles totales Over/Under, córners totales Over y goles individuales Over/Under. Ni selección ni fallback ofrecen BTTS, hándicap positivo ni otro mercado.
7. Los colchones, scores, penalizaciones y gates coinciden con el contrato técnico y muestran umbral, puntos, ámbito y condición.
8. Cada tarjeta contiene los campos explicables definidos (score, línea generada, MOP, test de colchón, ajustes, faltantes e IA cualitativa) o indica explícitamente “pendiente/no evaluable” en vez de inventar un valor.
9. Ningún resultado depende de cuotas: no se calculan probabilidades implícitas ni +EV, y el parser rechaza campos de cuotas/precios heredados.
10. Escalar, elegible, fallback, rechazado y no evaluable son estados textuales diferenciados. El fallback recalcula los gates y nunca sale del catálogo.
11. El cualitativo de IA está claramente separado; no inventa ni corrige cifras y un fallo de IA no cambia score, elegibilidad ni cifras del motor.
12. Vacío, carga, éxito, errores de entrada, fallo de análisis/IA y falta de datos tienen representación y recuperación especificadas; una edición invalida resultados anteriores.
13. Las tareas de pegar, corregir, validar, analizar y revisar resultados funcionan con teclado, foco visible y mensajes accesibles; la pantalla refluye en móvil sin pérdida de datos/acciones ni dependencia del color.
14. No se muestran estadísticas ficticias de Juventus vs. Lazio ni cifras de ejemplo histórico presentadas como datos del fixture.
15. Con `standings`, el motor deriva la urgencia de cada equipo según el puesto y el corte configurado; si faltan datos suficientes queda desconocida y la trazabilidad muestra motivo, puesto/corte y fuente disponibles. Sin tabla se conserva la urgencia manual por compatibilidad.

## Archivos de este entregable

- `docs/PROTOTIPO_UX.md`: contrato UX/UI, reglas visibles, bloqueos y criterios de aceptación. No se modifican archivos de aplicación ni configuración.