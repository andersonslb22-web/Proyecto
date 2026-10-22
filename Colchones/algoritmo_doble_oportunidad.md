# Modelo de Análisis: Doble Oportunidad (1X o X2)

El mercado de **Doble Oportunidad (1X o X2)** representa el escudo protector definitivo en la aplicación. Al cubrir dos de tres resultados posibles (**Victoria o Empate**), la probabilidad implícita de acierto aumenta drásticamente. Sin embargo, debido a que las cuotas de este mercado son sustancialmente más ajustadas, el sistema debe aplicar una rigurosidad matemática elevada para validar las selecciones, garantizar el valor esperado positivo ($+EV$) y preservar la rentabilidad global.

---

## ⚖️ El Colchón de Doble Oportunidad: Margen de Imbatibilidad (+0.15)

Para habilitar una Doble Oportunidad, el sistema no busca un equipo aplastante, sino un equipo sumamente **difícil de derrotar en su contexto actual**.

* **Configuración del Colchón:** Se establece un **Margen de Imbatibilidad de +0.15** sobre la métrica de $xG$ Neto del equipo analizado frente a su rival, sumado a la ponderación del factor localía, solidez defensiva y urgencia de puntos.

* **Regla en el Software:**
  
  $$
  \text{Diferencial de Resistencia} = \text{xG Neto}_{\text{Equipo}} + \text{Factor Localía} - \text{xG Neto}_{\text{Rival}} \ge +0.15
  $$

  * Si el equipo analizado iguala o supera la diferencia de $xG$ Neto del rival en su contexto (Local/Visitante) ajustado por un margen mínimo de $+0.15$, la recomendación de Doble Oportunidad pasa el filtro matemático inicial.

---

## 📑 Variables de Mapeo para Doble Oportunidad

*Caso de Estudio:* **Lille (1X)** vs. **Galatasaray** (Cuota de Mercado 1X: $1.36$)

### 🟢 1. Datos que CONFIRMAN el Pick (Inmuno-Defensa, Urgencia y Localía)

* **Invencibilidad Reciente en Casa (Tasa de Derrotas $< 25\%$):** Escaneo de los últimos partidos del local.
  * *Lille (en casa):* 1-1 vs Brest, 1-0 vs Le Havre, 2-1 vs Waregem, 2-0 vs Troyes, 2-3 vs Real Betis.
  * *Tasa de Derrota:* 1 derrota en 5 partidos ($20\%$ de probabilidad de pérdida) $\rightarrow$ **CUMPLE**.

* **Capacidad de Neutralización Defensiva:**
  * *Lille:* Proyecta $\le 0.9$ goles recibidos por partido ($0.7$ goles/partido encajados en promedio). Muestra estructura defensiva sólida.

* **Portero Salvador:**
  * *Ozer (Lille):* Métrica de $+1.52$ **Goles Evitados**. Factor determinante para sostener empates en tramos críticos.

* **Urgencia Contextual y Motivacional (Puntos / Clasificación):**
  * *Lille:* Necesidad crítica de sumar puntos en la jornada actual para asegurar clasificación a fase eliminatoria.

### 🟡 2. Datos que RESPALDAN el Pick (Vulnerabilidad y Empates del Rival)

* **Dificultad del Rival para Ganar Fuera de Casa:**
  * *Galatasaray (salidas recientes):* 0-1 vs Genclerbirligi (W), 3-3 vs Pendikspor (D), 4-0 vs Trabzonspor (L), 3-1 vs Sporting CP (L), 2-3 vs Başakşehir (W).
  * *Efectividad:* Solo el $40\%$ de sus salidas concluyen en victoria (el $60\%$ son empates o derrotas).

* **Tendencia de Igualdades y Empates (H2H / Contexto):**
  * *Galatasaray:* Un $30\%$ de sus partidos como visitante terminan en empate frente a rivales de nivel similar.

* **Errores Fatales Conducidos a Gol:**
  * *Galatasaray:* 2 errores graves directos a gol en el periodo reciente.

### 🔴 3. Datos que PENALIZAN el Pick (Alertas de Quiebre)

* **Eficiencia Ofensiva Masiva del Rival:**
  * *Galatasaray:* Promedio de $2.1$ goles/partido y $2.33\text{ }xG$. Riesgo latente de quiebre defensivo.

* **Falta de Gol del Local:**
  * *Lille:* Promedia $1.4$ goles por partido (mantiene una capacidad aceptable de reacción).

---

## 🧮 Matriz de Puntuación Ponderada (Máximo 100 Puntos)

### 🟢 Bloque de Seguridad Defensiva, Urgencia y Localía (Hasta 55 Pts)

* **Tasa de Resistencia en Casa (H2H Contextual):**
  * Tasa de derrota $< 25\%$ $\rightarrow$ **20 pts**
  * Tasa de derrota entre $26\%$ y $40\%$ $\rightarrow$ **10 pts**
  * *Evaluación Lille:* $20\%$ de derrotas $\rightarrow$ **20 pts**

* **Urgencia Contextual (Necesidad de Puntos en Clasificación):**
  * Urgencia alta / Fase decisiva de torneo $\rightarrow$ **10 pts**
  * Urgencia media $\rightarrow$ **5 pts**
  * *Evaluación Lille:* Necesidad crítica de clasificar $\rightarrow$ **10 pts**

* **Solidez de la Estructura Baja:**
  * $\text{Goles Encajados (Local)} \le 0.9$ $\rightarrow$ **12 pts**
  * *Evaluación Lille:* $0.7$ encajados/juego $\rightarrow$ **12 pts**

