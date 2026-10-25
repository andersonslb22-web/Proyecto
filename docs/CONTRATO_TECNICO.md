# Contrato técnico

**Estado:** reglas y adaptaciones aprobadas por el usuario. Define el motor local; no es una API desplegada ni define persistencia.

## Autoridad y alcance

- La entrada manual versionada es la única fuente de hechos del partido. No hay API de partidos ni verificación externa.
- Un motor local conserva los datos originales, calcula y explica métricas, colchones, penalizaciones y score. Solo el motor aplica reglas duras y determina elegibilidad final.
- Gemini solo redacta justificaciones cualitativas para candidatos ya elegibles por código. No elige candidato, emite veredicto, calcula ni modifica score, gates, líneas o elegibilidad. Solo se le envían candidatos elegibles.
- El catálogo tiene exactamente seis categorías: `simple_win`, `double_chance`, `asian_handicap`, `total_goals`, `total_corners` y `team_goals`. `asian_handicap` tiene dos variantes de la misma categoría: línea negativa para el favorito y positiva para el no favorito. `total_goals`, `total_corners` y `team_goals` solo admiten `OVER`.
- El motor genera candidatos de mercado sin precio y, cuando corresponde, les asigna una línea interna. La UI muestra automáticamente la línea actual y la línea recomendada que haya superado las reglas.
- No se presupone almacenamiento. No se propone SQL, esquema de base de datos, configuración, ni claves en el navegador.

## Entrada manual: JSON v1

JSON estricto, UTF-8, con `schema_version: "1.0"`. El parser rechaza JSON malformado, propiedades desconocidas en v1 y tipos incompatibles; no convierte texto en números ni rellena datos.

```json
{
  "schema_version": "1.0",
  "match": {
    "match_id": "string",
    "competition": "string|null",
    "kickoff": "ISO-8601|null",
    "simple_win_odds": { "home": "number > 1", "away": "number > 1" },
    "teams": [
      {
        "team_id": "string",
        "name": "string",
        "side": "home|away",
        "sample": {
          "period": "last_n_matches|season_to_date|date_range|single_match|unknown",
          "matches_count": "integer|null",
          "from": "date|null",
          "to": "date|null",
          "scope": "home|away|all|unknown",
          "source_label": "string|null"
        },
        "urgency": "low|medium|high|unknown (optional; used only without standings)",
        "urgency_adjustment": "Measurement",
        "structural_absences": [
          {
            "absence_id": "string",
            "is_structural": "boolean|null",
            "starter": "boolean|null",
            "confirmation": "confirmed|unconfirmed|unknown"
          }
        ],
        "stats": {
          "goals_scored": "Measurement",
          "xg": "Measurement",
          "xgot": "Measurement",
          "shots_total": "Measurement",
          "shots_on_target": "Measurement",
          "shots_off_target": "Measurement",
          "blocked_shots": "Measurement",
          "crosses": "Measurement",
          "big_chances_created": "Measurement",
          "big_chances_missed": "Measurement",
          "possession_pct": "Measurement",
          "passes_opposition_half": "Measurement",
          "corners": "Measurement",
          "goals_conceded": "Measurement",
          "xga": "Measurement",
          "goals_prevented": "Measurement",
          "clearances": "Measurement",
          "errors": "Measurement",
          "errors_leading_to_shot": "Measurement",
          "fouls": "Measurement",
          "cards": "Measurement",
          "duels_won": "Measurement"
        }
      }
    ],
    "standings": {
      "team_count": "integer",
      "qualification_cutoff_position": "integer",
      "source_label": "string|null",
      "teams": [
        {
          "team_id": "string",
          "position": "integer",
          "matches_played": "integer",
          "points": "integer",
          "goal_difference": "integer"
        }
      ]
    },
    "home_advantage": "Measurement"
  }
}
```

`teams` debe contener exactamente dos equipos distintos, uno `home` y otro `away`. El lado es explícito y no se infiere de nombres u orden. `simple_win_odds` es obligatorio y contiene una única cuota decimal positiva para cada lado de victoria simple; el equipo con la cuota menor es el favorito. Las cuotas solo determinan las etiquetas de favorito/no favorito del hándicap asiático y no participan en score, gates, MOP ni penalizaciones. Toda estadística usada por un candidato es un promedio por partido `season_to_date`; requiere `matches_count > 0` y alcance válido (`home`, `away` o `all`, según el indicador). Sin promedio o muestra válida, el candidato es `not_evaluable`, nunca se imputa. `standings`, cuando se proporciona, incluye el tamaño total de la tabla, el puesto que marca el corte de clasificación y una fila por equipo del partido; las filas se asocian por `team_id`, no por orden ni nombre. `matches_played` debe ser mayor que cero para derivar urgencia; filas ausentes o sin partidos disputados dejan la urgencia de ese equipo como `unknown`.

