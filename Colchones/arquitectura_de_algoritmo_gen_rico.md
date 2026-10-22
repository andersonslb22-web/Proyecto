# 🏛️ Arquitectura General del Algoritmo (Modelo de Pesos V2)

El Porcentaje Final de Confianza para cualquier *pick* o mercado deportivo (*1X2 / A ganar, Más/Menos Goles Totales o Individuales, Hándicap Asiático, Doble Oportunidad, etc.*) se calcula mediante la evaluación ponderada de métricas clave, respaldos de contexto y un filtro de riesgo final.

$$\text{Porcentaje Final} = \left(\text{Base Estadística} + \text{Respaldos Contextuales}\right) - \text{Penalizaciones}$$

---

## 🟢 Paso 1: Base Estadística (Máximo 60 Puntos)

Es el motor cuantitativo. Mide si el histórico reciente y las métricas brutas de ambos equipos justifican la línea del mercado seleccionado. Se divide en tres subcategorías parametrizables:

| Subcategoría | Puntuación Máx. | Descripción / Configuración Paramétrica |
| :--- | :---: | :--- |
| **1. Métrica Primaria (Línea Principal)** | **30 pts** | Evalúa el indicador directo del mercado (*Ej. Promedio de goles, volumen de córners, promedio de puntos/tiros a puerta*). <br>• **Rango Alto:** Cumple/Supera con amplio margen el umbral del mercado $\rightarrow$ **30 pts**<br>• **Rango Medio:** Supera ajustadamente o dentro del límite $\rightarrow$ **15 pts**<br>• **Rango Bajo:** Por debajo del umbral mínimo $\rightarrow$ **0 pts** |
| **2. Métrica Secundaria (Volumen de Generación/Intensidad)** | **20 pts** | Evalúa las acciones previas que provocan la Métrica Primaria (*Ej. Tiros totales, remates al arco, posesión en campo rival, llegadas al área*). <br>• **Rango Alto:** Muestra un volumen de juego dominante o acelerado $\rightarrow$ **20 pts**<br>• **Rango Medio:** Volumen moderado $\rightarrow$ **10 pts**<br>• **Rango Bajo:** Juego pasivo o escaso volumen de ataque/defensa $\rightarrow$ **0 pts** |
| **3. Métricas Complementarias (Soporte Táctico/Fricción)** | **10 pts** | Combina 2 indicadores indirectos de apoyo (5 pts c/u) (*Ej. Centros y disparos bloqueados para córners; Pases clave y recuperaciones en zona alta para goles/ganar*). <br>• **Métrica Complementaria A:** Cumple umbral $\rightarrow$ **5 pts**<br>• **Métrica Complementaria B:** Cumple umbral $\rightarrow$ **5 pts** |

---

## 🟡 Paso 2: Respaldos Contextuales (Máximo 40 Puntos)

Evalúa los factores cualitativos, motivacionales y de alineación táctica que empujan a que la estadística se cumpla en la situación particular de la jornada.

| Factor Contextual | Puntuación Máx. | Criterio de Activación Paramétrico |
| :--- | :---: | :--- |
| **1. Factor Urgencia / Situación de Tabla** | **15 pts** | Analiza la necesidad del resultado según la ronda y la tabla. <br>• **Alta Necesidad:** Ambos equipos o el favorito necesitan ganar sí o sí (*Ej. Eliminatoria, pelear descenso, clasificar a copas en últimas fechas*) $\rightarrow$ **15 pts**<br>• **Necesidad Media / Neutral:** Fecha regular de liga $\rightarrow$ **7 pts** |
| **2. Estilo de Juego / Matriz Táctica** | **15 pts** | Evalúa la compatibilidad de estilos entre los dos rivales. <br>• **Incompatibilidad/Compatibilidad Perfecta:** El estilo del equipo A explota la debilidad del equipo B (*Ej. Equipo vertical vs. defensa adelantada para Goles/Hándicap; equipo encarador vs. laterales débiles*) $\rightarrow$ **15 pts**<br>• **Compatibilidad Parcial:** $\rightarrow$ **7 pts** |
| **3. Calidad de Oportunidad / Métrica Expectativa ($xG, xGA, xPTS$)** | **10 pts** | Evalúa las métricas de expectativa avanzada. <br>• **Umbral Sólido:** $xG$ proyectado alto (para altas/favoritos) o $xGA$ sólido (para bajas/hándicap defensivo) $\rightarrow$ **10 pts** |

---

## 🔴 Paso 3: Filtro de Penalizaciones (Restas Directas al Porcentaje)

Factores de riesgo o anomalías que restan porcentaje acumulado de forma directa antes del veredicto final.

* **Condición de Juego Disruptiva (Interrupción o Ritmo Bloqueado):**
  * *Criterio:* Promedio de faltas combinadas, tarjetas rojas frecuentes o condiciones climáticas extremas que interfieren con la fluidez del evento.
  * *Penalización:* **$-10\%$ al $-15\%$**
* **Bajas Críticas de Plantel (Ausencias Clave):**
  * *Criterio:* Escaneo de lesionados o sancionados en posiciones estructurales para la apuesta (*Ej. Delantero estrella para mercado de victorias/goles; portero titular o central defensivo para hándicaps o bajas*).
  * *Penalización:* **$-15\%$ por cada baja crítica confirmada**

---

## ⚙️ Ejemplos de Configuración Paramétrica por Mercado

Para adaptar este modelo genérico en el software, se debe ajustar la **plantilla de métricas** según el objetivo:

### 1. Mercado: "A Ganar / 1X2" o "Hándicap Asiático Favorito"
* **Métrica Primaria (30 pts):** % de victorias locales/visitantes recientes y diferencial de goles promedio ($> +1.5$).
* **Métrica Secundaria (20 pts):** Disparos a puerta a favor vs. Disparos recibidos.
* **Métricas Complementarias (10 pts):** % Posesión en campo rival (5 pts) + Eficiencia de conversión (5 pts).
* **Respaldos Contextuales (40 pts):** Rendimiento H2H (Histórico directo), necesidad de puntos en tabla y diferencial de $xPTS$ (Puntos Esperados).
* **Penalizaciones:** Baja del creador de juego, defensa central líder o portero titular.

### 2. Mercado: "Alta Total de Goles (Over Goles)"
* **Métrica Primaria (30 pts):** Promedio combinado de goles esperados/anotados por partido ($> 2.8$ goles).
* **Métrica Secundaria (20 pts):** Disparos totales combinados y grandes ocasiones creadas por partido.
* **Métricas Complementarias (10 pts):** Pases al área rival (5 pts) + Concesión de disparos de la defensa rival (5 pts).
* **Respaldos Contextuales (40 pts):** $xG$ combinado de ambos equipos $> 2.2$, necesidad de ambos por sumar y tendencia de partidos abiertos.
* **Penalizaciones:** Ausencia del goleador principal o planteamiento defensivo de bloque bajo.