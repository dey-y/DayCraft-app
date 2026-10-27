# 🛠️ DayCraft AI — Bitácora de Desarrollo y Decisiones de Diseño

Este documento recoge el proceso evolutivo de creación y diseño de **DayCraft AI**, desde la chispa inicial planteada por Deimar hasta la versión definitiva del mockup móvil (v7).

---

## 📑 Índice de Versiones
- [v1: El Concepto Inicial y Entrada Mixta](#v1-el-concepto-inicial)
- [v2: Reducción de Ruido y Avisos Proactivos](#v2-reducción-de-ruido-y-avisos-proactivos)
- [v3: Experiencia Zen, Campana Desplegable y Agrupación](#v3-experiencia-zen-campana-desplegable-y-agrupación)
- [v4: Retorno del Calendario Semanal e Iconografía Notion](#v4-retorno-del-calendario-semanal-e-iconografía-notion)
- [v5: Consistencia Extrema, Cero Emojis y Calendario Dinámico](#v5-consistencia-extrema-cero-emojis-y-calendario-dinámico)
- [v6: Time-Blocking Profesional y Mensajes Contextuales](#v6-time-blocking-profesional-y-mensajes-contextuales)
- [v7: Pendientes sin Hora Fija y Rollover Antiestrés](#v7-pendientes-sin-hora-fija-y-rollover-antiestrés)

---

## v1: El Concepto Inicial
* **Planteamiento**: Deimar propuso una app móvil para vencer la pereza de organizarse. La idea clave era poder hablarle a la IA y que ella dividiera las tareas (para agendarlas en calendario) y las ideas (para enriquecerlas y guardarlas en un cajón).
* **Lo que se diseñó**:
  * Un chat central donde al decir: *"Mañana a las 17h llamo al dentista y app de recetas"*, la IA generaba una tarjeta verde (tarea agendada) y una tarjeta ámbar (idea con sugerencias).
  * Chips estáticos de sugerencias debajo del input de texto.
* **Problema detectado por Deimar**:
  * *"No me gusta que debajo de 'háblame o escribe una idea/tarea' aparezcan sugerencias genéricas, la verdad no tiene sentido. Mejor que haga recordatorios de cosas pendientes o rescate ideas olvidadas."*

---

## v2: Reducción de Ruido y Avisos Proactivos
* **Cambios**:
  * Se eliminaron los botones de sugerencias estáticas.
  * Se colocaron banners de alerta en el cuerpo del asistente avisando de tareas de ayer sin completar y de ideas con más de 10 días inactivas.
* **Problema detectado por Deimar**:
  * *"Me parece muy intrusivo ese sistema de notificación en mitad de la pantalla. Me gustaría que aparezca un indicador como una campana para desplegarlo cuando yo quiera. Y en el cajón de ideas estaría bien agrupar ideas por proyectos. En tareas/calendario dividir Tareas y Recordatorios."*

---

## v3: Experiencia Zen, Campana Desplegable y Agrupación
* **Cambios**:
  * **Campana no intrusiva `🔔`**: Un icono sutil arriba a la derecha con contador numérico. Al tocarlo se despliega un panel flotante sin ensuciar el chat.
  * **Agrupación Automática de Ideas (Clusters)**: Las ideas afines se anidan dentro de su proyecto (ej. *"Proyecto: Mi App Móvil"*).
  * **Separación formal**: Tareas (bloques de trabajo) vs Recordatorios (pings sonoros puntuales).
* **Problema detectado por Deimar**:
  * *"Veo buena mejora en los grupos y avisos, pero quitaste mi calendario. A mí me gusta tener mi calendario para ver la semana. En cuanto al nombre, cámbialo a 'Cajón de Ideas'. Y usemos los emoticonos de notionicons.so."*

---

## v4: Retorno del Calendario Semanal e Iconografía Notion
* **Cambios**:
  * Reincorporación de la tira semanal interactiva de 7 días.
  * Nombre oficial: **Cajón de Ideas**.
  * Incorporación de iconos minimalistas estilo Notion.
* **Problema detectado por Deimar**:
  * Inconsistencias: se usaba la palabra 'Avisos' en vez de 'Recordatorios', *"Llamar al dentista"* aparecía como tarea en lugar de recordatorio puntual, y los eventos no cambiaban al pulsar los días del calendario. Además, quedaban emojis de colores en la interfaz.

---

## v5: Consistencia Extrema, Cero Emojis y Calendario Dinámico
* **Cambios**:
  * Erradicación de todos los emojis de colores (100% reemplazados por SVGs monocromos de trazo estilo Notion Icons).
  * Reclasificación de *"Llamar al dentista"* como Recordatorio puntual (17:00).
  * Calendario semanal 100% dinámico: cada día muestra únicamente sus eventos reales o su estado libre.
* **Problema detectado por Deimar**:
  * El texto plano de la hora (ej: "11:30 - 12:00") en una tarjeta no lucía como un calendario real.
  * Necesidad de mensajes más humanos cuando un día no tiene eventos.

---

## v6: Time-Blocking Profesional y Mensajes Contextuales
* **Cambios**:
  * **Timeline con Raíl Horario (Notion Calendar / Cron)**:
    * Eje vertical con las horas del día a la izquierda.
    * Tareas representadas como bloques de tiempo con hora inicial, hora final y duración calculada (`30 min`, `1h 30m`).
    * Recordatorios representados como pines horizontales a la hora exacta.
  * **Mensajes Contextuales Inteligentes**:
    * Hoy vacío: ☕ *"Parece que hoy no tienes nada con horario, ¡tómate un descanso!"*
    * Futuro vacío: 🕒 *"Día despejado. No tienes tareas ni recordatorios para esta fecha."*
    * Pasado: ✓ *"Día concluido. Jornada pasada sin pendientes."*
* **Problema detectado por Deimar**:
  * En días con pocos eventos, quedaba un hueco vertical vacío entre la timeline y el input inferior.
  * Deimar propuso la solución: una sección de tareas sin hora fija que la gente menciona al hablar sin definir hora.

---

## v7: Pendientes sin Hora Fija y Rollover Antiestrés (Versión Final)
* **Cambios**:
  * **Sección "Pendientes de hoy (Sin hora fija)"**:
    * Se ubica debajo de la timeline, rellenando el espacio de forma natural al hacer scroll hacia abajo.
    * Permite marcar tareas con checkboxes o pulsar *"Fijar hora"* para agendarlas en la timeline.
  * **Rollover Automático y Etiqueta `[ De ayer ]`**:
    * Si una tarea del día no se completa, rueda a la mañana siguiente con una pastilla `[ De ayer ]`.
    * Se aseguró con `whitespace-nowrap` y padding protegido para que jamás se parta en dos renglones.
  * **Regla Antiestrés de los 3 Días**:
    * Tras 3 días pospuesta, la IA sugiere moverla al Cajón de Ideas o archivarla sin generar culpa.
  * **Decisión de Arquitectura MCP**:
    * Se validó la propuesta de Deimar de conectar la app a herramientas como Claude o ChatGPT mediante un servidor **Model Context Protocol (MCP)** más adelante.

---

*Fin de la bitácora de diseño para la versión móvil.*
