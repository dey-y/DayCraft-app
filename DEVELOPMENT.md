# 🛠️ DayCraft AI — Bitácora de Desarrollo y Mockups Móviles

Este documento recoge el proceso evolutivo de creación y diseño de **DayCraft AI**, documentando visualmente cómo fue transformándose la interfaz móvil en cada versión (v1 a v7) a partir del feedback de Deimar.

> 📱 El prototipo interactivo final ejecutable se encuentra en: [`mockup-mobile.html`](mockup-mobile.html)

---

## 📑 Índice de Versiones
1. [v1: Concepto Inicial y Entrada Mixta](#v1-concepto-inicial-y-entrada-mixta)
2. [v2: Eliminación de Ruido y Banners Proactivos](#v2-eliminación-de-ruido-y-banners-proactivos)
3. [v3: Campana No Intrusiva, Ideas Agrupadas y Tareas vs Recordatorios](#v3-campana-no-intrusiva-ideas-agrupadas-y-tareas-vs-recordatorios)
4. [v4: Retorno del Calendario Semanal e Iconos Notion](#v4-retorno-del-calendario-semanal-e-iconos-notion)
5. [v5: Consistencia Extrema, Cero Emojis y Calendario Dinámico](#v5-consistencia-extrema-cero-emojis-y-calendario-dinámico)
6. [v6: Time-Blocking Profesional y Mensajes Contextuales](#v6-time-blocking-profesional-y-mensajes-contextuales)
7. [v7: Pendientes de Hoy sin Hora Fija y Rollover Antiestrés (Móvil)](#v7-final-pendientes-de-hoy-sin-hora-fija-y-rollover-antiestrés)
8. [v8: Adaptación Web / Escritorio (Dashboard Panorámico 3 Columnas)](#v8-adaptación-web--escritorio-dashboard-panorámico-3-columnas)
9. [v8.3: Vista Semanal 7D, Agenda Rápida Permanente y Cajón Kanban](#v83-propuesta-alternativa--vista-semanal-7-días--agenda-rápida-permanente)
10. [v8.4: Optimización Ergonómica para Laptops y Saneamiento de Código](#v84-optimización-ergonómica-para-laptops-y-saneamiento-de-código)
11. [Cierre de la Fase de Prototipado (Móvil & Web)](#-cierre-de-la-fase-de-prototipado-móvil--web)
12. [v10: Código base Expo y sistema de temas Kuro-Zen](#v10-código-base-expo-y-sistema-de-temas-kuro-zen)

---

## v1: Concepto Inicial y Entrada Mixta

### Planteamiento y Feedback
* **Objetivo inicial**: Deimar propuso una app para vencer la pereza de organizarse. El usuario habla o escribe en lenguaje natural y la IA separa tareas e ideas.
* **Problema detectado por Deimar**: Las sugerencias genéricas debajo del buscador no tenían sentido y ensuciaban la pantalla.

---

## v2: Eliminación de Ruido y Banners Proactivos

### Planteamiento y Feedback
* **Cambios**: Se eliminaron los botones de sugerencias estáticas y se añadieron alertas para tareas atrasadas e ideas inactivas.
* **Problema detectado por Deimar**: Los banners en mitad de la pantalla resultaban demasiado invasivos. Se requería un acceso discreto como una campana. Además, las ideas debían agruparse por proyectos y el calendario debía distinguir Tareas de Recordatorios.

---

## v3: Campana No Intrusiva, Ideas Agrupadas y Tareas vs Recordatorios

### Planteamiento y Feedback
* **Cambios**:
  * Campana superior discreta `🔔 [2]` con panel desplegable flotante.
  * Auto-agrupación de ideas dentro de proyectos afines (ej: *"Proyecto: Mi App Móvil"*).
  * División conceptual: Tareas de trabajo vs Recordatorios puntuales.
* **Problema detectado por Deimar**: Al separar las tareas se eliminó la vista visual del calendario semanal, la cual Deimar quería conservar. Solicitó además adoptar la iconografía de `notionicons.so`.

---

## v4: Retorno del Calendario Semanal e Iconos Notion

### Planteamiento y Feedback
* **Cambios**:
  * Tira semanal visual de 7 días (L, M, X, J, V, S, D).
  * Renombrado a **Cajón de Ideas**.
  * Incorporación inicial de iconos minimalistas de Notion.
* **Problema detectado por Deimar**:
  * Se usó la palabra *"Avisos"* en vez de *"Recordatorios"*.
  * *"Llamar al dentista"* figuraba como tarea en lugar de recordatorio.
  * La agenda no cambiaba al seleccionar diferentes días de la semana y aún quedaban emojis de colores.

---

## v5: Consistencia Extrema, Cero Emojis y Calendario Dinámico

### Planteamiento y Feedback
* **Cambios**:
  * Erradicación total de emoticonos de colores; 100% iconos vectoriales SVG de trazo fino estilo Notion.
  * Reclasificación de *"Llamar al dentista"* como Recordatorio puntual.
  * Calendario dinámico real: cada día muestra únicamente sus eventos.
* **Problema detectado por Deimar**:
  * La hora "11:30 - 12:00" en texto plano dentro de una tarjeta lucía poco estética.
  * Se necesitaban mensajes empáticos en días libres (*"tómate un descanso"*).
  
---

## v6: Time-Blocking Profesional y Mensajes Contextuales

### Planteamiento y Feedback
* **Cambios**:
  * **Timeline con Raíl Horario**: Eje vertical a la izquierda. Tareas como bloques proporcionales con hora de inicio, fin y duración (`30 min`). Recordatorios como pines en la hora exacta.
  * **Mensajes Contextuales**: En días vacíos se muestra un mensaje adaptativo según si es hoy (*"Tómate un descanso"*), futuro (*"Día despejado"*) o pasado (*"Día concluido"*).
* **Problema detectado por Deimar**:
  * En días con pocos eventos quedaba un espacio vertical vacío entre la timeline y el chat inferior.
  * Propuso una sección para tareas que se mencionan sin definir hora.

---

## v7 (Final): Pendientes de Hoy sin Hora Fija y Rollover Antiestrés

### Planteamiento y Solución Definitiva
* **Novedades**:
  * **Sección "Pendientes de hoy (Sin hora fija)"**: Aprovecha el espacio inferior de forma natural al hacer scroll. Contiene las tareas mencionadas por voz sin hora fija con checkbox y botón *"Fijar hora"*.
  * **Rollover Automático y Etiqueta `[ De ayer ]`**: Tareas no completadas pasan al día siguiente con una pastilla estilizada en una sola línea (`whitespace-nowrap`), sin romperse en dos renglones.
  * **Regla Antiestrés de los 3 Días**: Si una tarea se aplaza 3 días, la campana ofrece moverla a ideas o archivarla sin generar culpa.

---

*Mockups interactivos ejecutables:*
* Móvil: [`mockup-mobile.html`](mockup-mobile.html)
* Web / Escritorio: [`mockup-web.html`](mockup-web.html)

---

## v8: Adaptación Web / Escritorio (Dashboard Panorámico 3 Columnas)

### Planteamiento y Ergonomía de Pantalla Grande
Al pasar de la pantalla compacta de un móvil (390px) a un monitor de escritorio (1200px+):
* **El problema de la pestaña única**: En web, obligar al usuario a alternar entre pestañas inferiores ("Asistente", "Cajón de Ideas", "Calendario") desperdicia el ancho horizontal y rompe el flujo de trabajo continuo.
* **La solución en 3 Columnas**:
  1. **Barra Lateral Izquierda (Sidebar)**: Acceso directo a Vistas principales, Proyectos activos del Cajón de Ideas auto-agrupados, y estado del Rollover antiestrés.
  2. **Lienzo Central (Canvas del Día)**:
     * Header superior con tira interactiva de 7 días y selector de filtros (`Todo`, `Tareas`, `Recordatorios`).
     * **Distribución lado a lado**: A la izquierda la **Timeline Horaria (*Time-blocking*)** con su raíl vertical; a la derecha la sección de **Pendientes de hoy (Sin hora fija)** con sus checkboxes, pastilla `[ De ayer ]` y botón `[ Fijar hora ]`.
  3. **Panel Lateral Derecho (Dock Inteligente)**:
     * El Asistente conversacional y la barra de captura rápida con micrófono permanecen **siempre visibles** en un lateral.
     * Permite dictar o teclear tareas e ideas mientras ves en tiempo real cómo se actualiza la timeline del día en el centro.

### 💻 Mockup Web v8.2 (Desktop Final — Timeline 24h & Todo el Mes)

#### Cambios implementados según el feedback de Deimar:
* **Timeline 24 Horas Reales (00:00 a 24:00)**: En pantalla de escritorio/portátil el raíl abarca las 24 horas del día con scroll fluido continuo, línea viva de "HORA ACTUAL" (`11:45 AHORA`), y click en cualquier hora para agendar bloques.
* **Navegación de Todo el Mes (Grid 31 Días + Tira Horizontal)**: Se sustituyó la restricción de 7 días por una tira deslizable de los 31 días y un selector de vista: `Timeline 24h` vs `Todo el Mes (Grid)` con cuadrícula mensual completa interactiva.
* **Eliminación Total de la Tarjeta de "Rollover Activo"**: Se purgó la caja de advertencia del sidebar; el rollover opera silenciosamente con la pastilla `[ De ayer ]` en la propia tarea dentro de la lista de pendientes.
* **100% Pantalla Completa para PC**: Eliminados los marcos fijos; la app se ajusta elásticamente al monitor (`h-screen w-screen`) con paneles plegables de navegación e IA.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ DayCraft AI  [ Omni Search / Intake... Ctrl+K ]   [2h 00m Foco]  ● Sync  🔔[2]  [D]  │
├──────────────┬──────────────────────────────────────────┬──────────────────────────────┤
│ 📅 Octubre   │ M 27 de Octubre (Hoy)   [L][M][X][J][V]  │ 🧠 CEREBRO IA GEMINI         │
│ L M X J V S D│ Filtros: [ Todo ] [ Tareas ] [ Recordat] │ ┌──────────────────────────┐ │
│ ..26(27)28.. ├─────────────────────┬────────────────────┤ │ 💡 Briefing de Jornada   │ │
│              │ Timeline Continua:  │ Pendientes Hoy:    │ │ Tarde libre tras 14:30   │ │
│ PROYECTOS:   │ 10:00 ───────────── │ [ ] Pilas [De ayer]│ ├──────────────────────────┤ │
│ • App Móvil  │ 11:30 Bloque gastos │ [ ] Llamar Carlos  │ │ 💤 Reactivar Idea (12d)  │ │
│ • Nutrición  │ 12:00 [2h Libres ✨]│ ────────────────── │ │ "Automatizador"          │ │
│              │ 14:00 Record. Pasti │ [+ Añadir rápido ] │ │ [ Agendar 1er paso ]     │ │
│ ⚠️ Rollover  │ 16:00 ───────────── │                    │ └──────────────────────────┘ │
│ [1 de 3 días]│ 17:00 ───────────── │ [Regla 3 días ℹ️]   │ [ Háblame o escribe... ]🎙️   │
└──────────────┴─────────────────────┴────────────────────┴──────────────────────────────┘
```

*Mockup web ejecutable:* [`mockup-web.html`](mockup-web.html)

---

## v8.3: Propuesta Alternativa — Vista Semanal (7 Días) + Agenda Rápida Permanente

### Planteamiento y Ergonomía
Para resolver la sensación de vacío cuando un día solo tiene 1 o 2 tareas en pantalla ancha de PC, se crea un mockup comparativo independiente:
* **Agenda Rápida & Pendientes Permanente (Columna dedicada)**:
  * Siempre visible a la izquierda del lienzo.
  * Agrupa en una lista compacta sin saltos de horas muertas: las tareas con horario fijado y los recordatorios/pendientes del día.
  * **Empty State Motivador**: Si no hay pendientes o se completan todos los checkboxes, muestra el mensaje: *"¡Todo despejado por hoy! Has completado todos tus recordatorios y tareas de hoy. Estás 100% al día sin estrés."* (Incluye botón en cabecera `Simular: Todo Hecho` para probarlo de un clic).
* **Lienzo Principal con Vista Semanal de 7 Columnas**:
  * Distribuye de Lunes a Domingo aprovechando el 100% del ancho del monitor.
  * Permite alternar con un clic entre `Semana (7 Días)`, `Día (24h)`, `Mes (Grid)` y `Cajón de Ideas`.

* **Cajón de Ideas Estilo Kanban / Proyectos Vivos**:
  * Sustitución de cajas estáticas por tarjetas enriquecidas estilo Notion y Linear.
  * Carpetas por proyectos con iconos vectoriales dedicados, etiquetas `#UX`, `#Tech`, sugerencias contextuales de Gemini y botón directo `[ 📅 Agendar paso ]` para convertir ideas en bloques de tiempo de la agenda.
  * Barra superior de captura rápida de chispazos con auto-clasificación por IA.

*Mockup comparativo ejecutable:* [`mockup-web-semanal.html`](mockup-web-semanal.html)

---

## v8.4: Optimización Ergonómica para Laptops y Saneamiento de Código

### Planteamiento y Feedback de Deimar
* **Problema de espacio en portátil**: Al trabajar desde la laptop, tener el panel de IA en el extremo derecho ocupaba más de 320 px fijos, comprimiendo las 7 columnas del calendario semanal.
* **Propuesta de Deimar (Opción A)**: Hacer convivir la "Agenda de Hoy" con el "Chat IA" en el mismo panel lateral izquierdo mediante pestañas segmentadas (`[ 📅 Agenda Hoy ]` y `[ 🧠 Asistente IA ]`), eliminando el panel derecho independiente.
* **Simplificación de terminología**: Renombrar la sección *"Recordatorios y pendientes"* a simplemente *"Pendientes"*.
* **Saneamiento del código**: Reducir el ruido visual y el desorden del HTML para garantizar un código modular, cómodo y agradable de inspeccionar.

### Solución Implementada:
1. **Layout de 3 Paneles**:
   * `[ Sidebar Navegación (220px) ]` + `[ Panel Multifunción Agenda/IA (350px) ]` + `[ Lienzo Calendario Expandido (Flex-1) ]`.
   * El calendario semanal gana más de 320 px de ancho horizontal: cada columna tiene espacio generoso para tarjetas horarias.
2. **Pestañas Segmentadas en Cabecera**:
   * Switch instantáneo entre la vista de **Agenda de Hoy** (con horario fijado y lista de Pendientes) y el feed del **Asistente IA** (briefing, sugerencias para rescatar ideas y chat dinámico).
   * Indicador vivo (`pulse`) en la pestaña de IA si hay sugerencias pendientes.
3. **Smart Intake Compartido**:
   * Barra de entrada con micrófono en el pie del panel lateral que interactúa con la agenda o conmuta al chat conversacional según el comando.
4. **Refactorización y Limpieza de Código**:
   * **Diccionario SVG Centralizado**: Se eliminaron los bloques gigantes de SVG dispersos en el HTML; ahora se invocan limpiamente con `<svg class="icon"><use href="#icon-nombre"/></svg>`.
   * **Clases Semánticas**: Extracción de estilos recurrentes (`.card-base`, `.segmented-tab`) para limpiar la sobrecarga de clases inline de Tailwind.
   * **JavaScript por Capas**: Estado (`AppState`), controladores de pestañas, navegación y acciones limpiamente separados.

5. **Restauración del Eje Horario 24h Semanal, Raíl de Día y Cuadrícula Mensual**:
   * **Calendario Semanal 7D (`Semana`)**: Incorporación de columna lateral con horas reales (00:00 a 23:00), rejilla de 60px por hora (1 min = 1 px), franja superior "Sin hora" para pendientes diarios, bloques de trabajo proporcionales (11:30–12:00 de 30m, 10:00–11:30 de 90m), indicador de hora actual (11:45) con punto rojo discreto sin cubrir tarjetas y auto-scroll a las 09:00.
   * **Timeline 24h (`Día`)**: Raíl vertical físico continuo con columna de horas (00:00 a 24:00), línea conectora (`w-0.5`), nodos circulares en cada hora (con resaltado de eventos en color índigo) y huecos interactivos `+ Agendar bloque`.
   * **Indicador en Tiempo Real Discreto**: Punto rojo parpadeante (`live-pulse`) montado directamente sobre el raíl vertical (a las 11:45) sin barras horizontales invasivas, evitando cualquier superposición con las tarjetas de actividades.
   * **Grid Mensual (`Mes`)**: Cuadrícula de 7 columnas completa con días de transición atenuados de septiembre (28, 29, 30), altura mínima de 90px por celda y tarjetas de eventos en los días activos.
   * **Notion Icons con Dimensiones Fijas**: Contención estricta de 14px y 16px en todos los navegadores, eliminando cualquier distorsión o desbordamiento.

*Mockup optimizado:* [`mockup-web-semanal.html`](mockup-web-semanal.html)

---

## v8.5: Enfoque "Día Heroico" con Tira Deslizable de Días y Splitter Redimensionable

### Planteamiento y Feedback Crítico de Deimar
* **Rechazo a la Vista Semanal de 7 Columnas en Escritorio**:
  * En configuraciones de mosaico de ventanas (*tiling window manager* como Hyprland en NixOS), dividir la pantalla en 7 columnas paralelas genera columnas de apenas ~55-80 px.
  * Esto comprime los textos, deforma las tarjetas horarias y traslada el estrés de hojas de cálculo tipo Google Calendar, traicionando el principio fundacional de DayCraft: *cero estrés, foco total y respiración visual*.
* **El "Día Heroico" como Vista Principal**:
  * Sustitución total de la vista semanal por el **Timeline 24h del Día** como héroe visual indiscutible del lienzo principal.
  * Tarjetas de tiempo con amplitud completa, tipografía generosa, etiquetas limpias y bloques de fácil lectura.
* **Tira Horizontal Deslizable de Días (Day Strip)**:
  * Barra de navegación horizontal (`[‹] [DOM 25] [LUN 26] [MAR 27 Hoy] [MIÉ 28] [JUE 29] [VIE 30] [›]`).
  * Permite alternar de día al instante o navegar con flechas, manteniendo el timeline enfocado en el día seleccionado.
  * Puntos indicadores en los días que tienen bloques agendados.
* **Separador Arrastrable (*Splitter Handle*)**:
  * El panel lateral izquierdo de Agenda / IA ahora cuenta con un tirador físico `#panelResizer` arrastrable entre 240px y 540px.
  * Incluye atajo por doble clic para alternar entre modo compacto (245px, ideal para splits de Hyprland) y modo estándar (330px).
* **Solución Definitiva del Punto Rojo de Hora Actual**:
  * Ubicado con precisión milimétrica exclusivamente en el raíl vertical de la vista de **Hoy** (11:45).
  * En días pasados o futuros, el punto rojo no se dibuja, erradicando cualquier aparición flotante o solapada.
* **Simplificación Radical del Cajón de Ideas (Cero Sobrecarga)**:
  * Eliminadas las sub-vistas artificiales (`Carpetas`, `Muro de Notas`, `Bandeja de Entrada`), eliminando ruido visual y botones redundantes.
  * Vista única y directa donde las notas aparecen auto-agrupadas por contexto con botón directo `[ Agendar paso ]`.
  * **Punto de Entrada Universal Único**: Sin cajas de texto redundantes en el cajón de ideas; toda captura fluye exclusivamente a través del Asistente IA / Smart Intake.
* **Freno Firme de Scroll y Time-Blocking por Arrastre (15 min)**:
  * **Tope en 23:00 sin overscroll**: Aplicado `overscroll-none` y ajuste de padding al final del timeline para que el scroll se detenga en seco en las 23:00 sin rebotes elásticos ni desplazamientos incómodos.
  * **Clic y arrastrar con precisión de cuartos de hora (15 minutos)**: Cada hora se subdivide en 4 cuartos (`:00`, `:15`, `:30`, `:45`). Al hacer clic y arrastrar verticalmente, el bloque se ajusta (*snap*) cada 15 minutos, permitiendo crear con total libertad bloques de 15m, 30m, 45m, 1h 15m, etc., con badge dinámico en tiempo real y registro directo en la agenda.

*Mockup de referencia:* [`mockup-web-semanal.html`](mockup-web-semanal.html)

---

## v8.6: Paridad Móvil con Raíl 24h Continuo y Pestaña Dedicada para Pendientes de Hoy

### Planteamiento y Decisión de Deimar (Opción A)
* **Paridad conceptual Web ↔ Móvil**: Tras perfeccionar el diseño de escritorio con el Timeline 24h continuo y la tira horizontal de días, se acordó trasladar esta misma experiencia coherente al móvil.
* **Separación de "Pendientes de Hoy"**:
  * En una pantalla móvil de ~390px de ancho y espacio vertical limitado, colocar un Timeline de 24 horas y los pendientes sin hora en la misma pantalla obligaba al usuario a deslizar 10 veces hacia abajo para marcar una simple tarea como *"Comprar pilas"*.
  * Deimar seleccionó la **Opción A**: arquitectura de **4 pestañas dedicadas** en la barra de navegación inferior (`Asistente`, `Ideas`, `Pendientes`, `Timeline 24h`).

### Solución Implementada en [`mockup-mobile.html`](mockup-mobile.html):
1. **Pestaña 4: Timeline 24h con Raíl Físico Continuo**:
   * **Tira horizontal de días**: Barra deslizante (`Dom 25` a `Dom 01`) con selector rápido y botón de retorno instantáneo a "Hoy".
   * **Eje de 24 Horas continuas (00:00 a 23:00)**: Raíl vertical con línea física continua (`#2d3345`), nodos en cada hora y cuadrícula horizontal tenue.
   * **Línea de Tiempo Actual Viva (11:45)**: Línea roja con punto de brillo (`box-shadow`) presente **únicamente en el día de Hoy (Martes 27)**.
   * **Bloques Agendados Proporcionales**: Tarjetas con tiempo exacto (`11:30 — 12:00`), badges de duración y acento de color minimalista.
   * **Tope estricto de scroll y aterrizaje ergonómico**: Desplazamiento inicial automático a las 09:00/10:30 para no abrir en la medianoche.
2. **Pestaña 3: Pendientes de Hoy (Sin Hora Fija)**:
   * **Lista enfocada**: Tarjetas con checkbox táctil, badge *"De ayer"* para rollover antiestrés que nunca se rompe ni se desborda en pantallas angostas.
   * **Acción "Fijar hora"**: Botón que solicita la hora deseada y traslada el pendiente inmediatamente al Timeline 24h del día actual.
   * **Captura Rápida Directa**: Input superior con Enter para añadir pendientes de hoy al instante.
   * **Badge Contador Reactivo**: Conteo en tiempo real tanto en la cabecera de la pantalla como en la pastilla de la barra de navegación inferior (`#navPendingBadge`).
   * **Empty State Celebratorio**: Mensaje de *"¡Todo despejado por hoy! Cero estrés"* al completar todos los pendientes.
3. **Navegación Móvil de 4 Botones (Notion Icons 100%)**:
   * Iconos limpios con trazo uniforme (24x24 con viewBox 0 0 24 24, stroke 1.8), etiquetas de 9px y estados activo/inactivo de alto contraste.

---

## v9.0: Mockups Limpios & Unificados (Post-Auditoría de Producto Senior)

Generados como archivos independientes ([`mockup-web-v9.html`](mockup-web-v9.html) y [`mockup-mobile-v9.html`](mockup-mobile-v9.html)) para incorporar el feedback de la auditoría de UX sin alterar los prototipos v8.x:

### 1. En Escritorio ([`mockup-web-v9.html`](mockup-web-v9.html)):
* **Sidebar Colapsable con Atajo (`Ctrl+B`)**: Botón en la cabecera y atajo de teclado para ocultar/mostrar el menú lateral, ideal para monitores compactos y *tiling window managers* (Hyprland).
* **Eliminación del Mini-Calendario del Sidebar**: El sidebar se enfoca puramente en Vistas y Proyectos auto-clasificados, eliminando la redundancia de un tercer calendario en pantalla.
* **Punto de Entrada Universal Único**: Eliminado el input duplicado de la cabecera de la Agenda; toda captura pasa exclusivamente por el Smart Intake inferior con micrófono.
* **Horas Vacías 100% Limpias en Reposo**: Eliminadas las cajas punteadas permanentes de cuartos de hora. En reposo el lienzo es sereno; al hacer *hover* o arrastrar, el *snapping* de 15 minutos se activa dinámicamente.
* **Toast Interactivo Flotante**: Al dictar o capturar un pendiente, aparece una tarjeta flotante en la esquina inferior derecha (`✨ Guardado en Pendientes [Fijar hora]`) con descarte automático en 4s.
* **Smart Slot Modal (1-Tap Time Blocking)**: Al hacer clic en "Fijar hora", sugiere huecos libres reales (`12:00 Tras reunión`, `16:00 Tarde libre`, `19:00 Fin de jornada`) o manual.

### 2. En Móvil ([`mockup-mobile-v9.html`](mockup-mobile-v9.html)):
* **Punto de Entrada Único**: Eliminado el input redundante de la pestaña de Pendientes; la barra inferior universal gestiona toda la entrada de texto y voz.
* **Toast Efímero sin Ruptura de Contexto**: Dictar o escribir en el Timeline o en Pendientes muestra un Toast flotante animado de 4 segundos sin arrancar al usuario hacia la pestaña de chat.
* **Timeline 24h Interactivo (Tapping Directo)**: Tocar cualquier hora vacía (ej. `15:00`) permite agendar un bloque enfocado directamente.
* **Píldora Indicadora en la Cabecera del Timeline**: Muestra un enlace rápido `2 pendientes →` para saltar a los pendientes de hoy sin perderlos de vista.
* **Selector Bottom Sheet de Huecos Libres**: Al pulsar "Fijar hora" en un pendiente, despliega un *bottom sheet* táctil con slots inteligentes.

---

## 🎯 Cierre Definitivo de la Fase de Prototipado (Móvil & Web)

Los mockups v9.0 quedan consolidados como la especificación visual y funcional definitiva:
1. 📱 **Móvil ([`mockup-mobile-v9.html`](mockup-mobile-v9.html))**: Experiencia ágil vertical en 4 pestañas, raíl 24h interactivo, Toast efímero de captura, 1-tap time-blocking y rollover antiestrés.
2. 💻 **Escritorio ([`mockup-web-v9.html`](mockup-web-v9.html))**: Dashboard ergonómico con sidebar colapsable (`Ctrl+B`), panel redimensionable Agenda/IA, Timeline 24h limpio en reposo con time-blocking por cuartos de hora (15m), Toast flotante y Smart Intake universal.

**Siguiente Hito**: Desarrollo del código base con React Native / Expo, TypeScript y NativeWind.

---

## v10: Código base Expo y sistema de temas Kuro-Zen

### Contexto y decisión de diseño de Deimar
* Tras recuperar en la laptop los cambios subidos a GitHub (`git pull origin main`), el proyecto ya contiene la app Expo (SDK 52, expo-router, NativeWind v4, Zustand, expo-sqlite).
* **Problema detectado por Deimar**: el diseño v9 (fondo `#0d1117`, índigo `#6366f1`, bordes grises) se sentía "muy común", la estética por defecto de cualquier herramienta de desarrollo. Quiere sentirse cómodo con su propia herramienta.
* **Dirección elegida**: **Dark Japandi / Kuro-Zen** (fusión escandinava y japonesa: piedra mineral mate, papel washi, madera y té matcha), con **5 temas intercambiables** según el estado de ánimo. Los mockups de exploración están en [`docs/mockups/palette-dark-japandi.html`](docs/mockups/palette-dark-japandi.html).

### Los 5 temas
| Tema | Nombre | Fondo | Tarjeta | Acento | Sensación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Morado | Murasaki (por defecto) | `#131217` | `#191720` | `#9A88C8` | Introspección, creatividad |
| Rojo | Akane | `#141212` | `#1C1818` | `#C25447` | Calidez, determinación |
| Azul | Aizome | `#111316` | `#171B20` | `#5E85A8` | Claridad, foco |
| Negro | Sumi-e | `#101111` | `#181A1A` | `#D1D5DB` | Minimalismo puro |
| Blanco | Shiro (único tema claro) | `#FAF8F5` | `#FFFFFF` | `#4A6B5B` | Papel washi, luz de día |

### Arquitectura del sistema de temas
La UI **nunca usa colores sueltos**; todo sale de 15 tokens semánticos definidos igual en cada tema:
`canvas`, `header`, `card`, `raised`, `line`, `lineSubtle`, `ink`, `muted`, `accent`, `accentSoft`, `onAccent`, `ok`, `warm`, `info`, `now`.

* [`constants/themes.ts`](constants/themes.ts): definición de los 5 temas, `THEME_ORDER`, `DEFAULT_THEME` y utilidades `hexToChannels` / `themeCssVars`.
* [`store/useThemeStore.ts`](store/useThemeStore.ts): store Zustand con `themeName`, `setTheme` y `hydrateTheme`. Persiste en la tabla `kv_store` existente con la clave `theme_v1` (SQLite en nativo, `localStorage` en web). Incluye el hook `useTheme()` que devuelve `{ theme, colors, isDark }`.
* [`tailwind.config.js`](tailwind.config.js): los tokens se exponen como colores de Tailwind con soporte de opacidad (`rgb(var(--c-canvas) / <alpha-value>)`), de modo que sirven `bg-canvas`, `border-line`, `text-ink`, `bg-accent/20`, etc.
* [`app/_layout.tsx`](app/_layout.tsx): publica el tema activo como variables CSS con `vars()` de NativeWind en la raíz, ajusta el `StatusBar` (claro/oscuro según el tema) y, en web, también escribe las variables en `<html>` para que los `Modal`/portales las hereden. Recupera el tema guardado tras abrir SQLite (`hydrateFromSQLite().then(hydrateTheme)`).
* [`global.css`](global.css): valores por defecto (Murasaki) y fondo del `body` desde `--c-canvas`.

**Regla para el código nuevo**
* Clases: `bg-canvas`, `bg-card`, `bg-raised`, `border-line`, `border-line-subtle`, `text-ink`, `text-muted`, `bg-accent`, `text-accent-soft`, `text-ok`, `text-warm`, `text-info`, `text-now`.
* Props nativas (iconos, SVG, StyleSheet): `const { colors } = useTheme();` y `colors.muted`, etc. `NotionIcon` usa `colors.ink` por defecto.
* Prohibido usar hex sueltos, `text-white`/`bg-white` o las paletas `indigo/emerald/amber/sky/rose` de Tailwind.

### Migración realizada (paso 1 y 2 de la auditoría)
* Se sustituyeron los **241 colores fijos** de 22 archivos de `app/` y `components/` por tokens (por ejemplo `bg-[#161922]` → `bg-card`, `text-white` → `text-ink`, `text-black` → `text-canvas`, `indigo` → `accent`, `emerald` → `ok`, `amber` → `warm`, `sky` → `info`, `rose` → `now`).
* Los colores pasados como props (iconos) ahora leen `colors.*` mediante `useTheme()`.
* **Decisión de diseño**: los estados "seleccionado" (día elegido en `DayStrip`, chips del selector de hora, etiqueta de arrastre) pasaron de relleno sólido a **acento tintado con borde** (`bg-accent/20 border-accent`). Un relleno sólido con texto claro no se leería en Sumi-e (acento plata) ni en Shiro; además encaja mejor con el principio de calma visual.
* En Akane el color de "hora actual" es dorado (`#E3A857`) para no confundirse con el acento rojo.
* Las opacidades no estándar (`/12`) se normalizaron a `/10`, porque Tailwind no las genera.

### Selector de tema en la app
* Componente [`components/ui/ThemePicker.tsx`](components/ui/ThemePicker.tsx) (`ThemePickerButton`).
* Botón discreto (punto del color de acento actual) junto a la campana, en la cabecera de escritorio y en la móvil.
* Abre un popover "Atmósfera" (`Modal` transparente, válido en web/iOS/Android) con los 5 temas como círculos que muestran **sus propios colores**. Al elegir, el tema se aplica en vivo bajo un velo suave, se guarda en SQLite y el popover se cierra solo a los 550 ms. Las variables de tema se pasan también al propio `Modal` por si el nativo vive en otra raíz de vistas.

### Corrección: texto cortado en la barra inferior móvil
* **Síntoma**: los iconos se veían bien pero las etiquetas ("Asistente", "Ideas", "Pendientes", "Timeline 24h") quedaban cortadas.
* **Causa**: `tabBarStyle` tenía `height: 58` fijo con `paddingTop/Bottom: 6`, dejando ~46 px para icono + etiqueta; además, al fijar la altura se ignoraba el área segura inferior (barra de gestos).
* **Solución** en [`app/(tabs)/_layout.tsx`](app/(tabs)/_layout.tsx):
  * Altura calculada `mobileTabBarHeight = 64 + insets.bottom` (con `useSafeAreaInsets`), `paddingTop: 8` y `paddingBottom: Math.max(insets.bottom, 8)`.
  * Etiquetas con `fontSize: 11`, `lineHeight: 14`, `marginTop: 3` y `tabBarAllowFontScaling: false` (el escalado de fuente del sistema las desbordaba).
  * El `SmartIntakeBar` ya no está anclado a `bottom: 58`, sino a `mobileTabBarHeight`, para no solaparse nunca con la barra.
* Pendiente de verificación visual en el móvil real de Deimar.

### Cómo ejecutar el proyecto
```bash
npm install            # solo la primera vez o tras cambiar dependencias
npm run web            # navegador (http://localhost:8081)
npm start              # QR para Expo Go (móvil)
npx expo start --web --clear   # si algo se ve raro tras tocar tailwind/babel/metro/global.css
npm run typecheck      # tsc --noEmit
```
* Con el servidor en marcha se puede seguir editando: **Fast Refresh** recarga al guardar. Los cambios en `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css` o dependencias requieren reiniciar (con `--clear`).
* **Expo Go muestra "Algo ha salido mal" / no abre el proyecto en el móvil**: el código compila (se comprobó con `npx expo export`), así que casi siempre es uno de estos dos motivos:
  1. **Versión del SDK**: el proyecto usa **Expo SDK 52**, pero Expo Go en las tiendas solo soporta la **última** versión del SDK. *No sirve actualizar Expo Go*; hay que igualar el SDK:
     * **Android**: instalar la versión de Expo Go que corresponde a SDK 52 desde <https://expo.dev/go> (se puede instalar un APK por versión de SDK), tras desinstalar la actual.
     * **iPhone físico**: Apple no permite versiones antiguas. Opciones: subir el proyecto al SDK actual (`npx expo install expo@latest`, `npx expo install --fix`, `npx expo-doctor`; revisar Reanimated, NativeWind y expo-router) o usar un *development build*.
  2. **Red**: el PC tiene varios adaptadores virtuales (WSL, VMware) y Metro puede anunciar una IP equivocada en el QR. Se fuerza la IP real del Wi-Fi/Ethernet: en PowerShell `$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.x.x"; npx expo start`. Si aun así no conecta: permitir Node.js en el Firewall de Windows (red privada) o usar `npx expo start --tunnel`.
* **Probar en el móvil sin Expo Go**: con `npm run web` en marcha y el móvil en la misma Wi-Fi, abrir `http://<IP-del-PC>:8081` en el navegador del móvil (requiere permitir el puerto 8081 en el Firewall de Windows para redes privadas). Sirve para revisar el diseño móvil; no prueba APIs nativas.
* **Android por USB**: activar *Depuración USB*, conectar el cable, `adb reverse tcp:8081 tcp:8081` y abrir `exp://localhost:8081` en Expo Go (sigue necesitando el Expo Go del SDK 52). En iPhone desde Windows no hay vía por cable para Expo Go.* En esta laptop `git` necesitó `git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"` para usar el cliente SSH de Windows.

### Hoja de ruta (resto de la auditoría de diseño)
Hecho: tokens de color (1), migración de colores (2), selector de temas (7), corrección de la barra inferior móvil.

Pendiente, en este orden:
1. **Tipografía**: cargar fuentes con `expo-font` (hoy se usa la del sistema). Propuesta: *Fraunces* (títulos/fechas), *Plus Jakarta Sans* o *Inter* (interfaz), *JetBrains Mono* (horas, `tabular-nums`) y una serif de lectura para las notas Markdown.
2. **Tamaños mínimos**: existen textos de 9 y 10 px (etiqueta "De ayer", hora en el evento); subir a 12 px mínimo, cuerpo de tareas a 15 px en móvil y zonas táctiles de 44×44 px (el botón "Fijar hora" mide ~24 px).
3. **Cuadrícula del raíl**: `quarterHeight` de 13–14 px no admite texto en bloques de 15 min; subir a ~18 px por cuarto en móvil.
4. **Concepto "Ma" (espacio negativo)**: quitar líneas de hora y la discontinua de `:30`, bloques sin borde (solo fondo tintado y barra de 2 px), más aire entre eventos y colapsar la madrugada (00:00–06:00).
5. **Microinteracciones** con Reanimated: completar tarea (relleno desde el centro y tachado animado, haptic ligero), tarea "de ayer" (punto bambú en vez de ámbar, tono amable, sin culpa), selección de cuartos de hora (fantasma con fade y "asentado" del bloque) y transición de 350 ms entre temas.
6. **Modo automático**: Shiro de día y el último tema oscuro elegido de noche, opción en Ajustes.
7. **Contraste**: verificar con un script WCAG AA (≥ 4.5:1) todos los pares texto/fondo de los 5 temas; los valores de Shiro, Sumi-e y Akane se ajustaron a ojo.
8. Limpiar la constante `COLORS` heredada de [`constants/theme.ts`](constants/theme.ts) (ya sin uso) y los mockups HTML antiguos de la raíz.

### Correcciones de experiencia móvil aplicadas (2026-10-30)
1. **Ideas → Visor y Editor de Notas (.md) (`components/ideas/IdeaNoteModal.tsx`)**:
   - **Título con puntos suspensivos**: El badge del archivo `.md` ahora tiene `numberOfLines={1}`, `ellipsizeMode="tail"` y un ancho adaptativo para que si el nombre es largo (`mi-idea-larga...md`) nunca se monte ni quede detrás del botón de descarga.
   - **Botón "Guardar" siempre visible**: El pie del modal se transformó en un layout adaptativo (`flex-col sm:flex-row`). En móviles, el botón secundario "Agendar en Timeline" se ubica arriba y los botones "Cancelar" y "Guardar" se alinean en la fila inferior. "Guardar" **nunca** se desborda ni se corta fuera del panel.

2. **Barra inferior móvil (`app/(tabs)/_layout.tsx`)**:
   - Se reemplazó la etiqueta `"Timeline 24h"` por `"Timeline"`, manteniendo nombres concisos de 1 sola palabra para todas las pestañas (*Asistente*, *Ideas*, *Pendientes*, *Timeline*).
   - Se implementó un renderizador personalizado de `tabBarLabel` con `<Text numberOfLines={1}>` forzando `white-space: nowrap` y centrado estricto para evitar que las letras se partan o corten en navegadores móviles.

3. **Calendario 24h: Tapping y Arrastre Táctil (`components/timeline/Rail24h.tsx`)**:
   - **Tapping táctil**: Se eliminó la restricción `if (Platform.OS === 'web') return;` que bloqueaba las pulsaciones en navegadores móviles. Ahora tocar cualquier cuarto de hora abre instantáneamente el selector con 30m por defecto.
   - **Arrastre táctil mediante Long-Press (Pulsación sostenida ~280ms - Estilo Google Calendar)**: Deslizar con el dedo con normalidad realiza **scroll vertical libre y fluido** por las 24 horas sin interferencias ni bloqueos. Si se mantiene el dedo pulsado ~280ms sobre una hora, se activa el modo de creación con micro-vibración háptica y al arrastrar se estira el bloque fantasma de 15m en 15m. Un toque rápido (tap) abre el selector en esa hora directamente.

---

4. **Auditoría de Diseño — Punto 1: Tamaños mínimos y Zonas táctiles ergonómicas**:
   - Se erradicaron todos los textos ilegibles de 9 y 10 px en componentes móviles y modales. Ahora todo texto de cuerpo y badges se sitúa entre 11px y 14px (text-sm).
   - **Zonas táctiles**: Los botones de acción rápida ("Fijar hora", "Agendar paso", "Nueva .md", "Hoy") se ampliaron a un mínimo de 36–40 px de altura con paddings confortables (px-3 py-1.5 / px-4 py-2).
   - Los botones de cierre e iconos interactivos en modales y tarjetas incorporan hitSlop de 10 a 12 px para facilitar el toque preciso con el pulgar en pantallas de 360–390 px.
   - Modales (slot-picker.tsx, IdeaNoteModal.tsx), pestañas (pending.tsx, chat.tsx, index.tsx) y componentes clave (SmartIntakeBar.tsx, PendingItem.tsx, EventCard.tsx, DayStrip.tsx, IdeaItem.tsx, IdeaGroupCard.tsx) completamente homogeneizados.

---

5. **Auditoría de Diseño — Punto 2: Tipografía Zen (Plus Jakarta Sans + JetBrains Mono)**:
   - Se aplicó fielmente la tipografía de la maqueta original `palette-dark-japandi.html`:
     * **Plus Jakarta Sans** (`font-sans`): Tipografía geométrica, minimalista y calmante para **toda la interfaz** (títulos, días en `DayStrip`, notas `.md`, botones y badges).
     * **JetBrains Mono** (`font-mono`): Utilizada exclusivamente para horas del raíl (`11:30 - 12:00`), cifras tabulares y bloques técnicos.
   - **Carga optimizada**: Integración en `app/_layout.tsx` mediante `useFonts()` y `expo-splash-screen`, evitando saltos o parpadeos de fuente (FOUT).
   - **Respaldo Web**: Inyección de Google Fonts CDN en `global.css` para renderizado inmediato en navegadores de escritorio y móviles.
   - **Mapeo Tailwind**: Clases `font-sans` y `font-mono` configuradas en `tailwind.config.js`.

---

6. **Auditoría de Diseño — Punto 3: Aire y Cuadrícula del Raíl ("Ma" y Pastillas Zen)**:
   - **Tira de días en pastilla (`pills`)**: Reemplazadas las cajas altas de 3 filas apiladas por pastillas horizontales compactas (`[ LUN 26 ] [ HOY 27 ]`), reduciendo la altura de la tira a unos limpios ~44 px sin saturación vertical.
   - **Erradicación del ruido visual en el raíl**: Se eliminaron las 24 líneas discontinuas de `:30` que saturaban la pantalla tipo Excel. Ahora las horas tienen una línea ultra-sutil y relajante.
   - **Mayor holgura en bloques (`quarterHeight`)**: Incrementada la altura de los cuartos de hora de 13–14 px a 17–18 px (68–72 px por hora), dando a los bloques de 15m y 30m espacio suficiente para alojar títulos y duraciones legibles sin apretujarse.
   - **Tarjetas de eventos estilo maqueta (`EventCard.tsx`)**: Fondo suave `bg-card`, franja de acento a la izquierda (`border-l-[3.5px] border-l-accent`), badge de hora en cápsula `JetBrains Mono` a la derecha.
   - **Indicador de hora actual en vivo (`NowMarker`)**: Línea horizontal viva (`border-now`) con nodo circular que marca el minuto actual sobre el eje cuando se visualiza el día de hoy.

---

### Tarea crítica pendiente para la próxima sesión: Migración a Expo SDK 58
* **Diagnóstico confirmado**: La app Expo Go instalada en el móvil de Deimar cuenta con **Expo SDK 58** (lanzado en octubre de 2026), mientras que el proyecto DayCraft fue inicializado en **Expo SDK 52**. Dado que Expo Go en Google Play / App Store solo soporta la versión mayor más reciente, rechaza abrir proyectos en SDK 52 con el error *"Algo ha salido mal"*.
* **Plan de acción para la siguiente sesión**:
  1. Crear una rama de migración: `git checkout -b chore/upgrade-expo-sdk-58`.
  2. Ejecutar `npx expo install expo@^58.0.0` y alinear dependencias: `npx expo install --fix`.
  3. Actualizar React Native (a 0.88), React (19), NativeWind v4/v5, Reanimated y SQLite a sus versiones compatibles con SDK 58.
  4. Ejecutar `npm run typecheck` y verificar que los bundlers de Metro y Tailwind compilen limpiamente.
  5. Probar la apertura nativa directa en Expo Go desde el móvil.
* **Alternativa inmediata mientras se realiza la migración**:
  - Seguir probando la app en el móvil a través de su navegador web abriendo `http://192.168.1.130:8081` (misma red Wi-Fi y puerto 8081 habilitado).