La urgencia se deriva localmente de forma determinista desde la clasificación: puesto posterior al corte (`position > qualification_cutoff_position`) = `high`; dentro del corte o hasta dos puestos por encima (`cutoff - 2 <= position <= cutoff`) = `medium`; más de dos puestos por encima = `low`. Es una heurística contextual para el score, no una medida estadística ni una predicción. El motor guarda el motivo y la fuente (puesto/tamaño/corte) y los muestra en la trazabilidad, incluso si la categoría queda `unknown` por fila ausente o cero partidos jugados. Si no se proporciona `standings`, se conserva `urgency` manual opcional por compatibilidad con entradas existentes; si se proporciona tabla, esta es la autoridad y sustituye cualquier `urgency` manual. `points` y `goal_difference` se conservan como contexto fuente, pero no alteran esta primera regla.

`urgency_adjustment` es un ajuste numérico explícito en goles para la fórmula asiática; si no está observado se usa `0` como supuesto conservador, sin asignar puntos de urgencia por ello. La estimación interna de `home_advantage` combina la señal de temporada `((GF_local-GF_visitante)+(GC_visitante-GC_local))/4` con la señal reciente de las muestras `last_n_matches` de local/visitante; produce `0.35 + 0.1*señal_temporada + 0.1*señal_reciente`, limitada a `[0.30, 0.50]` goles, y conserva la fuente `Cálculo algorítmico interno basado en rendimiento local/visitante reciente y temporada`.

Cada `structural_absences` item identifica un solo jugador mediante `absence_id`; IDs duplicados se rechazan para no duplicar penalizaciones. No se requieren nombres de jugador.

`Measurement` es `{ "value": number|null, "unit": string, "status": "observed|estimated|missing|unknown|not_applicable", "source_label": string|null }`. Se permiten estadísticas omitidas: se normalizan internamente a `missing`, nunca a cero. Si `status` no es `observed` o `estimated`, `value` debe ser `null`; si es `observed` o `estimated`, debe ser un número finito con la unidad canónica. Las unidades son `goals` para goles/xG/xGOT/xGA/goles evitados/ajustes de urgencia/localía, `count` para conteos (incluidos disparos, grandes ocasiones y duelos ganados) y `percent` para posesión. `home_advantage` puede venir explícito; si llega `null` o `missing`, el motor lo estima y lo marca `estimated`, por lo que doble oportunidad sigue siendo evaluable. `duels_won` representa el conteo de duelos ganados; un porcentaje de éxito en duelos no debe mapearse a este campo ni convertirse silenciosamente. `big_chances_created` representa grandes ocasiones creadas. `errors` representa únicamente errores que conducen al gol y es el campo utilizado por la matriz; `errors_leading_to_shot` se conserva por separado y nunca se mezcla con `errors`. `cards` representa amarillas promedio más rojas por partido; si la fuente da rojas como total de temporada, se divide por `matches_count` antes de sumar. Todo valor usado por el motor es promedio por partido y conserva su procedencia en `source_label`.

`urgency_adjustment` es una medida en goles independiente de la categoría `urgency`; si falta, se toma como cero únicamente en el gate asiático. En `structural_absences`, `starter` e `is_structural` quedan como `null` cuando la fuente no establece esos roles; solo una baja confirmada con ambos valores `true` penaliza. IDs duplicados por equipo se rechazan. `kickoff` requiere zona u offset para ser un instante ISO-8601; si la fuente solo ofrece hora local sin zona, se usa `null` y no se infiere timezone.

La selección se genera localmente por categoría: `simple_win` usa home y away; `double_chance`, `1X` y `X2`; `asian_handicap`, favorito `-1.5` y no favorito `+1.5`; los totales usan `OVER`. `team_goals` genera un candidato por equipo. El favorito para `asian_handicap` se determina exclusivamente por la cuota menor de `simple_win_odds`; si las cuotas empatan, ambos candidatos asiáticos quedan sin lado determinado. xG/xGA siguen siendo necesarios para evaluar el gate y el score, pero ya no ordenan el favoritismo. El JSON no admite cuotas adicionales, precios, líneas ni selecciones de mercado proporcionadas por el usuario; cualquier campo fuera de `simple_win_odds` se rechaza como propiedad desconocida.

