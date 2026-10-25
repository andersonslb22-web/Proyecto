# Bitácora del proyecto

## Objetivo y alcance acordado

Desarrollar una aplicación web de uso personal para análisis y evaluación estadística de mercados deportivos. La información del partido, estadísticas y contexto se introduce manualmente en un formato estructurado; no se consumen APIs externas de partidos ni se admiten cuotas en el JSON. La interfaz expone datos originales, cálculos, colchones, penalizaciones, score y veredictos deterministas; Gemini solo añade justificaciones cualitativas a candidatos elegibles mediante una integración que no expone credenciales al navegador.

Alcance inicial: un flujo de partido individual, seis mercados permitidos, degradación automática únicamente hacia uno de esos mercados y sin persistencia. El ejemplo de carga de la app es Lille–Galatasaray, transcrito de `Partido.txt`; `Prueba-partido.txt` permanece como fixture de pruebas Juventus–Lazio.

## Estado por fases

| Fase | Responsable | Estado | Validación / salida |
|---|---|---|---|
| Descubrimiento | Orquestador | Completado | Repositorio inspeccionado: solo README, siete documentos de algoritmos y perfiles de agentes; no hay aplicación, manifiesto ni `docs/`. Árbol existente sin cambios rastreados; `.env.local` presente y deliberadamente no inspeccionado. |
| UX/UI | Diseñador de Prototipos & UX/UI | Completado | `docs/PROTOTIPO_UX.md` define las 18 métricas requeridas más tres adicionales de los expedientes (21), comparador, estados y criterios. |
| Contrato matemático y Gemini | Orquestador + Backend | Implementado | `docs/CONTRATO_TECNICO.md` fija score 55/45, gates, penalizaciones, MOP, fallback cerrado y justificaciones de candidatos elegibles. El JSON y el motor no usan cuotas ni EV. |
| Frontend y motor | Desarrollador Frontend | Implementado | React + TypeScript + Vite; parser v1, comparación de 21 métricas, barras condicionales, candidatos generados localmente, score, buffers, penalizaciones, MOP y fallback. Favorito asiático por la cuota menor de victoria simple. |
| Backend Gemini | Desarrollador Backend & DB Architect | Implementado | Proxy Node en loopback; origen exacto allowlisted, Content-Type JSON, límites/timeout/rate-limit, elegibilidad recalculada en servidor, minimización de datos, esquema de respuesta y cancelación upstream. No se llamó al proveedor real. |
| QA funcional | QA Tester & Product Owner | Validación automatizada parcial | 56 pruebas y build correctos; cobertura de parser, motor sin cuotas, API con proveedor simulado y desglose score de rutas. Pendiente QA visual/teclado/lector de pantalla en navegador. |
| Auditoría | Auditor de Código & Lead Dev | Completada con observaciones | `APROBADO CON OBSERVACIONES`; cancelación cerrada y no hay hallazgos altos. QA visual/accesible en navegador y llamada real a Gemini siguen sin verificar. |

## Decisiones y restricciones

- La especificación de este encargo prevalece sobre las cifras divergentes de los documentos históricos de `Colchones/`; estos se conservan sin modificación.
- El catálogo de mercados es cerrado: victoria simple 1/2, doble oportunidad 1X/X2, hándicap asiático negativo, córners totales altos, goles totales altos y goles individuales altos. BTTS y otros mercados citados como ejemplos en textos antiguos no se habilitarán como selección/fallback fuera de este catálogo.
- Requisitos de colchón iniciales: victoria simple `>= +0.40`; doble oportunidad `>= +0.15`; hándicap negativo `>= +2.80 goles`; córners combinados ajustados `>= 10.0`; goles totales ajustados `>= 2.70`; goles individuales ajustados `>= 1.30`.
- El score debe quedar limitado a 0–100 y descontar las penalizaciones indicadas. Si faltan estadísticas u otros datos requeridos, no se inventarán valores; el candidato se marcará como no evaluable según contrato.
- Ningún mercado calcula probabilidad implícita ni +EV. El favorito asiático se deriva de la menor cuota de victoria simple recibida en el JSON; xG neto sigue evaluando el gate y el score.
- Las matrices legacy se adaptan a bloques 55/45 de forma documentada en `docs/CONTRATO_TECNICO.md`; fixtures sintéticos solo ejercitan reglas no cubiertas por las fuentes, sin atribuirles datos de partidos reales.
- `Prueba-partido.txt` y `Partido.txt` son fuentes locales distintas: el primero se conserva como suite Juventus–Lazio y el segundo se transcribe como entrada de ejemplo Lille–Galatasaray. No se reescriben ni se parsean en runtime.
- No se inspeccionará ni imprimirá `.env.local`; cualquier clave de Gemini debe permanecer exclusivamente del lado servidor.

## Pendientes de cierre

1. QA visual, reflow móvil, teclado y lector de pantalla en navegador; no se declara validado sin comprobación real.
2. Auditoría final completada el 2026-10-22: `APROBADO CON OBSERVACIONES`; ver entradas finales en Historial.
3. No se hizo una llamada real a Gemini: tests usan `fetch` simulado. Para probar justificaciones reales, el usuario debe definir `GEMINI_API_KEY` y `GEMINI_MODEL` en el entorno del proceso API; no se inspeccionó `.env.local`.
4. Las cuotas presentes en las fuentes TXT se excluyen de los expedientes JSON y del motor. El favorito asiático se determina por xG neto; un empate o datos faltantes dejan ese mercado no evaluable.

## Historial

### 2026-10-22 — Inicio y descubrimiento

- Se inspeccionaron `README.md`, los siete documentos de `Colchones/` y los perfiles locales de diseño, backend, frontend, QA y auditoría.
- No existe aplicación web ni manifiesto de dependencias. No se modificaron artefactos preexistentes.
- Inicio de asignación secuencial: UX primero; contrato técnico, implementación, QA y auditoría dependen de sus salidas.

### 2026-10-22 — Contrato UX

- El Diseñador de Prototipos & UX/UI entregó `docs/PROTOTIPO_UX.md`; se revisó contra los requisitos y cubre panel comparativo, trazabilidad, estados y criterios de aceptación.
- No se aprobó ni inventó una matriz de score, transiciones MOP/fallback, schema final o política de dato faltante; continúan como decisiones de producto/algoritmo.
- Próximo handoff: Backend para proponer contrato versionado de entrada y endpoint seguro de Gemini; no se solicita esquema SQL porque no hay requisito de persistencia.

