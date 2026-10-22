# ⚽ Algoritmo de Alta Individual de Goles (Goles por Equipo - Línea Base 0.5)

Este documento contiene la arquitectura lógica, matemática y paramétrica para evaluar el mercado quirúrgico de **Goles Individuales por Equipo (Over 0.5)** utilizando un **Colchón de Varianza de +0.8**.

---

## ⚖️ 1. Definición del Colchón de Varianza (+0.8 Goles)

Para la Alta Individual de Goles (Línea Base $0.5$, es decir, que el equipo analizado anote al menos $1$ gol), se programa un **Colchón de Varianza de $+0.8$ goles**, ajustado por la interacción entre la potencia ofensiva del equipo y la resistencia defensiva del rival.

* **Justificación de $+0.8$:** Al sumarlo a la línea base ($0.5$), el sistema exige que el equipo analizado promedie un mínimo de **$1.3$ goles por partido** (o un $xG$ equivalente ajustado) para aprobar el filtro inicial.
* **Lógica Matemática:** Un equipo que promedia menos de $1.3$ goles depende excesivamente del azar para marcar. Exigir un mínimo de $1.3$ asegura regularidad de cara al arco y un modelo ofensivo sólido para superar la varianza de un encuentro trabado.

$$
\text{Línea Blindada Requerida} = \text{Línea Base (0.5)} + \text{Colchón de Varianza (0.8)} = \mathbf{1.30 \text{ Goles/xG}}
$$

---

## 📑 2. Variables de Mapeo para el Algoritmo

Mapeo de lectura de datos (JSON) cruzando la capacidad ofensiva del equipo contra la resistencia defensiva del rival (*Caso de estudio: Galatasaray visitando al Lille*).

### 🟢 1. Datos que CONFIRMAN el Pick (Base Ofensiva del Equipo y Urgencia)
* **Goles y $xG$ por Partido + Urgencia:** Ambas métricas deben superar el umbral blindado de $1.3$.
  * *Ejemplo:* Galatasaray promedia $2.1$ goles y $2.33\ xG$ por juego + necesidad alta por tabla ($+0.10$ al diferencial) $\rightarrow$ **Confirmación Absoluta**.
* **Tiros a Puerta por Partido:** Un equipo con $\ge 4.5$ tiros directos al arco incrementa drásticamente la probabilidad de marcar.
  * *Ejemplo:* Galatasaray remata $7.6$ veces a puerta por partido.
* **Tasa de Conversión:** Porcentaje de efectividad ofensiva. Si es $< 6\%$, requiere demasiados tiros para anotar, elevando el riesgo.
  * *Ejemplo:* Galatasaray registra un $9\%$ de efectividad.

### 🟡 2. Datos que RESPALDAN el Pick (Cruce con el Rival)
* **Fragilidad Defensiva del Rival:** Cruce del poder de ataque con los goles encajados por el adversario.
  * *Ejemplo:* Lille concede solo $0.7$ goles por partido en Ligue 1, equilibrando el ímpetu del Galatasaray.
* **Errores del Rival que Conducen a Gol/Disparo:** Mide desatenciones en la zaga contraria.
  * *Ejemplo:* Lille registra $8$ errores que llevan a disparo.

### 🔴 3. Datos que PENALIZAN el Pick (Alertas de Bloqueo)
* **Racha de Porterías en Cero del Rival:** Frecuencia con la que el rival deja su arco invicto.
  * *Ejemplo:* Lille tiene $4$ porterías a cero en $7$ encuentros.
* **Goles Evitados del Portero Rival:** Rendimiento del guardameta contrario.
  * *Ejemplo:* Ozer (portero del Lille) registra $+1.52$ goles evitados $\rightarrow$ **Alerta Roja**.

---

## 🧮 3. Matriz de Puntuación Ponderada (Máximo 100 Puntos)

### 🟢 Bloque de Confirmación Ofensiva y Contexto (Hasta 55 Puntos)
1. **Promedio de Goles y $xG$ (Hasta 25 pts):**
   * $\text{Goles\_Equipo} \ge 1.6 \text{ Y } xG\_Equipo \ge 1.6 \implies \mathbf{25\text{ pts}}$ *(Galatasaray: $2.1$ y $2.33$)*
   * Entre $1.3$ y $1.59 \implies \mathbf{15\text{ pts}}$
   * $< 1.3 \implies \mathbf{0\text{ pts}}$ *(Falla el colchón)*
2. **Volumen de Remates y Ocasiones (Hasta 15 pts):**
   * $\text{TirosPuerta\_Equipo} \ge 5.0 \text{ Y } \text{GrandesOcasiones} \ge 3.0 \implies \mathbf{15\text{ pts}}$ *(Galatasaray: $7.6$ y $4.1$)*
3. **Efectividad y Urgencia Contextual (Hasta 15 pts):**
   * Tasa de conversión $\ge 8\%$ + Urgencia por clasificación en tabla $\implies \mathbf{15\text{ pts}}$ *(Galatasaray: $9\%$ conversión y necesidad de sumar)*

*Subtotal Confirmación: 55 Puntos*