Las líneas se generan internamente, sin usar la cuota como precio: `asian_handicap` favorito `-1.5` y no favorito `+1.5`; `total_goals OVER 1.5`; `total_corners OVER 6.5`; `team_goals OVER 0.5` para cada equipo. También se generan `simple_win` para home y away, y `double_chance` `1X` y `X2`. Las categorías sin línea no reciben una línea artificial.

Campos ausentes, `null`, `unknown` y `not_applicable` no son equivalentes. Un dato malformado/incompatible es error de validación; ausente o desconocido es dato no disponible. Si una regla requiere ese dato, su resultado es `not_evaluable`, no aprobado ni descartado por una cifra inventada. No hay coerción ni imputación. Se rechazan números no finitos, unidades incompatibles, equipos duplicados, más/menos de dos lados y propiedades desconocidas, incluidas las cuotas heredadas.

### Ejemplo sintético mínimo

Este ejemplo de parser es sintético y no describe un partido real ni sugiere una selección. Las estadísticas no incluidas son faltantes; los mercados se generan localmente a partir de los datos observados.

```json
{
  "schema_version": "1.0",
  "match": {
    "match_id": "SYNTH-0001",
    "competition": "Competición sintética",
    "kickoff": null,
    "teams": [
      {
        "team_id": "SYNTH-H",
        "name": "Equipo Sintético Norte",
        "side": "home",
        "sample": {
          "period": "unknown",
          "matches_count": null,
          "from": null,
          "to": null,
          "scope": "unknown",
          "source_label": null
        },
        "urgency": "unknown",
        "urgency_adjustment": { "value": null, "unit": "goals", "status": "missing", "source_label": null },
        "structural_absences": [],
        "stats": {
          "xg": {
            "value": 1.1,
            "unit": "goals",
            "status": "observed",
            "source_label": "synthetic"
          }
        }
      },
      {
        "team_id": "SYNTH-A",
        "name": "Equipo Sintético Sur",
        "side": "away",
        "sample": {
          "period": "unknown",
          "matches_count": null,
          "from": null,
          "to": null,
          "scope": "unknown",
          "source_label": null
        },
        "urgency": "unknown",
        "urgency_adjustment": { "value": null, "unit": "goals", "status": "missing", "source_label": null },
        "structural_absences": [],
        "stats": {}
      }
    ],
    "home_advantage": { "value": null, "unit": "goals", "status": "missing", "source_label": null }
  }
}
```

## Cálculos, gates y estados

El motor calcula `score` en `[0,100]`, aplica penalizaciones como restas directas y evalúa cada gate como `pass|fail|not_evaluable`, con entradas, fórmula, versión y motivo trazables. Todo promedio estadístico es por partido y `season_to_date`; cada equipo debe tener muestra válida (`matches_count > 0`) y cada medida requerida debe estar observada. Si falta promedio, periodo o muestra válida, el candidato es `not_evaluable`.

### Métricas derivadas de segundo orden (Trazabilidad y Contexto)

El motor calcula métricas derivadas de segundo orden de manera 100% determinista a partir de las estadísticas primarias observadas en la muestra del partido (`season_to_date`). Estas métricas sirven para enriquecer la trazabilidad del expediente, la visualización comparativa en la interfaz y los indicadores cualitativos enviados a Gemini AI. Son **puramente informativas** y no alteran de forma directa la matriz de score determinista, preservando la regla de peso **55/45** calibrada.

