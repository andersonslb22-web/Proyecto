# Modelo de Análisis: Victoria Simple (1 o 2)

En el mercado de **Victoria Simple (1 o 2)**, el algoritmo evalúa la firmeza y consistencia general de un equipo frente a otro en los 90 minutos. Al no existir una línea de goles prefijada, el "colchón" se define como un **Margen de Seguridad de Rendimiento Neto**.

---

## ⚖️ El Colchón de Victoria Simple: Margen de Rendimiento Neto (+0.40)

Para validar una victoria directa sin arriesgar capital en partidos de paridad táctica, el algoritmo aplica un **Margen de Seguridad de Rendimiento Neto de +0.40** sobre la diferencia de $xG$ Netos, ajustado por factores contextuales y motivacionales.

* **Cálculo del $xG$ Neto por Equipo:**

  $$
  \text{xG Neto} = \text{xG a Favor} - \text{xG en Contra}
  $$

* **Regla del Algoritmo:**

  $$
  \text{Diferencial de Rendimiento} = (\text{xG Neto}_{\text{Favorito}} + \text{Factor Localía/Urgencia}) - \text{xG Neto}_{\text{Rival}} \ge +0.40
  $$

  * Si el diferencial es **$< +0.40$**, el partido se considera cerrado. El sistema **rechaza la victoria directa** y activa la regla de *Fallback* (degradación hacia un mercado de cobertura).

---

## 📑 Variables de Mapeo para Victoria Simple

*Caso de Estudio:* **Lille** (Local, Cuota $+120$ / $2.20$) vs. **Galatasaray** (Visitante, Cuota $+210$ / $3.10$).

### 🟢 1. Datos que CONFIRMAN el Pick (Solidez General y Urgencia)

* **Fortaleza como Local y Urgencia de Puntos:**
  * *Lille:* Victorias recientes ante Le Havre (1-0), Waregem (2-1) y Troyes (2-0). Suma urgencia clasificatoria en tabla ($+0.10$ al diferencial).
* **Diferencia de Goles Reales por Partido:**
  * *Lille:* $1.4$ anotados vs. $0.7$ recibidos $= \mathbf{+0.7}$ **goles netos/partido**.
* **Rendimiento del Portero:**
  * *Ozer (Lille):* $+1.52$ **goles evitados**. Garantía bajo palos para amarrar la ventaja.

### 🟡 2. Datos que RESPALDAN el Pick (Vulnerabilidad del Rival)

* **Inestabilidad Defensiva Visitante:**
  * *Galatasaray:* Concede $1.4$ goles/partido fuera de casa. Derrotas abultadas recientes: 4-0 vs. Trabzonspor y 3-1 vs. Sporting CP. Acumula **2 errores graves que condujeron directamente a gol**.
* **Indisciplina del Rival:**
  * *Galatasaray:* 2 tarjetas rojas en la temporada (incrementa la probabilidad de concesión de espacios).

### 🔴 3. Datos que PENALIZAN el Pick (Alertas de Quiebre)

* **Poder de Fuego del Rival:**
  * *Galatasaray:* Proyecta un $xG$ de $2.33$ y anota $2.1$ goles/partido. Riesgo crítico de encajar un gol que anule la victoria simple 🚨.
* **Bajas Críticas en el Favorito:**
  * *Lille:* Ausencias confirmadas de Ethan Mbappé (sanción por roja) y Tiago Santos (lesión), afectando la estructura titular.

---

## 🧮 Matriz de Puntuación Ponderada (Máximo 100 Puntos)

### 🟢 Bloque de Eficiencia, Urgencia y Localía (Hasta 50 Pts)

* **Diferencia de Goles Netos (Anotados vs. Recibidos):**
  * $\ge +0.6 \text{ goles/partido}$ $\rightarrow$ **20 pts**
  * $+0.2 \text{ a } +0.59 \text{ goles/partido}$ $\rightarrow$ **10 pts**
  * *Evaluación Lille:* $+0.7$ netos $\rightarrow$ **20 pts**

* **Urgencia Contextual (Necesidad de Puntos / Tabla):**
  * Urgencia alta de sumar $\rightarrow$ **10 pts**
  * *Evaluación Lille:* Urgencia alta $\rightarrow$ **10 pts**

* **Seguridad bajo los Tres Palos (Goles Evitados):**
  * $\text{Goles Evitados} \ge +1.0$ $\rightarrow$ **20 pts**
  * *Evaluación Lille:* Ozer ($+1.52$) $\rightarrow$ **20 pts**

> **Subtotal Confirmación:** **50 pts**

---

### 🟡 Bloque de Vulnerabilidad del Rival (Hasta 50 Pts)