### 2026-10-22 — Contrato técnico

- Backend entregó `docs/CONTRATO_TECNICO.md` como propuesta de JSON v1, proxy de Gemini y pruebas simuladas, sin SQL, almacenamiento ni claves.
- Se conserva la recomendación de cálculo local auditable; Gemini puede recomendar entre candidatos elegibles pero no muta valores ni reglas.
- Se inicia frontend con el contrato como propuesta y alcance de datos/UI que no depende de decisiones de negocio. La implementación final de score, +EV, MOP y degradación queda bloqueada hasta aprobación de las decisiones listadas en los documentos.

### 2026-10-22 — Frontend inicial y ajuste QA

- Se creó la aplicación React + TypeScript + Vite sin persistencia ni backend. El editor conserva el borrador en memoria y la edición invalida los resultados anteriores.
- Se implementó parser JSON v1 con validación de propiedades, tipos, unidades, lados, cuotas y catálogo; las estadísticas omitidas quedan como `missing`, no como cero. `duels_won` se representa como conteo; la clave antigua `duels` se rechaza.
- La comparación presenta las 18 estadísticas de fuente, sus estados/unidades, barras pareadas cuando los dos valores observados y las unidades permiten escala, y operaciones observables trazables (xG neto por equipo, diferencial relativo de xG neto y totales brutos de córners, goles y xG). No se usan fixtures precargados.
- Las seis tarjetas conservan sus buffers publicados, muestran resultados finales como no evaluables/pendientes de reglas y exponen los campos de score, +EV y MOP sin calcularlos. Modificadores quedan visibles pero sin aplicar.
- El cliente Gemini es solo una interfaz tipada no conectada; no se realizan llamadas desde navegador ni se incluyen credenciales. No hay endpoint seguro disponible.
- QA corrigió una carrera: editar durante una espera invalida la ejecución, evitando mostrar resultados obsoletos. Se añadió un fixture exclusivamente sintético para fidelidad de valores.
- Verificación local: `npm test` (10 pruebas) y `npm run build` correctos; localhost respondió HTTP 200. No se verificó visualmente en navegador ni con lector de pantalla.
- Bloqueado: motor de picks completo, aprobación/veredicto, +EV, penalizaciones ambiguas, MOP, fallback y transiciones automáticas requieren decisiones de producto/matriz y vectores aprobados.

### 2026-10-22 — Correcciones posteriores a auditoría

- Se muestran en cada ficha las selecciones, líneas y cuotas fuente introducidas, sin derivar +EV ni score; se presenta la metadata de muestras completa junto al comparador.
- El parser valida la unidad y el signo de línea conforme a cada mercado cerrado. Las barras requieren muestras, fuente y ámbito compatibles; cuando no pueden compararse se conserva el valor bruto y se presenta el motivo sin barras.
- Las derivadas pasan a `not_evaluable` ante overflow/no finitos. Se añadieron pruebas de líneas, metadata comparable/incompatible y límites numéricos.
- Verificación: `npm test` (24 pruebas), `npm run build` y `git diff --check` correctos; sin errores informados por el editor. No se validó UI visual en navegador.
- Pendiente: reauditoría independiente del estado posterior a estos cambios. Las decisiones y bloqueos matemáticos, la integración Gemini, el fixture Juventus–Lazio y la validación visual/accesible siguen pendientes.

### 2026-10-22 — Auditoría formal del estado actual

