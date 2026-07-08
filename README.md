# VeomioTV 📺

VeomioTV es una aplicación frontend desarrollada en Angular (versión 21) optimizada para la visualización de televisión en vivo y eventos deportivos. Se integra con la API de Laravel (`veomio-api`) para resolver transmisiones, gestionar categorías y ofrecer múltiples reproductores adaptativos.

---

## 🚀 Características Principales

### 1. Reproducción Adaptativa y Multi-Motor 🎬
Soporta múltiples modos de reproducción de vídeo seleccionables en tiempo real para maximizar la compatibilidad:
* **Nativo (HTML5 / Hls.js):** Reproducción directa optimizada para streams HLS.
* **Vime Player:** Integración de componentes web modernos de Vime Core.
* **Video.js / Clappr:** Motores alternativos para flujos específicos.
* **Iframe Fallback:** Si un stream no puede resolverse directamente, realiza un fallback automático e interactivo encapsulando reproductores avanzados (como Plyr) en un sandbox seguro mediante Base64.

### 2. Pestañas y Navegación de Deportes ⚽
* **Priorización de Fútbol:** La categoría `Fútbol (Soccer)` se posiciona automáticamente al inicio.
* **Navegación Horizontal:** Barra de categorías fluidas con botones de scroll izquierdo/derecho dinámicos y estados de carga.

### 3. Selector de Fuentes Alternativas 🔗
* Menú desplegable integrado en la barra lateral que permite al usuario alternar entre diferentes transmisiones disponibles para un mismo evento deportivo en tiempo real.

### 4. Enrutamiento Inteligente (Bypass de CORS y Cloudflare) 🛡️
* **Streams HTTPS:** Se cargan directamente en el navegador del usuario para evadir las restricciones de IP y el cortafuegos de Cloudflare (error 403) en solicitudes de proxy.
* **Streams HTTP:** Se enrutan a través del proxy de la API de Laravel para prevenir bloqueos por contenido mixto (Mixed Content) en entornos web seguros.

### 5. Barra Lateral Interactiva 🔍
* Lista de canales con scroll infinito para carga dinámica.
* Buscador en tiempo real con optimización de solicitudes mediante temporizador de retardo (debounce).

---

## 📂 Requisitos Previos

Asegúrate de tener instalado:
* [Node.js](https://nodejs.org/) (Compatible con npm v10+)
* [Angular CLI](https://github.com/angular/angular-cli)

---

## 🛠️ Instalación y Desarrollo Local

1. Instalar las dependencias del proyecto:
   ```bash
   npm install
   ```

2. Iniciar el servidor de desarrollo local:
   ```bash
   npm start
   # o bien: ng serve
   ```

3. Abrir en tu navegador [http://localhost:4200](http://localhost:4200) para ver la aplicación corriendo.

---

## 📦 Compilación para Producción

Para construir los archivos optimizados listos para desplegar:
```bash
npm run build
```
Los archivos compilados e integrados se almacenarán en la carpeta `dist/`.

---

## 🧪 Pruebas Unitarias

Para ejecutar las pruebas del proyecto usando [Vitest](https://vitest.dev/):
```bash
npm run test
```
