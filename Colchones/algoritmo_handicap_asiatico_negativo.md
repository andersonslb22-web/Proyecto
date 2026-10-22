# Modelo de Análisis: Hándicap Asiático Negativo (-1.5)

El **Hándicap Asiático Negativo (-1.5)** es una de las líneas más exigentes para el sistema. Requiere certificar una victoria por una diferencia mínima de **2 goles** (ej. 2-0, 3-1, 4-2).

La varianza en esta línea es críticamente alta: un favorito ganando 1-0 en el minuto 80 puede replegarse para cuidar el resultado, arruinando la cobertura del pick.

---

## ⚖️ El Equilibrio Perfecto: Colchón de Varianza (+1.3 Goles)

Para compensar la volatilidad del Hándicap -1.5, el algoritmo exige un **Colchón de Varianza de +1.3 goles** sobre la ventaja estadística proyectada, ajustado por factores contextuales y motivacionales.

* **Fórmula de la Ventaja Proyectada Ajustada:**

  $$
  \text{Ventaja Proyectada} = (\text{Goles Favorito} - \text{Goles Recibidos Rival}) + \text{Factor Localía/Urgencia}
  $$

* **Línea Blindada Requerida:**

  $$
  \text{Requerimiento Mínimo} = \text{Línea (-1.5)} + \text{Colchón (+1.3)} = \mathbf{2.80 \text{ Goles}}
  $$

  * Si la ventaja proyectada es $< 2.80$, el sistema **rechaza el Hándicap -1.5** y activa la degradación graciosa (*Fallback*).

---

## 📑 Variables de Mapeo para el Algoritmo

*Caso de Estudio:* **Lille** (Local, Cuota $+240$ / $3.40$ para Hándicap -1.5) vs. **Galatasaray** (Visitante, Cuota $+210$ / $3.10$).

### 🟢 1. Datos que CONFIRMAN el Pick (Dominio Absolute y Urgencia)

* **Diferencia de Goles Proyectada ($xG$ vs $xGA$) + Urgencia:**
  * *Lille:* Anota $1.4$ goles/partido, recibe $0.7$, $xG = 1.50$. Suma necesidad alta de sumar en tabla ($+0.10$ al diferencial).
* **Tasa de Conversión y $xGOT$:**
  * *Lille:* $xGOT = 2.03$ (Disparos colocados de alto peligro).
* **Historial de Dominio (H2H Reciente):**
  * *Lille (últimos 4 partidos en casa):* 1-0, 2-1, 2-0, 2-3. Solo cumplió la línea de 2 goles de diferencia en 1 de 4 encuentros ⚠️ *(Alerta de cobertura)*.

### 🟡 2. Datos que RESPALDAN el Pick (Fragilidad Defensiva del Rival)

* **Tendencia a la Goleada del Visitante:**
  * *Galatasaray:* Recibe $1.4$ goles por encuentro. Derrotas abultadas recientes: 1-4 vs Barcelona, 4-0 vs Trabzonspor *(Respalda fragilidad anímica tras encajar gol)*.
* **Errores Defensivos Graves:**
  * *Galatasaray:* 2 errores directos a gol en la liga local.

### 🔴 3. Datos que PENALIZAN el Pick (Alertas de Quiebre)

* **Poder de Fuego del Rival:** Si el visitante anota, obliga al favorito a marcar mínimo 3 goles.
  * *Galatasaray:* Promedio de $2.1$ goles anotados por partido 🚨 *(Penalización Crítica)*.
* **Bajas en la Columna Vertebral Defensiva:**
  * *Lille:* Bajas confirmadas de E. Mbappé (roja) y T. Santos.

---

## 🧮 Matriz de Puntuación Ponderada (Máximo 100 Puntos)

### 🟢 Bloque de Confirmación de Dominio y Contexto (Hasta 50 Pts)

* **Margen de Goles Esperados ($\text{Fav } xG - \text{Rival Goles Encajados}$):**
  * $\ge 1.5 \text{ goles}$ $\rightarrow$ **20 pts**
  * $0.8 \text{ a } 1.49 \text{ goles}$ $\rightarrow$ **10 pts**
  * $< 0.8 \text{ goles}$ $\rightarrow$ **0 pts**
  * *Evaluación Lille:* $1.50 (xG) - 1.4 (\text{Encajados}) = +0.10$ $\rightarrow$ **0 pts**

* **Urgencia Contextual (Tabla / Clasificación):**
  * Urgencia alta de sumar con diferencia de goles $\rightarrow$ **10 pts**
  * *Evaluación Lille:* Urgencia alta $\rightarrow$ **10 pts**

* **Eficiencia Defensiva del Favorito (Portería a Cero):**
  * $\ge 50\%$ de partidos invicto $\rightarrow$ **20 pts**
  * *Evaluación Lille:* 4 de 7 partidos invicto ($57\%$) $\rightarrow$ **20 pts**

> **Subtotal Confirmación:** **30 pts**