- Alcance: revisión de `docs/PROGRESS.md`, `docs/PROTOTIPO_UX.md`, `docs/CONTRATO_TECNICO.md`, `package.json`, `src/domain/parser.ts`, `src/domain/calculations.ts`, `src/domain/types.ts`, `src/App.tsx`, `src/services/analysisClient.ts`, `src/styles.css` y `tests/domain.test.ts`. No se inspeccionó `.env.local`, no se llamaron servicios externos y no se ejecutó SQL/base de datos. Solo se modificó esta bitácora.
- Validación: `npm test` pasó (1 archivo, 10 pruebas); `npm run build` pasó (`tsc -b` y `vite build`). Inspección estática de la UI/CSS; no hay navegador ni Playwright disponibles en el alcance informado. El HTTP 200 referido arriba es evidencia previa, no una comprobación visual de esta auditoría.
- Resultado: **BLOQUEADO** para aceptación de la aplicación completa. El botón Analizar ejecuta validación y derivadas de comparación (`src/App.tsx:100-111`), pero no score, penalizaciones, gates, +EV, MOP ni fallback; las tarjetas muestran cuota/+EV y MOP/línea como “No evaluable” (`src/App.tsx:262-266`). El cliente Gemini es un stub `not_connected` (`src/services/analysisClient.ts:31-43`). El cierre de estas funciones depende primero de decisiones de Producto documentadas como pendientes; después requiere implementación frontend/backend y pruebas de matriz. Responsables: Producto para reglas y semántica; Frontend/Backend para motor determinista, visualización e integración server-side segura; QA para vectores aprobados y regresión.
- Hallazgo medio — Comparaciones potencialmente no equivalentes: las barras normalizan cada pareja al máximo (`src/domain/calculations.ts:17-35`) tras comprobar observación/unidad, pero no contrastan periodo, alcance ni tamaño de muestra; la UI solo muestra parte de esa metadata en el expediente (`src/App.tsx:201, 232-237`). Con ventanas distintas, el porcentaje visual parece comparar muestras homogéneas sin hacerlo. Producto debe definir equivalencia de muestras y Frontend debe ocultar/etiquetar las barras cuando no se cumpla; añadir pruebas para muestras incompatibles.
- Hallazgo medio — Rangos y líneas incompletos: el parser valida tipo finito y unidad canónica, pero no límites de dominio de las estadísticas (`src/domain/parser.ts:127-140`); tampoco valida la correspondencia entre mercado, unidad y obligatoriedad de línea de cuota (`src/domain/parser.ts:251-253`). Valores finitos extremos pueden además desbordar las sumas derivadas sin que se compruebe el resultado (`src/domain/calculations.ts:54-65`). Producto debe aprobar rangos y semántica por campo/mercado; Backend/Frontend debe aplicarlos y cubrir límites, líneas incompatibles y resultados derivados no finitos con pruebas.
- Hallazgo medio — Cuotas no trazables en pantalla: el parser acepta cuotas decimales y selecciones del catálogo, pero las fichas no muestran la cuota/selección/línea introducidas y presentan solo “Cuota / +EV: No evaluable” (`src/domain/parser.ts:240-260`, `src/App.tsx:262-266`). Frontend debe presentar la cuota y línea fuente asociadas al mercado aun cuando el cálculo de +EV siga bloqueado; no inventar probabilidad/confianza. No hay definición aprobada ni dato de confianza/reliability en el contrato actual, por lo que ese criterio queda pendiente de Producto.
- Criterios comprobados por código/pruebas: `teams` requiere exactamente dos entradas y lados/IDs únicos (`src/domain/parser.ts:303-313`); se declara `duels_won` con unidad `count`, se rechaza la clave legacy `duels`, y las estadísticas omitidas se normalizan a `missing`, no a cero (`src/domain/types.ts:19`, `src/domain/parser.ts:188-200`, `tests/domain.test.ts:46-73`). Las unidades canónicas se validan y no se coaccionan los valores no numéricos. La selección de cuotas está limitada a seis mercados y la prueba rechaza BTTS (`src/domain/parser.ts:214-237`, `tests/domain.test.ts:56-80`). Los textos dinámicos se insertan como nodos JSX escapados; no se observó uso de HTML crudo ni exposición de claves en el cliente. No se implementan APIs de partidos ni llamadas Gemini.
- UX/QA no verificados automáticamente: CSS incluye cortes responsive y foco visible (`src/styles.css:23,114-126`); el componente contiene foco programático de errores/resultados y una invalidación de ejecuciones obsoletas (`src/App.tsx:78-122`), pero las 10 pruebas son de dominio y no prueban teclado, lector de pantalla, reflow real ni concurrencia en navegador. La mención anterior de barras “accesibles” queda limitada a etiquetas/texto ARIA presentes en código, no a conformidad accesible verificada. Pendiente QA manual en navegador y teclado/lector de pantalla.
- Sin hallazgo crítico/alto de seguridad confirmado en el alcance inspeccionado. Los datos del usuario se renderizan mediante JSX; no se encontró una ruta de ejecución externa ni una credencial en los archivos revisados. No se inspeccionaron archivos de entorno. No hay SQL en el cambio solicitado.
- Pendientes de cierre: aprobar matriz/fórmulas y reglas de score, los seis buffers y penalizaciones, interpretación +EV/cuotas, MOP y transiciones fallback dentro del catálogo, política de dato faltante y definición de confiabilidad; implementar motor y proxy Gemini server-side sin secretos en navegador; mostrar cuotas; validar rangos y compatibilidad de muestras; añadir pruebas de esos flujos; ejecutar QA visual/accesible en navegador. La falta de esas funciones y decisiones impide declarar completa o aprobada la aplicación.

### 2026-10-22 — Reauditoría final posterior a correcciones

- Alcance: relectura de `docs/PROGRESS.md`, `docs/CONTRATO_TECNICO.md`, `package.json`, `src/App.tsx`, `src/domain/parser.ts`, `src/domain/calculations.ts`, `src/domain/types.ts`, `src/services/analysisClient.ts`, `src/styles.css` y `tests/domain.test.ts`. No se inspeccionó `.env.local`, no se editaron módulos de código, no se llamaron servicios externos y no se ejecutó SQL ni base de datos.
- Resultado del código actual: las seis tarjetas muestran las cuotas fuente asociadas por mercado, con selección, línea y cuota decimal; se presentan los campos de contexto de muestra. Las barras se bloquean con razón visible cuando no coinciden periodo, conteo/rango, fuente de muestra, fuente de estadística o ámbito compatible. El parser exige unidad y signo de línea según mercado. Las derivadas convierten resultados no finitos en `not_evaluable`/`null`. El catálogo UI/parser conserva exactamente seis mercados y excluye BTTS.
- Validación local: `npm test` pasó (1 archivo, 24 pruebas); `npm run build` pasó (`tsc -b` y `vite build`); `git diff --check` terminó sin salida. Todos los artefactos del proyecto aparecen como no rastreados en Git, por lo que el último comando no verificó su contenido; no se atribuye a esa orden una validación efectiva de whitespace sobre dichos archivos.
- Seguridad y regresiones: no se encontró HTML crudo ni una llamada externa activa en los módulos revisados; el cliente Gemini permanece desconectado y la UI declara que no envía datos. No se confirmó defecto funcional en las correcciones reauditadas ni hallazgo crítico/alto de seguridad. Observación de cobertura para QA/Frontend: existe una guarda de código para exigir igualdad y presencia de `source_label` de ambas estadísticas, pero las pruebas actuales cubren fuentes de muestra distintas, no una discrepancia entre las fuentes de las mediciones.
- Veredicto del encargo completo: **BLOQUEADO**; la auditoría del código actual no equivale a completar la aplicación. Siguen pendientes matrices/pesos aprobados, MOP, fallback, semántica y aplicación de penalizaciones ambiguas, endpoint Gemini seguro, fixture Juventus–Lazio y QA de navegador/lector de pantalla. No se ejecutó ni se requiere SQL para el alcance revisado. No declarar la aplicación completa aprobada hasta resolver estos pendientes y validarlos.

### 2026-10-22 — Observación de cobertura cerrada

- Se añadió una prueba de regresión que comprueba que fuentes distintas en las estadísticas impiden dibujar barras, cerrando la observación baja de la reauditoría. No se modificó lógica de producción.
- Validación posterior: `npm test` pasó (1 archivo, 25 pruebas). El build de producción pasó inmediatamente antes; el cambio posterior solo añade una prueba.
- El veredicto de la aplicación completa permanece **BLOQUEADO** por las decisiones de producto, la ausencia de integración Gemini, el fixture no disponible y la validación visual/accesible pendiente.

### 2026-10-22 — Motor, Gemini y fuente de entrada