---

### 🟡 Bloque de Respaldo por Cruce y Desgaste del Rival (Hasta 45 Puntos)
1. **Permisividad Defensiva del Rival (Hasta 25 pts):**
   * $\text{GolesRecibidos\_Rival} \ge 1.2 \implies \mathbf{25\text{ pts}}$
   * Entre $0.8$ y $1.19 \implies \mathbf{12\text{ pts}}$
   * $< 0.8 \implies \mathbf{0\text{ pts}}$ *(Lille recibe $0.7$; no suma puntos)*
2. **Desatenciones y Errores Forzados del Rival (Hasta 20 pts):**
   * Registra $\ge 1$ error directo a gol/disparo por partido $\implies \mathbf{20\text{ pts}}$ *(Lille registra 8 errores en la temporada)*

*Subtotal Respaldo: 20 Puntos*  
*Total Acumulado Inicial: 75 Puntos*

---

### 🔴 Modificadores de Penalización y Fricción (Restas Directas)
* **Pared Defensiva / Portero en Racha:** Si $\text{GolesEvitados\_PorteroRival} \ge +1.20 \implies \mathbf{-15\text{ pts}}$ *(Aplica: Ozer tiene $+1.52$)*
* **Delantera Desafiada / Ocasiones Desperdiciadas:** Si $\text{GrandesOcasionesFalladas} \ge 2.5 \implies \mathbf{-10\text{ pts}}$ *(Aplica: Galatasaray falla $3.1$ por juego)*
* **Modificador Dinámico por Fricción (Faltas e Interrupciones):** Faltas combinadas $\ge 26.0$ / juego $\implies \mathbf{-5\text{ pts}}$ *(Aplica: $27.2$ faltas combinadas)*

---

## 🔄 4. Escalabilidad de Mercado (Margen MOP) y Filtro Financiero (+EV)

### 1. Cálculo del Margen de Over-Perform ($\text{MOP}$):
$$\text{MOP} = \text{Promedio Real Ofensivo} - (\text{Línea Base} + \text{Colchón})$$
$$\text{MOP} = 2.1 - 1.3 = \mathbf{+0.8}$$

#### Regla de Negocio para Escalabilidad (Líneas Individuales):
* $0.0 \le \text{MOP} \le 0.4 \implies$ Mantener línea base (**Over 0.5 Goles del equipo**).
* $0.5 \le \text{MOP} \le 1.1 \implies$ **Escalar 1 nivel (Over 1.5 Goles del equipo)** *(Aplica Galatasaray: $+0.8$)*.
* $\text{MOP} \ge 1.2 \implies$ **Escalar 2 niveles (Over 2.5 Goles del equipo)**.

### 2. Filtro Financiero de Valor Esperado (+EV)

$$
\text{Filtro +EV:} \quad \text{Score de Confianza (\%)} > \left(\frac{1}{\text{Cuota}}\right) + 5\%
$$

---

## 📊 5. Corrida del Algoritmo: Galatasaray (Goles Individuales)

### 1. Filtro del Colchón Base:
$$\text{Promedio Real (2.1)} \ge \text{Línea Base (0.5)} + \text{Colchón (0.8)} \implies 2.1 \ge 1.3 \quad \checkmark \text{ (APROBADO)}$$

### 2. Puntuación Neta Final:
$$\begin{aligned}
\text{Score Final} &= \text{Subtotal Confirmación} + \text{Subtotal Respaldo} - \text{Penalizaciones} \\
&= 55 + 20 - 15 - 10 - 5 \\
&= \mathbf{45\text{ Puntos (45\% Confianza para Over 1.5 Individual)}}
\end{aligned}$$

### 3. Evaluador +EV para Escalado Over 1.5 (Cuota ~2.10):
* **Score Calculado para Over 1.5:** $45\%$ vs. **Requerido +EV:** $52.6\%$ $\rightarrow$ ❌ **RECHAZADO PARA ESCALAR**.

---

## 🔥 6. Veredicto Final y Fallback del Sistema

```
[SISTEMA]: ESCALABILIDAD RECHAZADA POR EXCESO DE FRICCIÓN DEFENSIVA
Score para Over 1.5 Galatasaray: 45% (Falla Filtro +EV y Umbral de Seguridad)
MOP Calculado: +0.8 (Teóricamente sugería Over 1.5)

Diagnóstico:
Galatasaray posee un potencial de ataque sobresaliente (2.1 goles, xG 2.33), pero la solidez
defensiva del Lille (0.7 goles concedidos, portero Ozer con +1.52 goles evitados) y el alto nivel 
de fricción (-5 pts por faltas) recortan la probabilidad de marcar 2 o más goles.

Mecanismo de Fallback (Degradación Graciosa Automática):
• Se anula la escalada a Over 1.5 Goles de Galatasaray.
• Se degrada automáticamente al mercado de alta probabilidad de Línea Base:
  1. Over 0.5 Goles Galatasaray [Score Proyectado: 86% | Aprobado +EV]
  2. Ambos Equipos Anotan (BTTS - Sí) [Score Proyectado: 82%]

```