| ID de Métrica | Etiqueta | Fórmula Matemática | Unidad | Criterio de Tratamiento ante Datos Faltantes o Cero |
|---|---|---|---|---|
| `home_shot_accuracy_pct` / `away_shot_accuracy_pct` | Precisión de disparo | `(shots_on_target / shots_total) * 100` | `%` | Requiere `shots_total > 0` y ambos valores observados. Si `shots_total <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_finishing_efficiency` / `away_finishing_efficiency` | Eficiencia de finalización | `goals_scored / xg` | `ratio` | Requiere `xg > 0` y ambos valores observados. Si `xg <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_xg_per_shot` / `away_xg_per_shot` | Calidad de tiro (xG por disparo) | `xg / shots_total` | `goals` | Requiere `shots_total > 0` y ambos valores observados. Si `shots_total <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_big_chance_conversion_pct` / `away_big_chance_conversion_pct` | Conversión de grandes ocasiones | `((big_chances_created - big_chances_missed) / big_chances_created) * 100` | `%` | Requiere `big_chances_created > 0` y ambos valores observados. Si `big_chances_created <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_defensive_solidity_ratio` / `away_defensive_solidity_ratio` | Solidez defensiva (Goles / xGA) | `goals_conceded / xga` | `ratio` | Requiere `xga > 0` y ambos valores observados. Si `xga <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_territorial_pressure_index` / `away_territorial_pressure_index` | Presión territorial por posesión | `passes_opposition_half / possession_pct` | `passes/%` | Requiere `possession_pct > 0` y ambos valores observados. Si `possession_pct <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_fouls_per_card_ratio` / `away_fouls_per_card_ratio` | Ratio de disciplina (Faltas por tarjeta) | `fouls / cards` | `fouls/card` | Requiere `cards > 0` y ambos valores observados. Si `cards <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_goals_per_shot_pct` / `away_goals_per_shot_pct` | Conversión de disparos en gol | `(goals_scored / shots_total) * 100` | `%` | Requiere `shots_total > 0` y ambos valores observados. Si `shots_total <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_xgot_to_xg_ratio` / `away_xgot_to_xg_ratio` | Calidad de tiro convertido en xGOT | `xgot / xg` | `ratio` | Requiere `xg > 0` y ambos valores observados. Si `xg <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_blocked_shot_rate_pct` / `away_blocked_shot_rate_pct` | Proporción de tiros bloqueados | `(blocked_shots / shots_total) * 100` | `%` | Requiere `shots_total > 0` y ambos valores observados. Si `shots_total <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_off_target_rate_pct` / `away_off_target_rate_pct` | Proporción de tiros desviados | `(shots_off_target / shots_total) * 100` | `%` | Requiere `shots_total > 0` y ambos valores observados. Si `shots_total <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_errors_to_shot_rate_pct` / `away_errors_to_shot_rate_pct` | Exposición a errores por volumen de tiro rival | `(errors_leading_to_shot / shots_total) * 100` | `%` | Requiere `shots_total > 0` y ambos valores observados. Si `shots_total <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `home_corners_per_100_possession` / `away_corners_per_100_possession` | Densidad de córners por posesión | `(corners / possession_pct) * 100` | `corners/100%` | Requiere `possession_pct > 0` y ambos valores observados. Si `possession_pct <= 0` o falta un valor, el resultado es `null` / `not_evaluable`. |
| `gross_corners_total` / `gross_goals_total` / `gross_xg_total` | Totales brutos combinados | `home + away` | unidad de origen | Requiere ambos valores observados con la misma unidad. Si falta alguno, el resultado es `null` / `not_evaluable`. |
| `home_net_xg` / `away_net_xg` | xG neto por equipo | `xg - xga` | `goals` | Requiere `xg` y `xga` observados. Si falta un valor o el resultado no es finito, el resultado es `null` / `not_evaluable`. |
| `net_xg_difference` | Diferencial de xG neto | `home_net_xg - away_net_xg` | `goals` | Requiere ambos xG netos evaluables y un resultado finito; en otro caso, `null` / `not_evaluable`. |
| `gross_shots_total` | Disparos totales combinados | `home.shots_total + away.shots_total` | `count` | Requiere ambos valores observados con la misma unidad. Si falta alguno, `null` / `not_evaluable`. |
| `gross_shots_on_target_total` | Tiros a puerta combinados | `home.shots_on_target + away.shots_on_target` | `count` | Requiere ambos valores observados con la misma unidad. Si falta alguno, `null` / `not_evaluable`. |
| `gross_big_chances_created_total` | Grandes ocasiones creadas combinadas | `home.big_chances_created + away.big_chances_created` | `count` | Requiere ambos valores observados con la misma unidad. Si falta alguno, `null` / `not_evaluable`. |
| `gross_fouls_total` | Faltas combinadas observadas | `home.fouls + away.fouls` | `count` | Requiere ambos valores observados con la misma unidad. Si falta alguno, `null` / `not_evaluable`. |

Toda operación matemática que produzca división por cero, desbordamiento numérico o valores no finitos (`NaN`, `Infinity`) conmuta automáticamente al estado `not_evaluable` con valor `null`, garantizando la seguridad en tiempo de ejecución.

### Colchones y MOP

Sea `net_xg(team) = xg - xga`, con medidas válidas en la muestra indicada. `home_advantage` es un input explícito o estimado en goles, positivo para el local: se suma al equipo local y se resta al visitante. Si falta, el motor lo estima antes de evaluar `double_chance`.

| Mercado/selección | Proyección y gate de colchón |
|---|---|
| `simple_win` | `net_xg(candidate) - net_xg(rival) >= 0.40` |
| `double_chance` | `net_xg(candidate) + signed_home_advantage - net_xg(rival) >= 0.15` |
| `asian_handicap` | Gate: `goal_adjusted_margin = goles anotados promedio candidato - goles concedidos promedio rival + urgency_adjustment + handicap_line`; requiere `>=1.3`. Con faltas combinadas `>=26`, requiere `>=1.8`. `urgency_adjustment` ausente se toma como `0` conservador. La proyección simétrica para score es `xg_adjusted_margin = xg candidato + handicap_line - goles concedidos promedio rival`. |
| `total_corners OVER` | Proyección = suma de promedios de córners; gate `>= line + 3.5`. |
| `total_goals OVER` | Proyección = suma de goles promedio de ambos equipos; si no están disponibles ambos, usar suma de ambos xG. No mezclar goles y xG. Gate `>= line + 1.2`. |
| `team_goals OVER` | Proyección = goles promedio del `team_id`; si no está disponible, usar su xG. Gate `>= line + 0.8`. |

Con faltas promedio combinadas `>= 26`, además de `-5` score, el colchón sube `+0.5` en `total_corners OVER`, `total_goals OVER`, `team_goals OVER` y `asian_handicap` (este último por medir diferencial de goles). El gate asiático pasa a `goal_adjusted_margin >= 1.8`. No cambia los gates de victoria simple ni doble oportunidad.

`MOP` es el margen con signo respecto del gate de colchón de la línea actual: proyección menos el límite inferior. MOP negativo no pasa el colchón; `MOP < 0.5` conserva línea base; `0.5 <= MOP <= 1.1` permite un paso; `1.1 < MOP < 1.2` conserva un paso de forma conservadora; `MOP >= 1.2` permite dos pasos. Los niveles se aplican a categorías con línea (`total_goals`, `total_corners`, `team_goals`, `asian_handicap`); `simple_win` y `double_chance` no escalan. Cada paso es `0.5`: `OVER` sube la línea; el hándicap favorito se hace `0.5` más negativo y el no favorito se acerca `0.5` a cero. El motor escala y recalcula aunque no haya cuotas. MOP solo elige el objetivo de línea: el candidato inicial y cada nueva línea deben tener score `>=50` y pasar el gate correspondiente; cada línea vuelve a calcular score, penalizaciones y colchón. MOP no reemplaza estos gates ni convierte un candidato fallido en elegible.

### Score 55/45 y adaptación de matrices

Todos los mercados usan base `55` para confirmación ofensiva/volumen y `45` para respaldo/contexto/oponente; esta decisión sustituye también el 60/40 de la arquitectura genérica histórica. Para cada bloque: `subtotal_normalizado = subtotal_matriz * peso_bloque / maximo_matriz_del_bloque`; score bruto = ambos subtotales normalizados. Las penalizaciones se restan directamente y el resultado se limita a `[0,100]`. Se conservan indicadores, bandas y puntos documentados en los siete archivos de `Colchones/` cuando sus campos están disponibles; matrices históricas 50/50 se normalizan a 55/45, nunca se mezclan sus máximos sin normalizar.

Cada candidato conserva una trazabilidad del score con el aporte normalizado de cada factor de confirmación/respaldo, cada penalización aplicada y cualquier ajuste por el límite `[0,100]`. La suma de esos aportes debe coincidir con el score final mostrado. Los puntos originales de matriz pueden mostrarse junto al aporte normalizado para explicar la transformación 55/45.

| Mercado | Confirmación (indicadores legacy y puntos) | Respaldo (indicadores legacy y puntos) |
|---|---|---|
| `simple_win` | Diferencial goles anotados-recibidos `>=0.6`: 20; `0.2..0.59`: 10. Urgencia alta: 10. Goles evitados propios `>=1.0`: 20. | Goles concedidos rival `>=1.3`: 25. Errores rival `>=1` por partido: 25. |
| `double_chance` | Gate de resistencia `>=0.15`: 20. Urgencia alta/media: 10/5. Goles concedidos `<=0.9`: 12. Goles evitados `>=1.0`: 13. | No-victorias rival fuera `>=50%`: 20; empates `>=25%`: 10; balones perdidos `>=115`: 15. |
| `asian_handicap` | Indicador simétrico `xg_adjusted_margin = xg candidato + handicap_line - goles concedidos promedio rival`: `>=1.5`: 20; `0.8..1.49`: 10. Urgencia alta: 10. Porterías a cero `>=50%`: 20. | Goles concedidos rival `>=1.5`: 25; `1.1..1.49`: 15. Ventaja xGOT sobre paradas: 25. |
| `total_goals OVER` | Goles/xG combinados `>=3.2`: 25. Tiros a puerta combinados `>=10` y ocasiones creadas `>5`: 15. Urgencia alta: 15. | Goles concedidos rivales `>=1.2`: 25. Errores rival `>=1` por partido: 20 en sustitución de H2H. |
| `team_goals OVER` | Goles y xG del equipo `>=1.6` ambos: 25; ambos `1.3..1.59`: 15. Tiros a puerta `>=5` y ocasiones creadas `>=3`: 15. Efectividad y urgencia: 15. | Goles concedidos rival `>=1.2`: 25; `0.8..1.19`: 12. Errores rival `>=1` por partido: 20. |
| `total_corners OVER` | Adaptación conservadora: 30 puntos si la proyección supera el gate de córners; 25 si tiros a puerta + bloqueados combinados `>=10`. | Centros combinados `>=10`: 20; pases en campo contrario combinados `>=350`: 15; disparos totales combinados `>=30`: 10. Son proxies ofensivos, no córners concedidos. |

Los campos históricos no incluidos en el input (tasas de derrota/empate, balones perdidos, porterías a cero, paradas, tendencia H2H y conversión) no se inventan ni derivan de `errors`. En `double_chance`, el gate de resistencia sustituye la tasa de derrotas; respaldo usa goles concedidos `>=1.3` (25) y `errors >=1` (20), con los indicadores adicionales de confirmación tabulados. Para `asian_handicap`, goles concedidos propios `<=0.9` (20) sustituyen porterías a cero y errores del rival (25) sustituyen xGOT/paradas. Su score usa la misma fórmula y bandas para ambos lados: `xg_adjusted_margin = xg candidato + handicap_line - goles concedidos promedio rival`; `>=1.5` da 20 y `0.8..1.49` da 10. Esta simetría es el supuesto determinista del contrato. El colchón usa `goal_adjusted_margin = goles anotados promedio candidato - goles concedidos promedio rival + urgency_adjustment + handicap_line` y requiere `>=1.3` (o `>=1.8` con faltas combinadas `>=26`). Así, el hándicap favorito `-1.5` requiere un margen bruto previo de al menos `2.8` sin el ajuste por faltas; el no favorito usa la misma fórmula con `+1.5`. En `total_goals`, goles concedidos rival `>=1.2` da 25 y `errors >=1` rival da 20 en sustitución de H2H. El score usa xG combinado si ambos xG existen; si no, goles combinados solo si ambos promedios existen. En `team_goals`, urgencia reemplaza conversión. Para `total_corners OVER`, confirmación: 30 puntos si la proyección supera el gate y 25 si tiros a puerta + bloqueados combinados `>=10`; respaldo: centros combinados `>=10` dan 20, pases en campo contrario combinados `>=350` dan 15 y disparos totales combinados `>=30` dan 10. Son proxies ofensivos, no córners concedidos.

Todas las métricas empleadas deben ser promedios `season_to_date`. Las categorías que requieran una estadística sin campo definido se sustituyen únicamente donde se indica arriba; los demás datos requeridos faltantes hacen el candidato `not_evaluable`.

### Penalizaciones, orden y elegibilidad

- Faltas combinadas `>=26`: `-5` puntos; además `+0.5` al colchón de córners, goles totales, goles individuales y `asian_handicap`.
- Cada ausencia que cumpla simultáneamente `is_structural=true`, `starter=true` y `confirmation=confirmed`: `-10` puntos, con tope acumulado de `-25` por partido.
- Portero rival con `goals_prevented >=1.20`: `-15` solo a `total_goals OVER`, `team_goals OVER` y `simple_win`.
- `big_chances_missed >=2.0`: restar `-10` directamente al subtotal normalizado de confirmación ofensiva. Se usa suma de ambos equipos en `total_goals`/`total_corners`, equipo elegido en `team_goals`, favorito en victoria/hándicap. No se aplica a doble oportunidad. Las otras penalizaciones se restan directamente del score final.

Orden estricto por candidato: validar muestra y datos; calcular score neto; si `score < 50`, estado `REJECT` terminal, sin fallback; luego exigir score `>=50` y evaluar gates y colchón/MOP. Para ser elegible se requieren score `>=50` y todos los gates aprobados. Cada línea generada o fallback recalcula score, penalizaciones y colchón usando solo los datos estadísticos y de contexto del expediente; solo candidatos que vuelven a superar score y gates son `ELIGIBLE`. Si faltan datos requeridos, el estado es `not_evaluable`.

Fallback: solo para un candidato `OVER` con score `>=50` cuyo colchón/MOP no permite el objetivo, primero se reduce la línea `0.5` en el mismo mercado. Se recalculan score, penalizaciones, gates y colchón. Si el score recalculado es `<50`, el resultado es `REJECT` terminal y no hay fallback. Con score `>=50`, la línea reducida solo se recomienda si pasa todos los gates; si falla el colchón/MOP o algún gate, se intenta `double_chance` vinculada al equipo con mayor `net_xg`: home produce `1X`, away produce `X2`; empate exacto no produce candidato. Este fallback no tiene cuota ni precio. No se cambia a otras categorías ni se crea fallback AH artificial. Una puntuación `<50` en cualquier paso es rechazo terminal, sin fallback.

## Endpoint proxy Gemini local

`POST /api/v1/gemini/justifications` se sirve desde un proceso Node local que escucha exclusivamente en `127.0.0.1:4174`; Vite reenvía `/api` a ese proceso. No requiere autenticación por su binding loopback y no habilita CORS público. Si se envía `Origin`, debe coincidir exactamente con `http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:5174` o `http://localhost:5174`; solicitudes directas sin `Origin` siguen permitidas. El endpoint requiere `Content-Type: application/json` (se admiten parámetros como `charset`). El navegador envía únicamente `{ "input": MatchInput }`; el servidor valida con `parseMatchInput`, vuelve a ejecutar `analyzeMatch` y deriva por sí mismo los candidatos `ELIGIBLE`. Cualquier campo adicional en el body se rechaza. El cliente no tiene autoridad para definir elegibilidad.