- Se aprobó y documentó la matriz final: score 55/45 normalizado, rechazo terminal `<50`, seis mercados con Over/Under para goles/córners/individual, penalizaciones, +EV estricto, MOP y fallback dentro del catálogo.
- `src/domain/engine.ts` implementa gates, score, penalizaciones, MOP, líneas cotizadas y fallback; los casos de datos faltantes permanecen trazables. Se corrigió la precedencia para que el score `<50` rechace incluso cuando un gate no sea evaluable.
- `server/geminiApi.ts` y `server/index.ts` implementan el proxy ligado a loopback. El backend recalcula elegibilidad y minimiza datos; la UI solo pide justificaciones mediante acción explícita. Los tests no contactan Gemini real.
- `tests/fixtures/test_juventus_lazio.json` conserva la transcripción de `Prueba-partido.txt`; `examples/partido.json` es la entrada canónica Lille–Galatasaray desde `Partido.txt`, con valores faltantes, cuotas simples y xGA derivado etiquetados.
- Se corrigió la banda de errores rivales para `team_goals under`; el vector API usa cuota 2.20 para probar rama elegible bajo +EV estricto, solo en pruebas sintéticas.
- Verificación actual: `npm test` pasó (45 pruebas, 3 archivos); `npm run build` y `git diff --check` correctos; no hay errores del editor. Pendientes: QA visual/accesible y reauditoría del código completo. No se inspeccionó `.env.local` ni se llamó a Gemini.

### 2026-10-22 — QA de las dos fuentes

- QA comprobó que `Prueba-partido.txt` sigue alimentando exclusivamente la fixture de tests Juventus–Lazio y que el botón carga la transcripción canónica `examples/partido.json` desde `Partido.txt` (Lille–Galatasaray); el TXT no se parsea en runtime.
- Datos y cotizaciones de ambos expedientes conservan valores exactos, campos faltantes y procedencia. El motor solo tiene las dos cuotas simple-win de Lille–Galatasaray; no genera mercados ni cuotas faltantes.
- Resultado observado válido según reglas: Lille local obtiene score 66.5, pero estado `REJECT` por fallo del colchón; Galatasaray visitante queda `REJECT` por score `<50`. Ambos candidatos son rechazados y no habilitan Gemini. No se fijó un score de aceptación para este partido en los requisitos; QA no identificó discrepancia de negocio confirmada.
- El endpoint a través de Vite y la API directa devuelven 200 con `justifications: []` sin clave y sin llamar upstream para este expediente. Tests API usan proveedor simulado.
- Validación: `npm test` 45/45; `npm run build` correcto. No hay navegador/Chromium disponible: revisión visual, móvil, teclado y lector de pantalla siguen sin verificar. Auditoría final posterior a motor/proxy pendiente.

### 2026-10-22 — Correcciones de reauditoría integral

- `team_goals under` invierte las bandas de errores rivales; una regresión mantiene al Under sin recibir puntos por errores ofensivos del rival.
- El parser rechaza IDs de cuota duplicados y admite línea cero en mercados de goles/córners donde el contrato no imponía positividad. Los errores de validación identifican equipo por `side`, no por el orden del array.
- La UI expone el detalle de score/gate/+EV/penalizaciones de cada fallback/escalado y aclara qué datos se envían opcionalmente a Gemini.
- La API valida `Origin` contra allowlist exacta de Vite (`localhost`/loopback en 5173 y 5174), exige `application/json` y cancela fetch upstream al desconectarse el cliente.
- QA/auditoría automatizada actual: `npm test` 58/58; `npm run build` correcto; `get_errors` sin errores. No se llamó a Gemini ni se leyó `.env.local`.
- Pendientes: reauditoría independiente del cierre de cancelación y validación visual/accesible en navegador; no afirmar aprobación final hasta cerrar la revisión.

### 2026-10-22 — Cierre de cancelación frontend

- `src/App.tsx` conserva `AbortController` para la solicitud opcional de justificaciones y la cancela al iniciar otra, editar, revalidar/reanalizar o desmontar. `src/services/analysisClient.ts` propaga el signal y trata AbortError como cancelación silenciosa.
- `requestJustifications` también clasifica como cancelación silenciosa un AbortError mientras consume `response.json()`; la prueba lo cubre.
- La API server-side ya propaga la desconexión al upstream; tests directos verifican abort cliente y no exponen error obsoleto.
- Validación posterior: pruebas focalizadas y suite completa 58/58, build correcto y `get_errors` sin errores. Falta reauditoría independiente y sigue pendiente QA visual/accesible; no se llamó a Gemini real.

### 2026-10-22 — Cotizaciones completas de Lille–Galatasaray

- Se añadieron al ejemplo las cotizaciones recibidas: doble oportunidad 1X/X2; Lille -1.5 a 4.00; córners O/U 6.5; goles O/U 1.5; y goles individuales O0.5 para Lille/Galatasaray.
- Las cuotas individuales 1.29/1.40 se mapearon local/visitante por el orden del fixture. Se añadió aserción de las 11 cotizaciones; el hándicap queda explícitamente asignado al equipo local por aclaración del usuario.
- Validación: `npm test -- --run tests/engine.test.ts` pasó (16 pruebas); suite completa pasó (58 pruebas, 4 archivos), `npm run build` correcto y `get_errors` sin errores.

### 2026-10-22 — Auditoría final integral

