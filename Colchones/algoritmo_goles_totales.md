# ⚽ Algoritmo de Goles Totales (Over/Under - Colchón de Varianza +1.2)

Este documento define la arquitectura lógica, matemática y paramétrica para evaluar el mercado de **Goles Totales (Over/Under)** utilizando un **Colchón de Varianza de +1.2 goles**, integrando análisis de fricción, evaluador +EV y degradación automática.

---

## 🛡️ 1. Definición de la Línea Blindada (+1.2 Goles)

Para el mercado de goles totales (Línea Base $1.5$ goles), se establece un **Colchón de Varianza de $+1.2$ goles**.

* **Lógica del Colchón:** Sumado a la línea base ($1.5$), la sumatoria combinada de promedios de goles y/o $xG$ de ambos equipos debe alcanzar un mínimo de **$2.70$ goles por partido** para aprobar el filtro de entrada.

$$
\text{Línea Blindada Requerida} = \text{Línea Base (1.5)} + \text{Colchón de Varianza (1.2)} = \mathbf{2.70 \text{ Goles/xG}}
$$

* **Prueba del Colchón (Caso Lille vs. Galatasaray):**
  * *Promedio Goles Lille (Local):* $1.4$
  * *Promedio Goles Galatasaray (Visitante):* $2.1$
  * *Ajuste por Urgencia Contextual:* $+0.20$ (Urgencia combinada de tabla)
  * *Sumatoria Real Ajustada:* $1.4 + 2.1 + 0.20 = \mathbf{3.70 \text{ Goles}}$

$$
3.70 \ge 2.70 \quad \checkmark \text{ (APROBADO CON HOLGURA)}
$$

---

## 📑 2. Variables de Mapeo para el Algoritmo

### 🟢 1. Datos que CONFIRMAN el Pick (Volumen Ofensivo y Urgencia)
* **Suma de $xG$ Combinado + Urgencia Contextual:**
  * Lille ($1.50$) + Galatasaray ($2.33$) = $3.83\ xG$ combinado $\rightarrow$ **Confirmación Total**.
* **Disparos a Puerta Efectivos:**
  * Lille ($5.4$) + Galatasaray ($7.6$) = $13.0$ remates al arco por partido (Requerido: $\ge 10.0$).
* **Grandes Ocasiones Generadas:**
  * Lille ($2.6$) + Galatasaray ($4.1$) = $6.7$ ocasiones claras por juego (Requerido: $> 5.0$).

### 🟡 2. Datos que RESPALDAN el Pick (Permisividad Defensiva)
* **Fragilidad Defensiva y Bajas:**
  * Galatasaray concede $1.4$ goles/partido fuera de casa y registra valor negativo en goles evitados ($-2.08$).
* **Errores Defensivos Graves:**
  * Lille ($8$) + Galatasaray ($7$) = $15$ errores defensivos directos acumulados.

### 🔴 3. Datos que PENALIZAN el Pick (Alertas de Bloqueo y Fricción)
* **Portero Rival en Estado de Gracia:**
  * Ozer (Lille) registra $+1.52$ goles evitados $\rightarrow$ **Resta Puntos**.
* **Exceso de Ocasiones Falladas:**
  * Suma combinada de $4.8$ ocasiones claras desaprovechadas por partido.
* **Fricción por Faltas y Faltas Tácticas:**
  * Promedio de $27.2$ faltas combinadas por partido $\rightarrow$ **Penalización por Interrupción de Ritmo**.

---

## 🧮 3. Matriz de Puntuación Ponderada (Máximo 100 Puntos)

### 🟢 Bloque de Confirmación Ofensiva y Contexto (Hasta 55 Pts)
* **Volumen de $xG$ Combinado y Goles ($\ge 3.2$):** **25 pts** *(Evaluación: 3.83 xG $\rightarrow$ 25 pts)*
* **Tiros a Puerta ($\ge 10.0$) y Ocasiones Claras ($\ge 5.0$):** **15 pts** *(Evaluación: 13 tiros y 6.7 ocasiones $\rightarrow$ 15 pts)*
* **Urgencia Contextual (Necesidad Muto de Puntos):** **15 pts** *(Evaluación: Necesidad alta $\rightarrow$ 15 pts)*

