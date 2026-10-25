# 🚩 Algoritmo de Colchón Dinámico para Córners (Colchón Base +3.5)

Este documento conserva una propuesta histórica para el mercado de córners. **La regla ejecutable vigente está en `docs/CONTRATO_TECNICO.md`**: el motor solo genera `OVER`, no calcula +EV y no usa cuotas. La matriz de score vigente y los proxies de respaldo se aclaran en el Paso 4; los porcentajes y recomendaciones históricos de las secciones restantes no deben interpretarse como resultados actuales del motor.

## 🛡️ 1. Definición de la Línea Blindada

Para el mercado de córners, establecemos un **Colchón de Varianza Base de $+3.5$ córners**.

* **¿Por qué $+3.5$?** Proporciona un margen de protección amplio ante partidos trabados, posesiones estériles en el mediocampo o planteamientos defensivos conservadores.
* **Línea Blindada Requerida:** Si la línea mínima disponible en las casas de apuestas es $6.5$, la app suma el colchón ($+3.5$) más los ajustes por urgencia contextual. La sumatoria de promedios de ambos equipos deberá ser de mínimo **$10.0$ córners** para que el pick sea aprobado.

$$
\text{Línea Blindada Requerida} = \text{Línea Mínima (6.5)} + \text{Colchón de Varianza Base (3.5)} = \mathbf{10.0 \text{ Córners}}
$$

## 🔄 2. Integración Total: El Algoritmo Paso a Paso

El análisis se ejecuta en este orden secuencial para filtrar, ajustar la línea según el riesgo, aplicar el evaluador financiero y determinar la sugerencia final.

```
+-------------------------------------------------------+
|  Paso 1: Filtro de Entrada (Prueba del Colchón Base) |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|  Paso 2: Margen MOP (Escalabilidad / Ajuste de Línea) |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|  Paso 3: Modificador Dinámico (Fricción / Bajas)      |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|  Paso 4: Matriz de Score + Evaluador Financial (+EV)  |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|  Paso 5: Veredicto Final y Fallback (si aplica)       |
+-------------------------------------------------------+
```

### Paso 1: El Filtro de Entrada (Prueba del Colchón)

La app realiza la siguiente validación matemática previa a procesar métricas avanzadas:

$$
\text{Suma de Promedios} + \text{Ajuste Urgencia} \ge \text{Línea Mínima} + \text{Colchón Base}
$$

$$
10.8 + 0.2 \ge 6.5 + 3.5 \implies 11.0 \ge 10.0 \quad \checkmark \text{ (APROBADO)}
$$

> **Regla:** Si la suma ajustada de promedios no alcanza la Línea Blindada ($10.0$), la app descarta el pick de inmediato sin ejecutar pasos posteriores.

---

### Paso 2: Cálculo del Margen MOP (Escalabilidad de Línea)

Medimos el **Margen de Over-Perform ($\text{MOP}$)** para evaluar si la app mantiene la línea base conservadora o propone escalar a una línea superior:

$$
\text{MOP} = \text{Suma de Promedios Ajustada} - (\text{Línea Mínima} + \text{Colchón})
$$

$$
\text{MOP} = 11.0 - (6.5 + 3.5) = 11.0 - 10.0 = \mathbf{+1.0}
$$

#### Reglas de Negocio para Ajuste de Línea con Colchón $+3.5$:

* **$0.0 \le \text{MOP} \le 0.9 \implies$ Mantener Línea Mínima ($6.5$).** Máxima seguridad y conservación del pronóstico.
* **$1.0 \le \text{MOP} \le 1.9 \implies$ Escalar 1 nivel en el mercado ($7.5$).** *(Aplica en este caso: MOP $= +1.0$)*
* **$\text{MOP} \ge 2.0 \implies$ Escalar 2 niveles en el mercado ($8.5$).**

---

### Paso 3: Modificador Dinámico por Fricción y Bajas (Alertas de Penalización)