- Alcance: revisión de `docs/CONTRATO_TECNICO.md`, `docs/PROTOTIPO_UX.md`, este historial, los siete algoritmos legacy de `Colchones/`, motor/parser/cálculos/tipos, proxy y cliente Gemini, frontend/CSS, pruebas, `.env.example`, `package.json`, configuración Vite/Vitest, los dos JSON y ambos TXT fuente. No se abrió `.env.local`, no se consultaron los procesos activos, no se llamó Gemini ni otro servicio externo, no se ejecutó SQL/base de datos y no se modificó código.
- Veredicto: **BLOQUEADO** para aceptación integral por un defecto alto confirmado en el score de `team_goals under` y por QA visual/accesible requerido aún sin evidencia. La API deriva elegibilidad del parser y motor servidor; la petición al proveedor solo contiene candidatos elegibles y métricas estructuradas necesarias, sin nombres, expediente crudo ni texto libre. Prompt y validación de respuesta se revisaron estáticamente; no hubo llamada real a Gemini.
- Hallazgo alto — Banda under de goles individuales (`src/domain/engine.ts:338-339`; requisito en `docs/CONTRATO_TECNICO.md:196`): la rama under asigna 15 puntos cuando goles y xG están ambos entre 1.3 y 1.59, la banda intermedia positiva de over, en vez de invertirla. Reproducción sintética local: goles/xG 1.4/1.4, tiros a puerta/ocasiones 3/1, rival con 0.5 goles concedidos y 1 error, línea under 2.5 a cuota 2.20; el motor devuelve `ELIGIBLE`, score 55, MOP +0.30 y +EV true. Sin esos 15 puntos el score queda bajo 50 y debe ser rechazo terminal. Corrección requerida: invertir explícitamente todas las bandas ofensivas para under; añadir vector de regresión que exija no elegible y pruebe el límite de banda antes de reaprobar.
- Hallazgo medio — CSRF/coste en API loopback (`server/geminiApi.ts:66-70`, `server/geminiApi.ts:77`, `server/geminiApi.ts:362`): se acepta cualquier puerto de `localhost`/`127.0.0.1` como origen, y el body se parsea como JSON sin validar `Content-Type`. Una página servida desde otro puerto local puede enviar un POST simple `text/plain` con JSON; el origen pasa y puede disparar llamadas Gemini usando la clave del proceso. El límite global de 30/min acota, no elimina, el abuso. Corrección requerida: allowlist de origen exacta/configurable y rechazo de tipos de contenido no JSON; probar origen localhost no autorizado y solicitud simple sin invocar upstream simulado.
- Reproducción de ese hallazgo: expediente sintético elegible, `Origin: http://localhost:9999` y `Content-Type: text/plain` fueron aceptados; el endpoint alcanzó una vez el `fetch` proveedor simulado (respuesta stub HTTP 502). No hubo llamada externa.
- Hallazgo medio — IDs de cuota no únicos (`src/domain/parser.ts:233`, `src/domain/parser.ts:279`; `src/services/analysisClient.ts:63`, `src/services/analysisClient.ts:70`): el parser no rechaza `quote_id` repetidos. La API mapea candidatos opacos a esos IDs y puede devolver IDs duplicados; el cliente los rechaza al detectar repetición, por lo que se pierde toda justificación aunque la respuesta del servidor sea válida para ambos candidatos. Corrección requerida: validar unicidad de `quote_id` en JSON v1 y cubrir parser, mapeo API y cliente con una prueba duplicada.
- Hallazgo medio — Se rechazan líneas totales cero (`src/domain/parser.ts:267`, `src/domain/parser.ts:270`; `docs/CONTRATO_TECNICO.md:79`, `docs/CONTRATO_TECNICO.md:96`): goles/córners/goles por equipo exigen `line_value > 0`, pero el contrato solo requiere número y unidad, sin límite positivo. Una cuota válida con línea 0 se convierte en error de expediente. Corrección requerida: no añadir un límite no aprobado o documentar/ratificarlo; probar línea cero para los mercados aplicables y el cálculo de sus gates.
- Hallazgo medio — Cancelación solo lógica, no de red (`src/App.tsx:187`, `src/App.tsx:212`, `src/services/analysisClient.ts:36`): editar la entrada invalida el resultado por token, pero no aborta el fetch; el servidor puede seguir procesando y enviar los datos minimizados a Gemini hasta su timeout de 8 s, con coste aunque el resultado ya sea obsoleto. Corrección requerida: propagar `AbortController` desde UI/cliente y cancelar upstream al desconectarse el solicitante; probar edición/cierre durante una respuesta pendiente con `fetch` simulado.
- Hallazgo medio — Copy de privacidad contradictorio (`src/App.tsx:271`, `src/App.tsx:281`, `src/App.tsx:400`): la UI asegura que nada se envía a servicios externos y que no hay conexión con Gemini, aunque el control explícito de justificaciones sí envía métricas elegibles al proveedor. Corrección requerida: aclarar que el análisis determinista es local y que solo al solicitar justificaciones se envían métricas mínimas a Gemini; validar textos y acción en navegador.
- Hallazgo medio — Ubicación de errores depende del orden y no del lado (`src/App.tsx:89-91`, `src/domain/parser.ts:336`): el parser acepta equipos en cualquier orden si `side` identifica uno local y otro visitante, pero `issueLocation` etiqueta `teams[0]` como local y `teams[1]` como visitante. Un expediente válido con visitante primero muestra bajo “Equipo local” sus errores. Corrección requerida: resolver la ubicación con el `side` de la entrada o incluir el lado en cada error; probar ambos órdenes.
- Hallazgo medio — Resultado de escalado/fallback no es auditable en la tarjeta (`src/domain/engine.ts:526-544`, `src/App.tsx:97-120`): el motor recalcula las rutas pero descarta score/gate/MOP/+EV de la evaluación alternativa; la UI solo muestra línea, cuota y estado, y deja la traza en un detalle cerrado. La aceptación pide recalcular y exponer los campos explicables por cuota/ruta. Corrección requerida: conservar la evaluación completa de la alternativa y presentarla con score, cuota, probabilidad, +EV, gate/MOP, penalizaciones y trazabilidad; añadir pruebas de presentación para fallback y escalado.
- Compatibilidad revisada sin defecto confirmado: selección/mercados y líneas se validan por enum/unidad; prioridad `<50` impide fallback; score 55/45, penalizaciones, gates, MOP, rutas de fallback y autoridad server-side concuerdan en la revisión estática salvo el hallazgo under. Las 21 estadísticas, campos faltantes, ausencias, cuotas y mapeo de tarjetas (amarillas más rojas de temporada prorrateadas) y errores de gol/disparo de ambos JSON coinciden con sus TXT y con las aserciones de fixtures. El proveedor no recibe nombres, etiquetas de origen, texto libre ni selecciones no elegibles; `.env.example` solo contiene nombres de variables y placeholders.
- Validación local: `npm test` pasó (3 archivos, 45/45); `npm run build` pasó (`tsc -b` y `vite build`); `git diff --check` no produjo salida. `git status --short` muestra los artefactos del proyecto, incluidos `docs/`, como no rastreados; por ello `diff --check` no valida su contenido y se registra solo como resultado vacío del diff rastreado. Los tests de Gemini usan `fetch` simulado.
- No verificado / seguimiento bloqueante: QA real de reflow móvil, botones/estados, teclado, foco, lector de pantalla y contraste en navegador; no se dispone de evidencia visual/browser en este cierre. Sin integración real de Gemini y sin parser/validador SQL aplicable; no hay SQL en el alcance y no se ejecutó base de datos. Responsable recomendado: Backend para CSRF, IDs y cancelación upstream; Frontend para score under, cancelación UI y copy; QA para pruebas de regresión y validación visual/accesible. Repetir suite, build, pruebas específicas de hallazgos y QA de navegador antes de cambiar el veredicto.