---

### 🟡 Bloque de Respaldo por Desgaste del Rival (Hasta 50 Pts)

* **Tendencia del Rival a Recibir Goles fuera de casa:**
  * $\ge 1.5 \text{ goles/partido}$ $\rightarrow$ **25 pts**
  * $1.1 \text{ a } 1.49 \text{ goles/partido}$ $\rightarrow$ **15 pts**
  * *Evaluación Galatasaray:* Recibe $1.4$ goles/partido $\rightarrow$ **15 pts**

* **Diferencia de Calidad de Disparos ($xGOT$ vs Paradas):**
  * $xGOT \text{ favorito} \gg \text{Paradas rival}$ $\rightarrow$ **25 pts**
  * *Evaluación:* Lille $xGOT (2.03)$ vs Paradas Galatasaray $(2.3)$ $\rightarrow$ **0 pts**

> **Subtotal Respaldo:** **15 pts**  
> **Total Acumulado Inicial:** **45 pts**

---

### 🔴 Modificadores de Penalización y Fricción (Restas Directas)

* **Poder Ofensivo del Rival:** Rival anota $\ge 1.5 \text{ goles/partido}$ $\rightarrow$ **-30 pts**
  * *Evaluación Galatasaray:* $2.1$ goles/partido $\rightarrow$ **-30 pts**

* **Delantera Ineficiente / Disparos Desperdiciados:** Favorito falla $> 1.5$ ocasiones claras/juego $\rightarrow$ **-10 pts**
  * *Evaluación Lille:* Falla $1.7$ ocasiones/juego $\rightarrow$ **-10 pts**

* **Modificador Dinámico por Fricción (Faltas e Interrupciones):**
  * Faltas combinadas $\ge 26.0$ / juego $\rightarrow$ **-5 pts**
  * *Evaluación Partido:* $27.2$ faltas combinadas $\rightarrow$ **-5 pts**

---

## 🔄 Escalabilidad MOP y Filtro Financiero (+EV)

### 1. Escalabilidad MOP (Matriz de Optimización de Posición)

* Si la Ventaja Proyectada es $< 2.80$, la línea -1.5 queda deshabilitada y la matriz escala hacia **Hándicap Asiático 0.0 (Empate No Válido)** o **Victoria Simple**.

### 2. Filtro Financiero de Valor Esperado (+EV)

$$
\text{Filtro +EV:} \quad \text{Score de Confianza (\%)} > \left(\frac{1}{\text{Cuota}}\right) + 5\%
$$

* *Para Lille -1.5 a Cuota* $3.40$ *(*$29.4\%$ *prob. implícita):* Mínimo requerido = $34.4\%$.

---

## 📊 Corrida del Algoritmo: Lille vs. Galatasaray

### 1. Prueba del Colchón de Varianza

* **Ventaja Proyectada Ajustada:**  
  $$\text{Goles Lille (1.4)} - \text{Goles Recibidos Galatasaray (1.4)} + \text{Urgencia (0.10)} = \mathbf{0.10 \text{ Goles}}$$

* **Requerimiento Mínimo con Colchón:**  
  $$1.5 \text{ (Línea)} + 1.3 \text{ (Colchón)} = \mathbf{2.80 \text{ Goles}}$$

* **Evaluación:**  
  $$0.10 \ge 2.80 \quad \text{❌ RECHAZADO ENERGICAMENTE}$$

---

### 2. Cálculo del Score Final Neto

$$
\begin{aligned}
\text{Score Final} &= \text{Subtotal Confirmación} + \text{Subtotal Respaldo} - \text{Penalizaciones} \\
&= 30 + 15 - 30 - 10 - 5 \\
&= \mathbf{0 \text{ Puntos (0\% Confianza)}}
\end{aligned}
$$

---

### 3. Evaluador +EV

* **Score Calculado:** $0\%$ vs. **Mínimo Requerido por Cuota (3.40):** $34.4\%$
* **Resultado:** ❌ **Falla total. Sin valor ni fundamento estadístico.**

---

## 🔥 Veredicto Final y Fallback del Sistema

```
[SISTEMA]: PICK BLOQUEADO (RECHAZO ABSOLUTO)
Score de Confianza: 0%
Ventaja Proyectada: +0.10 Goles (Requerido: +2.80 Goles)
Cuota Evaluada: 3.40 (Probabilidad Implícita: 29.4%)

Razón:
El Lille carece de contundencia para cubrir una ventaja de 2 goles. La potencia ofensiva 
del Galatasaray (2.1 goles/partido) hace improbable mantener la portería a cero.

Mecanismo de Fallback (Degradación Graciosa Automática):
• Se anula: Hándicap Asiático Lille (-1.5).
• Transición de Mercado Recomendada:
  1. Hándicap Asiático Visitante (+1.5 Galatasaray) [Score Proyectado: 88%]
  2. Ambos Equipos Anotan (BTTS - Sí) [Score Proyectado: 82%]
```