El body tiene la forma `{ "input": MatchInput }`, donde `input` contiene el objeto JSON v1 completo descrito arriba. El análisis determinista del navegador es local; al solicitar justificaciones opcionales, ese expediente se envía al servidor local para validación y recálculo. Gemini solo recibe las métricas numéricas mínimas de candidatos elegibles documentadas aquí, sin nombres ni expediente completo.

Si no hay candidatos elegibles, responde HTTP `200` con `{ "contract_version": "1.0", "justifications": [] }`, incluso si falta la clave, y no llama al proveedor. Para candidatos elegibles, el servidor requiere `process.env.GEMINI_API_KEY` y usa `process.env.GEMINI_MODEL` (por defecto `auto`, que prueba `gemini-3.8-flash` y después `gemini-3.5-flash-lite`). El payload contiene únicamente ID opaco de candidato, mercado, selección, equipo cuando aplique, línea generada cuando aplique, score, gates, proyección, MOP y métricas numéricas requeridas/referenciadas. Excluye precios, nombres, competición, entrada cruda, comentarios, texto libre y candidatos no elegibles. No registra ni persiste expediente, request, respuesta o clave. El prompt trata todos los datos como no confiables y limita la salida a justificaciones cualitativas en español, sin cifras, hechos añadidos, picks ni decisiones.