### 2026-10-22 — Cierre de hallazgos frontend confirmados

- El parser ahora rechaza `quote_id` duplicados en todo el partido y localiza el issue en la segunda cuota. Las líneas `0` son válidas para `total_goals`, `total_corners` y `team_goals`; las líneas negativas de esos mercados siguen rechazadas. El contrato técnico documenta unicidad y el dominio no negativo.
- La ubicación de errores consulta el `side` explícito del equipo en el borrador JSON, con análisis protegido; si no se puede resolver, muestra “Equipo 1/2” en vez de inferir localía por índice.
- La interfaz distingue el cálculo determinista local del envío opcional de justificaciones: el expediente va al servidor local para validación y Gemini recibe solo métricas mínimas de candidatos elegibles, sin nombres ni expediente completo.
- Las tarjetas conservan y muestran datos tipados de las cuotas escaladas/fallback: ruta, estado, cuota, score, probabilidad implícita, umbral +EV, resultado del gate, proyección, threshold/MOP, penalizaciones y trazabilidad. No se alteraron las reglas ni resultados del motor.
- No se reproduce un defecto en `team_goals under`: la banda `<1.3` da 25/25 y la banda `1.3..1.59` da 15/25, invirtiendo las bandas de over conforme al contrato. Se añadió una prueba de ambos límites; el score del motor permanece intacto.
- Validación: pruebas focalizadas `tests/domain.test.ts` y `tests/engine.test.ts` (45/45); suite completa (52/52); `npm run build` correcto. No se leyó `.env.local`, no se llamó a Gemini, no se modificó `package.json` ni ningún fixture.
- Pendiente fuera de este alcance: verificación visual/accesible en navegador; no se declara comprobada. Esta adenda no modifica ni resuelve los hallazgos backend de CSRF/cancelación descritos en la auditoría.

### 2026-10-22 — Reauditoría final del estado corregido

- Alcance: revisión de `docs/CONTRATO_TECNICO.md`, `docs/PROTOTIPO_UX.md`, esta bitácora, `src/domain/engine.ts`, `parser.ts`, `types.ts`, `calculations.ts`, `issueLocation.ts`, `routeSummary.ts`, `src/App.tsx`, `src/styles.css`, `src/services/analysisClient.ts`, `server/geminiApi.ts`, `server/index.ts`, `vite.config.ts`, `package.json`, `.env.example`, `tests/engine.test.ts`, `tests/geminiApi.test.ts`, `tests/domain.test.ts`, `tests/fixtures/test_juventus_lazio.json`, `examples/partido.json` y `Prueba-partido.txt`/`Partido.txt`. La revisión se basó en el contenido actual, no en diffs de archivos no rastreados. No se abrió `.env.local`, no se llamó a Gemini ni a otro servicio externo, no se ejecutó SQL/DB y no se editó código.
- Veredicto: **APROBADO CON OBSERVACIONES** para los cambios actuales. Sin hallazgos críticos o altos confirmados. Hay una observación media de cancelación en frontend y queda QA visual/accesible de navegador sin verificar; ninguna de ellas invalida las comprobaciones deterministas y automatizadas realizadas.
- Corrección Under verificada: el contrato (`docs/CONTRATO_TECNICO.md:191,196`) asigna a `team_goals` los 25 puntos a ambos valores `>=1.6` en Over y 15 a ambos `1.3..1.59`, con bandas Under en sentido inverso. El test (`tests/engine.test.ts:354-371`) fija goles/xG en `1.4/1.4` y observa 15/25; luego en `1.2/1.2` y observa 25/25, diferencia de 10 puntos. El código (`src/domain/engine.ts:338-339`) implementa esos límites. El falso positivo anterior queda descartado por evidencia ejecutable.
- Hallazgos anteriores revalidados: allowlist de Origin exacta y guard de `application/json` (`server/geminiApi.ts:12-19,72-78,386-390`; pruebas `tests/geminiApi.test.ts:72-108`); parser y motor de servidor recalculan elegibilidad desde `input`, y solo la lista `ELIGIBLE` llega a `buildProviderInput` (`server/geminiApi.ts:397-413`). La petición rechaza campos extra y pruebas prueban que un candidato inyectado no alcanza el upstream (`tests/geminiApi.test.ts:110-121`). El prompt trata datos como no confiables; payload minimizado excluye nombres, competición, IDs de partido, etiquetas de fuente y expediente completo; las pruebas lo verifican con `fetch` simulado (`server/geminiApi.ts:282-288,127-189`; `tests/geminiApi.test.ts:132-149`). La respuesta valida forma cerrada, candidatos/metric IDs, longitud y narrativa sin cifras/recomendación (`server/geminiApi.ts:215-272`). La clave solo se lee en `server/index.ts:4-6`; `.env.example` contiene nombres y placeholder, no credencial. La cancelación server-side al cerrar la conexión se propaga al `AbortSignal` de Gemini y está probada (`server/geminiApi.ts:294-304,447-450`; `tests/geminiApi.test.ts:202-231`).
- Hallazgo medio — Cancelación por edición no llega al servidor (`src/App.tsx:198-207,219-230`; `src/services/analysisClient.ts:36-46`): al editar se invalidan el resultado y el token de UI, pero la llamada `fetch` iniciada al pedir justificaciones no recibe `AbortSignal`. Por eso, aunque la UI descarte correctamente una respuesta obsoleta, el request sigue en curso y el servidor puede consumir cuota/procesar métricas minimizadas hasta respuesta o timeout. El abort server-side al cerrar la conexión sí funciona; el hueco es que la UI no cierra la conexión al invalidar la solicitud. Responsable recomendado: Frontend/Backend. Corrección requerida: conservar un `AbortController` para la solicitud, abortarlo al editar/revalidar/desmontar y comprobar con fetch simulado que la señal del cliente se aborta y que Gemini recibe el abort upstream.
- Rutas alternas y parser: las alternativas se calculan solo a partir de cuotas ya presentes (`src/domain/engine.ts:498-544`); el parser permite únicamente seis mercados y rechaza `quote_id` repetidos (`src/domain/parser.ts:15-23,238-256`). `routeSummary` recupera la evaluación alternativa completa y la UI presenta cuota, score, probabilidad implícita, umbral +EV, gate, MOP, proyección, penalizaciones y traza (`src/domain/routeSummary.ts:16-40`; `src/App.tsx:109-128`). La localización de errores consulta el `side` del equipo (`src/domain/issueLocation.ts:3-25`); las pruebas cubren visitante primero (`tests/domain.test.ts:147-157`). El copy distingue cálculo local de envío opcional a Gemini (`src/App.tsx:294`).
- Fuentes verificadas: `Prueba-partido.txt` corresponde a Juventus–Lazio y `tests/fixtures/test_juventus_lazio.json`; mantiene 21 estadísticas en orden, xGA/localía y ajustes de urgencia como missing, fecha sin zona como `null`, y solo cuotas simple-win 1.55/6.00. `Partido.txt` corresponde a Lille–Galatasaray y `examples/partido.json`; conserva 21 estadísticas en orden, xGA 0.92/1.14 explícitamente marcado derivado, roles/urgencia/localía faltantes, inicio `null`, y solo las cuotas 2.20/3.10. Las aserciones de valores, source labels, faltantes y cuotas están en `tests/engine.test.ts:45-152`; no se detectó estadística, línea o cuota añadida como si viniera de la fuente.
- Validación: `npm test` pasó (3 archivos, 56/56); `npm run build` pasó (`tsc -b` y Vite); `git diff --check` terminó sin salida. `git status --short` muestra los artefactos del workspace como no rastreados, así que `diff --check` solo acredita un diff rastreado vacío y no valida whitespace de dichos artefactos; no se usaron esos archivos como evidencia de diff. `.env.local` y la disponibilidad/configuración real del proveedor no se comprobaron.
- Pendientes / límites: `command -v chromium || command -v chromium-browser || command -v google-chrome || true` no encontró navegador; no hay captura ni QA visual/reflow móvil/teclado/lector de pantalla en esta auditoría. La API se probó solo con `fetch` simulado: no hubo llamada real a Gemini. No hay SQL en el alcance ni se ejecutó base de datos; validación SQL no aplicable. Seguimiento: QA debe validar presentación y flujo de petición en navegador; Frontend/Backend debe cubrir cancelación UI y repetir las pruebas afectadas antes de cerrar la observación media.