> **Subtotal Confirmación:** **55 pts**

### 🟡 Bloque de Respaldo por Permisividad Defensiva (Hasta 45 Pts)
* **Goles Concedidos y Errores Directos a Gol:** **25 pts** *(Evaluación: Galatasaray concede 1.4 y 15 errores $\rightarrow$ 25 pts)*
* **Tendencia H2H y Partidos Idas y Vueltas:** **20 pts** *(Evaluación: Frecuencia de Over 2.5 alta $\rightarrow$ 20 pts)*

> **Subtotal Respaldo:** **45 pts**  
> **Total Acumulado Inicial:** **100 pts**

### 🔴 Modificadores de Penalización y Fricción (Restas Directas)
* **Portero en Racha ($\text{Goles Evitados} \ge +1.20$):** **-15 pts** *(Aplica: Ozer $+1.52$)*
* **Ocasiones Claras Falladas ($\ge 4.0$):** **-10 pts** *(Aplica: 4.8 falladas)*
* **Modificador Dinámico por Fricción (Faltas $\ge 26.0$):** **-5 pts** *(Aplica: 27.2 faltas)*

---

## 🔄 4. Escalabilidad de Mercado (MOP) y Filtro Financiero (+EV)

### 1. Cálculo del Margen de Over-Perform ($\text{MOP}$):

$$
\text{MOP} = \text{Sumatoria Real Ajustada} - (\text{Línea Base} + \text{Colchón})
$$

$$
\text{MOP} = 3.70 - (1.5 + 1.2) = 3.70 - 2.70 = \mathbf{+1.00}
$$

#### Regla de Negocio para Escalabilidad de Línea:
* $0.00 \le \text{MOP} \le 0.49 \implies$ Mantener línea base (**Over 1.5 Goles**).
* $0.50 \le \text{MOP} \le 1.19 \implies$ **Escalar 1 nivel (Over 2.5 Goles)** *(Aplica: MOP = +1.00)*.
* $\text{MOP} \ge 1.20 \implies$ **Escalar 2 niveles (Over 3.5 Goles)**.

---

### 2. Evaluador Financiero de Valor Esperado (+EV)

$$
\text{Filtro +EV:} \quad \text{Score de Confianza (\%)} > \left(\frac{1}{\text{Cuota}}\right) + 5\%
$$

* **Cálculo del Score Final Neto:**

$$
\text{Score Final} = 55 + 45 - 15 - 10 - 5 = \mathbf{70\text{ Puntos (70\% Confianza para Over 2.5)}}
$$

* **Evaluación de Cuota para Over 2.5 (Cuota promedio 1.80 / 55.5% Implícita):**
  * *Requerido +EV:* $55.5\% + 5\% = \mathbf{60.5\%}$
  * *Evaluación:* $70\% > 60.5\%$ $\rightarrow$ 🟢 **APROBADO CON VALOR MATEMÁTICO (+EV)**.

---

## 🔥 5. Veredicto Final y Fallback del Sistema

```
[SISTEMA]: PICK RECOMENDADO CON VALOR MATEMÁTICO (+EV)
Mercado Target: Over 2.5 Goles Totales
Score de Confianza: 70%
Margen MOP: +1.00 (Línea Mínima 1.5 escalada a Over 2.5)
Cuota Evaluada: 1.80 (Probabilidad Implícita: 55.5% | Umbral +EV: 60.5%)

Diagnóstico:
El potencial ofensivo combinado (xG 3.83, 13 tiros a puerta) supera holgadamente el colchón requerimiento. 
A pesar de la sólida actuación del guardameta local y las 27.2 faltas esperadas, la fragilidad defensiva 
del Galatasaray garantiza un volumen alto de concesión de oportunidades.

Mecanismo de Fallback (Si la Cuota cae por debajo de 1.60 o aumenta la fricción en alineaciones):
• Desescalar automáticamente a Línea Conservadora: Over 2.0 Goles Asiáticos [Score Proyectado: 88%]
• O bien migrar a: Ambos Equipos Anotan (BTTS - Sí) [Score Proyectado: 82%]

```