* **Nivel de Rescate del Arquero:**
  * $\text{Goles Evitados (Portero)} \ge +1.0$ $\rightarrow$ **13 pts**
  * *Evaluación Ozer:* $+1.52$ $\rightarrow$ **13 pts**

> **Subtotal Confirmación:** **55 pts**

---

### 🟡 Bloque de Debilidad y Tendencia al Empate del Visitante (Hasta 45 Pts)

* **Tasa de No-Victoria del Visitante Fuera de Casa:**
  * Visitante empata o pierde en el $\ge 50\%$ de sus salidas $\rightarrow$ **20 pts**
  * *Evaluación Galatasaray:* Empata/pierde en el $60\%$ de sus juegos $\rightarrow$ **20 pts**

* **Propensión al Empate Contextual:**
  * Tasa de empates del visitante fuera de casa $\ge 25\%$ $\rightarrow$ **10 pts**
  * *Evaluación Galatasaray:* $30\%$ de empates fuera de casa $\rightarrow$ **10 pts**

* **Pérdidas de Balón del Rival:**
  * Rival pierde $\ge 115.0$ balones/partido $\rightarrow$ **15 pts**
  * *Evaluación Galatasaray:* $120.6$ balones perdidos/partido $\rightarrow$ **15 pts**

> **Subtotal Respaldo:** **45 pts**
>
> **Total Acumulado Inicial:** **100 pts**

---

### 🔴 Modificadores de Penalización y Modificador Dinámico por Fricción (Restas Directas)

* **Poder Absoluto de Fuego Rival:**
  * Rival promedia $\ge 7.0$ tiros a puerta y $xG > 2.0$ $\rightarrow$ **-15 pts**
  * *Evaluación Galatasaray:* $7.6$ tiros a puerta y $2.33\text{ }xG$ $\rightarrow$ **-15 pts**

* **Bajas Críticas en la Zaga:**
  * Ausencias confirmadas en la línea defensiva $\rightarrow$ **-10 pts**
  * *Evaluación Lille:* Baja de Tiago Santos $\rightarrow$ **-10 pts**

* **Modificador Dinámico por Fricción y Tarjetas (Alta Interrupción):**
  * Promedio de faltas combinadas $\ge 26.0$ o árbitro con promedio $\ge 5.0$ tarjetas/partido $\rightarrow$ Aumenta la inestabilidad del bloque defensivo $\rightarrow$ **-5 pts**
  * *Evaluación Partido:* Faltas combinadas $27.2$ por partido $\rightarrow$ **-5 pts**

---

## 📈 Filtro Financiero: Cuota Mínima Viable y Valor Esperado (+EV)

Para evitar la aprobación de cuotas infladas o desprovistas de valor matemático, el sistema aplica una validación financiera posterior al cálculo del score de confianza.

$$
\text{Probabilidad Implícita} = \frac{1}{\text{Cuota de Mercado}}
$$

$$
\text{Filtro +EV:} \quad \text{Score de Confianza (\%)} > \text{Probabilidad Implícita} + 5\% \text{ (Margen de Valor)}
$$

* **Ejemplo Lille (1X):**
  * Cuota de Mercado para 1X: $1.36$
  * Probabilidad Implícita: $\frac{1}{1.36} = 73.5\%$
  * Umbral Mínimo de Confianza Requerido: $73.5\% + 5\% = 78.5\%$

---

## 📊 Corrida del Algoritmo: Lille (Doble Oportunidad: 1X)

### 1. Prueba del Colchón de $xG$ Neto y Resistencia
* A pesar de que Galatasaray posee un $xG$ neto ligeramente superior ($+0.93$ vs. $+0.80$), la corrección por factor localía del Lille, la urgencia de puntos y su tasa defensiva ($0.7$ encajados) absorben el margen mínimo requerido de $+0.15$ en resistencia.
* **Resultado del filtro:** **APROBADO** 🟢

### 2. Cálculo del Score Final Neto

$$
\begin{aligned}
\text{Score Final} &= \text{Subtotal Confirmación} + \text{Subtotal Respaldo} - \text{Penalizaciones} \\
&= 55 + 45 - 15 - 10 - 5 \\
&= \mathbf{70 \text{ Puntos (70\% de Confianza)}}
\end{aligned}
$$

### 3. Evaluador de Valor Esperado (+EV)
* **Score Calculado:** $70\%$
* **Umbral Requerido por Mercado (Cuota 1.36):** $78.5\%$
* **Evaluación:** $70\% < 78.5\%$ $\rightarrow$ ❌ **Falla el Filtro de Cuota Viable (+EV)**.

---

## 🔥 Veredicto Final del Sistema

```text
[SISTEMA]: PICK BLOQUEADO (FALTA DE VALOR / CUOTA BAJA) ⚠️
Mercado: Doble Oportunidad (1X - Gana o Empata Lille)
Score de Confianza Analítico: 70%
Cuota de Mercado: 1.36 (Probabilidad Implícita: 73.5%)

Resumen Ejecutivo:
El análisis táctico y estadístico ratifica la solidez de Lille en casa y su urgencia de puntos. 
Sin embargo, el score ajustado (70%), penalizado por la alta fricción del partido y el poder ofensivo rival, 
no supera el umbral de rentabilidad (+EV) exigido para una cuota de 1.36 (requería 78.5% mínimo).

Acción Automática Backend:
• Se descarta la entrada en Doble Oportunidad 1X por falta de margen de valor esperado.
• Se sugiere evaluar mercados correlacionados de mayor valor (ej. Ambos Anotan - BTTS).
```