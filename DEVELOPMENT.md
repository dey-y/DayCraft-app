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

*Mockup de referencia:* [`mockup-web-semanal.html`](mockup-web-semanal.html)

---

## 🎯 Cierre de la Fase de Prototipado (Móvil & Web)

Con la validación de Deimar, los mockups quedan consolidados como la especificación visual y funcional definitiva:
1. 📱 **Móvil ([`mockup-mobile.html`](mockup-mobile.html))**: Experiencia ágil vertical, entrada mixta texto/voz, raíl de Time-blocking y rollover antiestrés.
2. 💻 **Escritorio ([`mockup-web-semanal.html`](mockup-web-semanal.html))**: Dashboard de 3 paneles con panel redimensionable Agenda/IA, Timeline 24h heroico como vista principal, tira horizontal deslizable de días, Cajón de ideas Kanban y cero estrés.

**Siguiente Hito**: Desarrollo del código base con React Native / Expo, TypeScript y NativeWind.