Hay una sola llamada REST `generateContent` con `x-goog-api-key`, schema JSON cerrado, timeout y límites de tamaño. La llamada se cancela también si el cliente cierra la conexión antes de completar la respuesta. La respuesta del proveedor se valida íntegramente: versión, forma exacta, correspondencia uno-a-uno con candidatos elegibles, IDs de métricas enviados y narrativa acotada sin cifras. Internamente se usan IDs de candidato opacos; no se crean IDs de cotización. La UI toma selección, equipo, línea recomendada, score y elegibilidad del motor local, nunca de narrativa, y muestra automáticamente la línea generada. El payload de Gemini no contiene datos de cuotas o precios.

Respuesta JSON, validada contra schema cerrado (`additionalProperties: false`). Gemini justifica cada candidato recibido; no escoge uno ni emite veredicto:

```json
{
  "contract_version": "1.0",
  "justifications": [
    {
      "candidate_id": "string",
      "narrative": "string",
      "referenced_metric_ids": ["string"]
    }
  ]
}
```

Cada `candidate_id` de respuesta corresponde al candidato elegible enviado y aparece exactamente una vez; `referenced_metric_ids` debe ser subconjunto de los IDs enviados. Un fallo de validación descarta toda la respuesta IA y no modifica análisis local. La acción de solicitar justificaciones es explícita y no forma parte del botón de análisis determinista.