* **Rendimiento Defensivo del Visitante:**
  * Concede $\ge 1.3 \text{ goles/partido}$ $\rightarrow$ **25 pts**
  * *Evaluación Galatasaray:* Concede $1.4$ goles/partido $\rightarrow$ **25 pts**

* **Historial de Desatenciones (Errores a Gol):**
  * $\ge 1 \text{ error directo a gol}$ $\rightarrow$ **25 pts**
  * *Evaluación Galatasaray:* 2 errores registrados $\rightarrow$ **25 pts**

> **Subtotal Respaldo:** **50 pts**  
> **Total Acumulado Inicial:** **100 pts**

---

### 🔴 Modificadores de Penalización y Fricción (Restas Directas)

* **Ofensiva Temible del Oponente:**
  * Rival promedia $\ge 1.8 \text{ goles anotados}$ $\rightarrow$ **-35 pts**
  * *Evaluación Galatasaray:* $2.1$ goles anotados/partido $\rightarrow$ **-35 pts**

* **Bajas en el Once Titular del Favorito:**
  * Bajas confirmadas en puestos clave $\rightarrow$ **-15 pts**
  * *Evaluación Lille:* Bajas de E. Mbappé y T. Santos $\rightarrow$ **-15 pts**

* **Modificador Dinámico por Fricción (Interrupción de Juego):**
  * Promedio de faltas combinadas $\ge 26.0$ $\rightarrow$ **-5 pts**
  * *Evaluación Partido:* $27.2$ faltas combinadas $\rightarrow$ **-5 pts**

---

## 🔄 Escalabilidad de Mercado (Margen MOP) y Filtro Financiero (+EV)

### 1. Margen MOP (Escalabilidad a Hándicap -1.5)
Si el Diferencial de Rendimiento supera por amplio margen el colchón requerimiento, el sistema escala automáticamente a un mercado de mayor cuota:
* $\text{Diferencial} \ge +1.00 \implies$ **Escalar a Hándicap Asiático (-1.5)**.

### 2. Filtro Financiero de Valor Esperado (+EV)
$$
\text{Filtro +EV:} \quad \text{Score de Confianza (\%)} > \left(\frac{1}{\text{Cuota}}\right) + 5\%
$$
* *Para Lille a Cuota $2.20$ ($45.4\%$ prob. implícita):* Mínimo requerido = **$50.4\%$**.

---

## 📊 Corrida del Algoritmo: Lille (Victoria Simple)

### 1. Prueba del Colchón de $xG$ Neto
* **$xG$ Neto Lille Ajustado (Localía + Urgencia):** $+0.80 + 0.10 = \mathbf{+0.90}$
* **$xG$ Neto Galatasaray:** $\mathbf{+0.93}$
* **Diferencial de Rendimiento:** $+0.90 - (+0.93) = \mathbf{-0.03}$
* **Evaluación del Colchón ($+0.40$ Requerido):**
  $$-0.03 \ge +0.40 \quad \text{❌ RECHAZADO}$$

### 2. Cálculo del Score Final Neto
$$
\begin{aligned}
\text{Score Final} &= \text{Subtotal Confirmación} + \text{Subtotal Respaldo} - \text{Penalizaciones} \\
&= 50 + 50 - 35 - 15 - 5 \\
&= \mathbf{45 \text{ Puntos (45\% Confianza)}}
\end{aligned}
$$

### 3. Evaluador +EV
* **Score Calculado:** $45\%$ vs. **Mínimo Requerido por Cuota (2.20):** $50.4\%$
* **Resultado:** ❌ **Falla por falta de valor matemático y déficit en colchón.**

---

## 🔥 Veredicto Final y Fallback del Sistema

```text
[SISTEMA]: PICK PRINCIPAL DESECHADO (NO CUMPLE COLCHÓN NI +EV)
Score de Confianza: 45%
Diferencial de Rendimiento: -0.03 (Requerido: +0.40)
Cuota Evaluada: 2.20 (Probabilidad Implícita: 45.4% | Requerido con valor: 50.4%)

Razón:
El poder de fuego de Galatasaray (2.1 goles/partido, xG 2.33) liquida la ventaja de localía del Lille. 
El partido no ofrece garantías para una victoria directa sin cobertura.

Mecanismo de Fallback (Degradación Graciosa Automática):
• Se bloquea: Victoria Simple Lille (1).
• Se transfiere el análisis a mercados de cobertura correlacionados:
  1. Ambos Equipos Anotan (BTTS - Sí) [Puntuación Proyectada: 82%]
  2. Doble Oportunidad (1X) [Puntuación Proyectada: 70%]
```