El colchón estándar de $+3.5$ se ajusta automáticamente incrementando la exigencia si se detectan banderas rojas en el partido:

* **Promedio de Faltas Combinadas $\ge 25.0 \implies$ El colchón sube a $+4.0$** (Línea requerida: $10.5$).
* **Baja Confirmada de Extremo/Winger titular $\implies$ El colchón sube a $+4.5$** (Línea requerida: $11.0$).

---

### Paso 4: Matriz de Puntuación Vigente y Notas Históricas

#### A. Puntuación vigente en el motor

El motor actual aplica una ponderación global `55/45`: 55 puntos normalizados para confirmación y 45 para respaldo. En `total_corners`, la matriz implementada es:

| Grupo | Factor | Puntos de matriz | Aporte máximo al score |
|---|---|---:|---:|
| Confirmación | La proyección supera el gate de córners | 30/30 | 30 puntos normalizados |
| Confirmación | Tiros a puerta + bloqueados combinados `>= 10` | 25/25 | 25 puntos normalizados |
| Respaldo | Centros combinados `>=10` | 20/20 | 20 puntos normalizados |
| Respaldo | Pases en campo contrario combinados `>=350` | 15/15 | 15 puntos normalizados |
| Respaldo | Disparos totales combinados `>=30` | 10/10 | 10 puntos normalizados |

**Respuesta sobre el respaldo:** el algoritmo actual sí asigna hasta 45 puntos de respaldo usando estos proxies ofensivos disponibles. No son córners concedidos ni ataques peligrosos directos; se muestran separados para no confundirlos con una medición defensiva. Con todos los umbrales, la confirmación suma `55/55` y el respaldo `45/45`, antes de penalizaciones.

La traza del score muestra cada factor, sus puntos de matriz y su aporte normalizado. Si faltan métricas necesarias, el score y su traza quedan como no evaluables; no se rellenan puntos.

#### B. Reglas históricas no usadas por el motor actual

Las referencias de versiones anteriores a una matriz `50/50`, “juego por bandas”, tendencia H2H, penalizaciones de extremos y filtro financiero `+EV` no forman parte del cálculo actual de córners. El motor no consume cuotas ni calcula +EV.

---

## 📊 Resumen de Ejecución para Lille vs. Galatasaray

* **Línea Mínima de Mercado:** `6.5`
* **Colchón Base Aplicado:** `+3.5`
* **Ajuste por Urgencia:** `+0.2`
* **Suma Real Combinada Ajustada:** `11.0` (Supera filtro de entrada de 10.0)
* **Margen MOP Calculado:** `+1.0` (Mapeado hacia Over 7.5 Córners)
* **Penalizaciones por Fricción/Bajas:** `0 pts` (Compatibilidad de bandas completa)
* **Score de confianza y +EV:** los valores `92%` y `92% > 59.0%` de la versión histórica no son resultados del motor actual. El score vigente se calcula con la matriz indicada en el Paso 4 y no usa cuotas.

---

## 🔥 Veredicto Final y Fallback del Sistema

```
[SISTEMA]: EJEMPLO HISTÓRICO; NO REPRESENTA EL VEREDICTO DEL MOTOR ACTUAL
Mercado Target: Over 7.5 Córners Totales
Score de Confianza: no usar el 92% histórico como resultado vigente
Margen MOP: +1.0 (Línea Mínima 6.5 escalada exitosamente a 7.5)
Cuotas / +EV: no se usan en el motor actual

Diagnóstico:
Ambos equipos presentan un flujo constante de centros y disparos bloqueados por partido. 
No se detectan faltas excesivas ni ausencias de extremos titulares.

Mecanismo de Fallback (Si la Cuota Sufre Caídas drásticas por debajo de 1.50):
• Desescalar automáticamente a Línea Conservadora: Over 6.5 Córners Totales [Score Proyectado: 98%]
```