Errores JSON uniformes, sin cuerpo de proveedor ni secretos:

```json
{
  "error": {
    "code": "INVALID_REQUEST|PAYLOAD_TOO_LARGE|RATE_LIMITED|UPSTREAM_UNAVAILABLE|UPSTREAM_TIMEOUT|INVALID_MODEL_RESPONSE|INTERNAL_ERROR",
    "message": "Mensaje seguro y accionable",
    "request_id": "string|null",
    "field_errors": [{ "path": "string", "code": "string" }]
  }
}
```

Mapeo: `400` request/JSON/schema u origen inválido; `413` cuerpo demasiado grande; `429` límite de solicitudes local; `502` proveedor inaccesible o respuesta IA inválida; `503` configuración del proveedor ausente; `504` timeout; `500` error interno. Los errores son genéricos, sin cuerpo del proveedor ni secretos.

## Privacidad y pruebas

- Enviar al modelo solo el contexto de análisis necesario; no enviar credenciales, nombres de jugadores, ni datos identificables que no sean necesarios. No registrar cuerpos de request/response ni la clave; los logs operativos usan códigos y `request_id`.
- La clave Gemini es exclusivamente configuración del servidor, nunca constante, respuesta, bundle ni variable pública. El almacenamiento, retención, autenticación, límites operativos y consentimiento requieren decisión de producto/infraestructura; este contrato no los presupone.
- Probar sin conexión externa mediante un cliente Gemini simulado: justificaciones válidas, JSON/schema inválido, candidato no elegible, métricas referenciadas inexistentes, timeout, error y rate limit. Verificar que Gemini nunca seleccione ni cambie métricas, score, gates o elegibilidad y que el resultado local sobreviva a fallo IA.
- Probar el parser con JSON malformado, propiedades desconocidas (incluidas cuotas heredadas), equipos/lados duplicados, tipos/unidades inválidos y valores ausentes; comprobar que faltante produce `not_evaluable` y no cero. Probar favorito asiático derivado de net xG y el caso de empate/datos insuficientes.
- El ejemplo sintético de este documento puede ser fixture de parser. No usarlo como fixture de picks o validación matemática. Las pruebas matemáticas requieren vectores aprobados por Product Owner.