### 2026-10-22 — Reauditoría focalizada: cancelación Gemini

- Alcance: solo `src/App.tsx`, `src/services/analysisClient.ts`, `server/geminiApi.ts`, `tests/analysisClient.test.ts`, `tests/geminiApi.test.ts` y este historial. No se inspeccionó `.env.local`, no se modificó código, no se contactaron servicios externos ni se ejecutó SQL/base de datos.
- Cierre del hallazgo medio: `src/App.tsx` aborta la solicitud al editar y al revalidar/reanalizar, y al desmontar; el incremento del token de ejecución y la guarda de montaje descartan resultados cancelados sin presentar error. `analysisClient` pasa el signal al fetch y transforma el rechazo `AbortError` del fetch en `{ cancelled: true }`. El servidor observa el cierre de la respuesta y combina su señal con el timeout al llamar Gemini.
- Validación: pruebas focalizadas de `tests/analysisClient.test.ts` y `tests/geminiApi.test.ts` pasaron (12/12); `npm test` pasó (4 archivos, 57/57); `npm run build` pasó (`tsc -b` y Vite). La prueba server-side usa fetch simulado, no Gemini real.
- Residual técnico acotado: una simulación local de `AbortError` lanzado durante `response.json()` produjo `INVALID_MODEL_RESPONSE`, porque ese catch no discrimina abort. Las rutas de cancelación exigidas sí invalidan el token antes de resolver la llamada, por lo que la UI descarta ese resultado silenciosamente. No reabre el hallazgo de cancelación de red; queda como mejora de clasificación/cobertura del cliente.
- Dictamen general: **APROBADO CON OBSERVACIONES**. La observación media de cancelación queda resuelta con la evidencia anterior. Siguen sin verificar QA de navegador/accesibilidad y una llamada real a Gemini; no se elevan a comprobaciones aprobadas.

### 2026-10-22 — Última reauditoría puntual: AbortError al leer response.json()

- Alcance: revisión focalizada de `src/services/analysisClient.ts`, `tests/analysisClient.test.ts`, `src/App.tsx`, `server/geminiApi.ts`, `tests/geminiApi.test.ts` y esta bitácora. No se inspeccionó `.env.local`, no se modificó código, no se llamó a servicios externos ni se ejecutó SQL/base de datos.
- Cierre de la observación de cancelación: `requestJustifications` reconoce `AbortError` tanto durante `fetch` como durante `response.json()` y devuelve `{ ok: false, cancelled: true }`, sin mensaje de error. La prueba de `response.json()` rechazado con `AbortError` comprueba exactamente este resultado. La UI descarta cancelaciones sin mostrarlas como error; además aborta la solicitud al editar, revalidar/reanalizar o desmontar. El servidor propaga el cierre del cliente al `AbortSignal` de la llamada al proveedor, cubierto con fetch simulado.
- Validación de esta reauditoría: `npm test` pasó (4 archivos, 58/58 pruebas); `npm run build` pasó (`tsc -b` y `vite build`). No se realizaron llamadas reales a Gemini.
- Dictamen: **APROBADO CON OBSERVACIONES** para el cambio revisado. La observación de cancelación queda cerrada. No se declara aprobado QA visual, reflow móvil, teclado ni lector de pantalla: no se verificaron en navegador. Tampoco se declara validada una llamada real a Gemini; los tests del servidor usan un proveedor simulado.

### 2026-10-22 — Mercados calculados sin cuotas

