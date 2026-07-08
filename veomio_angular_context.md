# Contexto de Desarrollo: Veomio Angular

Este documento resume todos los cambios, implementaciones y depuraciones realizadas en la aplicación frontend de Angular (`veomiotv`) y su integración con la API de Laravel (`veomio-api`).

---

## 🚀 Características Implementadas

### 1. Pestañas y Desplazamiento de Categorías Deportivas
* **Tabs Horizontales:** Se implementó una barra de categorías deportivas con navegación horizontal fluida.
* **Botones de Navegación (Flechas):** Se agregaron botones de flecha izquierda/derecha dinámicos que se muestran habilitados/deshabilitados según la posición actual del scroll.
* **Estado de Carga y Vacío:** Si la lista está cargando o vacía, los botones de navegación se deshabilitan automáticamente y se muestra un mensaje informativo para el usuario.

### 2. Orden de Categorías
* **Fútbol Primero:** Se configuró el listado para priorizar la categoría `Fútbol (Soccer)` (`soccer`) en la primera posición de la lista de categorías, facilitando el acceso directo de los usuarios.

### 3. Selector de Fuentes Alternativas
* **Menú Desplegable (Dropdown):** Se integró un selector de **"Cambiar Fuente:"** directamente en la tarjeta del partido seleccionado en la barra lateral.
* **Actualización en Tiempo Real:** Al elegir una opción del menú, el reproductor carga y reproduce la fuente seleccionada de forma inmediata.

### 4. Enrutamiento Inteligente (Bypass de Cloudflare & CORS)
* **HTTPS Directo:** Los streams HLS seguros (`https://`) se cargan directamente en el navegador del usuario para evitar bloqueos del cortafuegos de Cloudflare (error **403 Forbidden**) que rechazan el proxy del servidor.
* **HTTP Proxied:** Las transmisiones no seguras (`http://`) pasan a través del proxy de Laravel para evitar advertencias de contenido mixto (Mixed Content) en el navegador.

---

## 📂 Archivos Modificados

### 💻 Frontend (Angular: `veomiotv`)

#### 1. [`home.html`](file:///c:/Users/cgonz/OneDrive/Documents/home/devs/code/node/veomiotv/src/app/home/home.html)
* Modificación en la lista horizontal de categorías deportivas para integrar los contenedores de scroll, clases dinámicas y las flechas de control.
* Inclusión del selector condicional `<select>` para cambiar de fuentes alternativas de vídeo, visible únicamente cuando el canal seleccionado es deportivo y contiene alternativas resueltas.
* Simplificación de la comparación del canal activo a nivel de plantilla, eliminando la comprobación por MD5 y usando comparación directa de URLs (`selectedChannel?.url === ev.url`).

#### 2. [`home.ts`](file:///c:/Users/cgonz/OneDrive/Documents/home/devs/code/node/veomiotv/src/app/home/home.ts)
* Adición del método `scrollCategories(direction: 'left' | 'right')` para manejar el desplazamiento dinámico de la lista de pestañas.
* Inclusión de lógica asíncrona dentro de `resolveAndPlay()` para consumir el endpoint `/live/sports/resolve` e inyectar dinámicamente las alternativas de transmisión.
* Adición de llamadas a `this.cdr.detectChanges()` para forzar la actualización visual del DOM en Angular tras la resolución asíncrona de las alternativas.
* Adición del helper `shouldProxy()` y reestructuración de la lógica de resolución para redirigir transmisiones HTTPS protegidas por referer al proxy de la API de Laravel.

#### 3. [`api.ts`](file:///c:/Users/cgonz/OneDrive/Documents/home/devs/code/node/veomiotv/src/app/services/api.ts)
* Configuración del endpoint de la API con detección inteligente de entornos (`localhost` vs. Producción).

---

## 🔧 Depuraciones y Correcciones Realizadas

### 1. Corrección de Error 500 en Laravel API (`urljoin`)
* **Problema:** En el archivo `LiveSportsScraperService.php`, la función auxiliar `urljoin()` utilizaba `extract(parse_url($base))` directamente. Si la URL base no tenía barra inclinada final, la variable `$path` no se inicializaba, arrojando una advertencia crítica de PHP que Laravel convertía en un error 500.
* **Solución:** Se reescribió `urljoin()` para extraer de forma segura y definir por defecto las variables (`$path = $parts['path'] ?? ''`).

### 2. Sincronización del DOM en Angular
* **Problema:** Tras resolver exitosamente las fuentes alternativas, la barra lateral no renderizaba el menú desplegable hasta que se provocaba interacción manual (click) en otro elemento.
* **Solución:** Se inyectó `ChangeDetectorRef` y se llamó a `this.cdr.detectChanges()` forzando a Angular a refrescar el DOM en cuanto finaliza la petición HTTP.

### 3. Bypass de Bloqueo Cloudflare
* **Problema:** Los servidores de CDN asociados a RoxieStreams bloqueaban las solicitudes redirigidas a través del proxy de Laravel con código **403 Forbidden** al detectar la IP del servidor.
* **Solución:** Se configuró el cliente Angular para discernir protocolos; reproduciendo `https` directamente en el navegador y delegando únicamente `http` al proxy.

### 4. Corrección de Error 403 Forbidden en Servidores de HLS Deportivos (CORS/Referer)
* **Problema:** Canales de fútbol alojados en CDN externos (ej. `formaturamaxi.com.br`, `shadow-ran` o `roxiestreams`) que usan HTTPS fallaban con error 403 al reproducirse directamente en el navegador, debido a que estos servidores restringen la reproducción a orígenes específicos e invalidan el request si falta la cabecera `Referer` adecuada (el navegador no permite inyectarla de forma nativa).
* **Solución:** Implementación del helper `shouldProxy()` en `home.ts` que redirige el flujo de vídeo a través del endpoint `/api/v1/stream` del proxy de Laravel (el cual inyecta la cabecera `Referer` y `Origin` correctas) para cualquier URL que apunte a un dominio protegido, independientemente de si usa protocolo HTTP o HTTPS.

### 5. Pérdida de Menú de Fuentes Alternativas
* **Problema:** Al seleccionar una opción del selector "Cambiar Fuente", el componente resolvía la fuente alternativa y sobreescribía la propiedad `this.selectedChannel.alternatives` con un arreglo vacío `[]` al no devolver el stream secundario más alternativas en la respuesta, haciendo desaparecer el dropdown de la interfaz.
* **Solución:** Se añadió una validación condicional que solo actualiza `selectedChannel.alternatives` si el backend responde con un listado no vacío (`response.alternatives.length > 0`), manteniendo visibles y disponibles las alternativas iniciales del evento principal.

### 6. Reubicación de Botón de Colapso Lateral
* **Problema:** El botón de colapso flotante en el centro vertical de la pantalla cortaba visualmente el reproductor y afectaba la estética general de la interfaz de usuario.
* **Solución:** Se modificaron los estilos del botón en `home.html` para reubicarlo en la parte superior derecha de la barra lateral (`top-[22px]`), alineándolo armónicamente con el logotipo corporativo y reduciendo su escala visual.