## Supuestos y QA

Supuestos: matrices 50/50 se reescalan proporcionalmente a 55/45; campos históricos ausentes se sustituyen solo como especifica la tabla; `chances_created` aproxima ocasiones claras; el respaldo de córners usa proxies de centros, pases en campo contrario y disparos totales; `1.1 < MOP < 1.2` conserva un paso; cada paso equivale a `0.5`; urgencia asiática ausente vale `0`; faltas añaden `0.5` al colchón asiático; doble oportunidad requiere localía; un empate de `net_xg` no produce fallback DC. La fórmula AH simétrica para favorito y no favorito es el supuesto determinista aprobado por este contrato.

**Fuentes de prueba/ejemplo:** `Partido.txt` es la fuente estadística de Lille–Galatasaray; cualquier cuota presente en el TXT se excluye del JSON de entrada y no participa en el análisis. `Prueba-partido.txt` es material de prueba, no entrada canónica. Las fechas sin zona horaria se registran como `null`; se conservan la procedencia y los valores ausentes. Los archivos TXT no se leen en runtime.

## Implementación local

El editor, parser JSON v1, comparación y motor determinista para seis categorías permanecen en el frontend. La API local comparte parser y motor, y solo hace una llamada externa a Gemini tras una acción explícita sobre candidatos elegibles; el botón de análisis determinista nunca invoca IA. Ejecutar en terminales separadas `npm run api` y `npm run dev`. `GEMINI_API_KEY` y `GEMINI_MODEL` pertenecen solo al proceso API; `.env.example` documenta los nombres, pero no se carga automáticamente ni contiene secretos. Todo el análisis de mercados y líneas se calcula desde los datos estadísticos/contextuales, sin recibir, inferir ni usar cuotas.

Debe respetar estos pesos, penalizaciones, MOP, fallback, gates y separación de Gemini; datos incompletos se presentan como `not_evaluable`, nunca como recomendación.

## Alineación y handoff

El contrato prioriza este alcance sobre discrepancias de `Colchones/`; sus matrices aportan umbrales legacy, adaptados y normalizados como se declara arriba. No se define persistencia ni SQL. Debe revisarse la configuración del proveedor antes de solicitudes con candidatos elegibles; sin candidatos, la API funciona sin clave.