- Se eliminó `simple_win_odds` del contrato `MatchInput`, del parser v1 y de ambos JSON de ejemplo/fixture. El parser rechaza cuotas y cotizaciones heredadas como propiedades no permitidas.
- Los mercados y sus líneas se generan con el motor local a partir de estadísticas/contexto. El favorito del hándicap asiático se determina por mayor `xg - xga`; si faltan esos datos o hay empate, el candidato queda `not_evaluable`.
- La UI dejó de presentar cuotas, probabilidad implícita y +EV. La API opcional de Gemini valida el mismo expediente y opera con IDs de candidatos, nunca con IDs de cotización.
- Se reemplazaron pruebas del motor que dependían del contrato anterior por regresiones de candidatos estadísticos, gates, MOP y ausencia de favorito sin datos suficientes. Las pruebas API cubren rechazo del campo legado.
- Validación: `npm test` pasó (4 archivos, 50 pruebas); `npm run build` pasó; `get_errors` no reportó errores en `src`, `server` ni `tests`. No se realizó llamada real a Gemini; QA visual/accesible sigue pendiente.
- Auditoría del cambio: **APROBADO**; confirmó que no quedan usos activos de cuotas, que el favorito asiático depende solo de xG neto y que los IDs de Gemini corresponden a candidatos.

### 2026-10-22 — Trazabilidad del score

- Se añadió a cada candidato y ruta alternativa el aporte efectivo normalizado de cada factor de confirmación/respaldo, las penalizaciones y el ajuste si el score alcanza un límite.

### 2026-10-24 — Metricas derivadas de segundo orden

- Se inspecciono `examples/partido.json` y se incorporaron seis metricas informativas por equipo: conversion de goles por disparo, ratio xGOT/xG, tasas de tiros bloqueados y desviados, errores que llevan a disparo por volumen de tiros y corners por 100 puntos porcentuales de posesion.
- Todas requieren fuentes `observed`, denominador positivo y resultado finito; de lo contrario conservan `null` y estado `not_evaluable`. No participan en `engine.ts`, por lo que la matriz 55/45, sus maximos y el score no cambian.
- `docs/CONTRATO_TECNICO.md`, `src/domain/calculations.ts` y `tests/domain.test.ts` quedaron sincronizados. Validacion focalizada: 35/35 pruebas; errores de editor: ninguno. Suite completa, build y auditoria final pendientes.
- La UI presenta “Trazabilidad del score” inmediatamente debajo de la trazabilidad del motor, con aportes a dos decimales, subtotal previo al límite, ajuste de redondeo cuando aplica y score final sobre 100.
- Las pruebas verifican que la suma del desglose coincide con el score mostrado, incluido el ajuste del límite inferior, y contemplan ocasiones falladas, faltas, baja confirmada y goles evitados del portero.
- La trazabilidad del motor ya no repite las penalizaciones que se detallan debajo en la trazabilidad del score. Las pruebas comprueban sumas exactas en rutas principal, escalada, fallback y límite inferior.
- Validación final: `npm test` pasó (4 archivos, 56 pruebas); `npm run build` pasó; `get_errors` no reportó errores en las áreas modificadas.
- Auditoría: **APROBADO CON OBSERVACIONES**; sin defectos en el desglose. Queda pendiente la comprobación visual/accesible en navegador.

### 2026-10-22 — Urgencia derivada de clasificación

- Solicitud: al pegar el expediente de partido, calcular urgencia automáticamente en el motor local y no en Gemini.
- Se añadió `match.standings` con tamaño de tabla, puesto de corte, fuente y filas de los equipos asociadas por `team_id` (puesto, partidos jugados, puntos y diferencia de goles).
- Regla determinista: fuera del corte = `high`; corte y dos posiciones anteriores = `medium`; más de dos posiciones por encima = `low`. Tabla ausente conserva `urgency` manual por compatibilidad; equipo sin fila o sin partidos jugados queda `unknown`. La traza del score expone puesto/tamaño/corte.
- `examples/partido.json` incluye Lille 34/36 y Galatasaray 35/36, ambos fuera del corte 24 tras dos partidos; la urgencia resultante es alta. `points` y diferencia se preservan, no afectan todavía la regla.
- Validación focalizada: `tests/domain.test.ts` (32/32), `tests/engine.test.ts` (10/10) y pruebas combinadas tras ajuste de trazabilidad (42/42).
- Observación de auditoría cerrada: la traza explica también la urgencia `unknown` por fila ausente/cero partidos e incluye la fuente.
- La traza conserva urgencia, motivo y fuente también cuando una métrica ausente deja el score `not_evaluable`; una regresión cubre esta ruta.
- El contrato incluye `urgency` como campo manual opcional solo cuando no se proporciona tabla, y pruebas cubren `unknown` con score no evaluable.
- `urgency: null` se rechaza; solo el campo omitido recurre a `unknown` en entradas sin tabla.
- Validación final: `npm test` pasó (4 archivos, 58/58); `npm run build` pasó (`tsc -b` y Vite). Auditoría final: **APROBADO**, sin hallazgos bloqueantes.

### 2026-10-22 — Trazabilidad de score para córners

- `total_corners` mantiene la ponderación 55/45 y calcula el respaldo con proxies disponibles: centros combinados `>=10` (20), pases en campo contrario combinados `>=350` (15) y disparos totales combinados `>=30` (10).
- La trazabilidad separa confirmación y respaldo y advierte que son proxies ofensivos, no córners concedidos. Con `partido.json`, el score queda en 90: 55 de confirmación + 45 de respaldo - 10 por ocasiones falladas.
- Se añadió regresión para los umbrales, el score real de `partido.json` y la ausencia de `crosses`. Validación final: `npm test` 61/61; `npm run build` correcto.

### 2026-10-22 — Aclaración documental del respaldo de córners

- Se corrigió `Colchones/algoritmo_colch_n_din_mico_para_c_rners.md`: se eliminó la afirmación histórica de respaldo 50/50 como si fuera vigente y se documentó la matriz ejecutable (confirmación 30+25, respaldo 20+15+10 con proxies disponibles).
- El documento ahora advierte que las cuotas, +EV y cifras históricas no reflejan el motor actual, y enlaza al contrato técnico como autoridad de comportamiento.
- Validación: `git diff --check` sin errores; revisión del diff documental.