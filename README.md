# ⚡ DayCraft AI

> **La app que elimina la fricción de diseñar tu día y captura tus ideas mediante Inteligencia Artificial.**

[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-blue.svg)](LICENSE)
[![Estilo: Notion Icons](https://img.shields.io/badge/Estilo-Notion_Icons-black)](https://notionicons.so/)
[![Framework: Expo / React Native](https://img.shields.io/badge/Mobile-Expo_React_Native-violet)](https://expo.dev/)

---

## 💡 ¿Qué es DayCraft AI?

**DayCraft AI** es un asistente personal inteligente diseñado para personas que quieren dar forma a su día y mantener sus ideas vivas, pero sienten la clásica **pereza o fricción** de tener que rellenar formularios, elegir fechas en menús complicados y clasificar tareas manualmente.

En lugar de interactuar con botones complejos, en DayCraft **simplemente hablas o escribes como lo harías con un amigo**. Un motor de Inteligencia Artificial (Gemini) se encarga de entender el contexto, estructurar la información y distribuirla en sus dos cajones principales:

1. **💡 El Cajón de Ideas**: Un espacio donde tus ocurrencias y proyectos no se pierden. La IA las conecta automáticamente con proyectos afines y te propone sugerencias para enriquecerlas.
2. **📅 El Cajón de Tareas & Calendario**: Una agenda semanal con línea de tiempo visual (*time-blocking*) que distingue entre bloques de trabajo, recordatorios puntuales y tareas del día sin hora fija.

---

## 🎯 ¿Con qué fin está hecha?

* **Vencer la procrastinación en el registro**: Capturar una idea o agendar una tarea en menos de 5 segundos, directamente desde el móvil.
* **Evitar el "cementerio de ideas"**: Las notas sueltas suelen olvidarse. DayCraft las agrupa por proyectos temáticos y te ayuda a rescatarlas de forma proactiva.
* **Organización realista y sin culpa**: Si una tarea del día no se completa, no te penaliza con listas infinitas atrasadas; la gestiona de forma inteligente mediante un sistema de *rollover antiestrés*.

---

## ✨ Características Principales

### 1. 🎙️ Entrada Única Conversacional (Smart Intake)
* Dicta por voz o escribe notas rápidas en una sola caja de texto.
* La IA detecta automáticamente si mencionas una tarea, una idea, un recordatorio o varias cosas a la vez en la misma frase, separándolas de inmediato.

### 2. 📅 Calendario Semanal con Timeline Visual
* **Tira interactiva de 7 días** con puntos indicadores de carga de trabajo.
* **Raíl horario vertical (*time-blocking*)**: Las tareas con duración ocupan franjas horarias proporcionales con hora de inicio, fin y duración estimada.
* **Recordatorios puntuales**: Avisos en un minuto exacto (pings de alerta) que no bloquean tiempo en el calendario.
* **Mensajes inteligentes según el día**:
  * *Si es hoy y estás libre*: ☕ *"Parece que hoy no tienes nada con horario, ¡tómate un descanso!"*
  * *Si es un día futuro*: 🕒 *"Día despejado. No tienes tareas ni recordatorios para esta fecha."*
  * *Si es un día pasado*: ✓ *"Día concluido. Jornada pasada sin pendientes."*

### 3. 📋 Pendientes de Hoy (Sin hora fija) & Rollover Antiestrés
* Para las cosas que quieres hacer hoy pero sin un horario cerrado (*"Comprar pilas para el mando"*).
* Si termina el día y no las completaste, pasan automáticamente a la mañana siguiente con una etiqueta sutil: `[ De ayer ]`.
* **Regla de los 3 días**: Si una tarea se aplaza 3 días consecutivos, la IA te ofrece moverla al Cajón de Ideas o archivarla sin generar agobio.

### 4. 💡 Cajón de Ideas con Agrupación Automática
* La IA detecta la temática de tus pensamientos (ej. *Tecnología*, *Negocios*, *Nutrición*) y agrupa las ideas relacionadas en **Carpetas de Proyecto** (ej. *"Proyecto: Mi App Móvil"*).
* Sugerencias automáticas generadas por IA para expandir cada idea.

### 5. 🔔 Sistema de Alertas Cero Intrusivo
* Sin banners molestos en pantalla. Una campana discreta con contador (`🔔 2`) te avisa de pendientes del día anterior o de ideas que llevan más de 10 días sin tocarse para rescatarlas.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Mobile & Web** | **React Native con Expo** | Un solo código fuente para iOS, Android y navegador Web. |
| **Diseño** | **Tailwind CSS + [Notion Icons](https://notionicons.so/)** | Estética monocroma, limpia, minimalista y profesional. |
| **Base de Datos** | **Supabase / SQLite** | Persistencia local offline con sincronización en la nube. |
| **Inteligencia Artificial** | **Google Gemini API** | Extracción estructurada en JSON y sugerencias contextuales. |
| **Extensibilidad** | **Servidor MCP (Model Context Protocol)** | Conector futuro para interactuar con la app desde Claude Desktop o ChatGPT. |

---

## 📱💻 Vistas Previas Interactivas (Mockups)

Puedes probar los prototipos interactivos ejecutables directamente en tu navegador:
* 📱 **Móvil**: [`mockup-mobile.html`](mockup-mobile.html) *(Experiencia compacta vertical, time-blocking con raíl horario y pendientes en scroll)*.
* 💻 **Web / Escritorio (Timeline Diario)**: [`mockup-web.html`](mockup-web.html) *(Dashboard panorámico en 3 columnas con Timeline 24h diaria y pendientes del día)*.
* 💻 **Web / Escritorio (Cockpit Ergonómico)**: [`mockup-web-semanal.html`](mockup-web-semanal.html) *(Dashboard con Timeline 24h heroico, tira horizontal deslizable de días, panel Agenda/IA con separador arrastrable redimensionable para Hyprland/splits, y Cajón de Ideas directo auto-agrupado)*.

*(Compatible con cualquier navegador en PC o móvil. Puedes cambiar entre días del calendario, probar los checkboxes, desplegar la campana y simular dictado por voz).*

---

## 🚀 Hoja de Ruta (Roadmap)

- [x] Concepción y diseño de la experiencia móvil (Mockups interactivos v1 a v7).
- [x] Adaptación y diseño del Dashboard Web / Escritorio ([`mockup-web.html`](mockup-web.html) y [`mockup-web-semanal.html`](mockup-web-semanal.html)).
- [x] Definición de reglas de negocio (clasificación, rollover de tareas, Notion Icons, Cajón de Ideas auto-agrupado).
- [ ] Inicialización del proyecto base con Expo y TypeScript.
- [ ] Configuración de la base de datos local / Supabase.
- [ ] Integración del motor de extracción con Gemini API (Function Calling).
- [ ] Persistencia local offline con SQLite y sincronización reactiva.
- [ ] Creación del servidor MCP para Claude y ChatGPT.

---

## 👨‍💻 Autor

**Deimar**  
*Estudiante de 1º de ASIX (Administración de Sistemas Informáticos en Red).*  
Apasionado por la Inteligencia Artificial, la automatización y el desarrollo de herramientas con propósito y ambición.

---

*Para ver el proceso de desarrollo y las decisiones de diseño paso a paso, consulta el documento [DEVELOPMENT.md](DEVELOPMENT.md).*
