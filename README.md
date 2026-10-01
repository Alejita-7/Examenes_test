# Exámenes tipo test con penalización

Aplicación web **gratuita** para publicar exámenes tipo test (por ejemplo, de Física y Química), compartirlos con un enlace y recibir los resultados ya corregidos **con penalización por error**.

- Los alumnos **no necesitan cuenta**: abren el enlace, escriben nombre y grupo y hacen el examen (también desde el móvil).
- Los errores restan y las preguntas en blanco no. Con 4 opciones, cada error resta 1/3 de punto.
- La corrección se hace en el servidor (Google Apps Script), no en el navegador del alumno.
- Los resultados se guardan en una hoja de cálculo de Google tuya.

```
Alumno  ──>  GitHub Pages (index.html?e=ID)  ──>  Google Apps Script  ──>  Google Sheets
Profesor ──> GitHub Pages (admin.html)       ──>  Google Apps Script  ──>  Google Sheets
```

> **Importante:** el repositorio de GitHub es **público** (GitHub Pages gratis lo exige). Por eso **nunca** debe contener las soluciones de tus exámenes ni el token. Las soluciones viven solo en tu hoja de Google. El archivo `.gitignore` ya excluye `*.gift` y `*.txt`.

---

## Instalación paso a paso

Tardarás unos 20 minutos. Necesitas una cuenta de Google y una de GitHub.

### Parte 1. Crear tu copia del repositorio

1. Entra en el repositorio en GitHub y pulsa **Fork** (arriba a la derecha) para tener tu propia copia, o crea un repositorio nuevo y sube estos archivos.
2. Comprueba que el repositorio es **público**.

### Parte 2. La hoja de cálculo y el script (backend)

1. Entra en <https://sheets.google.com> y crea una hoja en blanco llamada, por ejemplo, **Exámenes test**. No hace falta crear pestañas: el script las crea solo.
2. En la hoja: **Extensiones → Apps Script**.
3. Borra el contenido de `Código.gs` y pega todo el contenido del archivo [`apps-script/Code.gs`](apps-script/Code.gs). Guarda (icono del disquete).
4. **Crea el token de administración** (es la «contraseña» del panel del profesor):
   - Rueda dentada **Configuración del proyecto → Propiedades de la secuencia de comandos → Añadir propiedad**.
   - Propiedad: `ADMIN_TOKEN`. Valor: una contraseña larga y difícil de adivinar (que no uses en ningún otro sitio). Guardar.
   - Nunca escribas el token en el código ni lo subas a GitHub.
5. **Da permisos** (solo la primera vez): en el desplegable de funciones elige `setup`, pulsa **Ejecutar** y autoriza (*Revisar permisos → tu cuenta → Configuración avanzada → Ir a (proyecto) → Permitir*). El aviso de «aplicación no verificada» es normal: es tu propio script. Comprueba que ha aparecido la pestaña `Examenes`.
6. **Despliega la aplicación web:**
   - **Implementar → Nueva implementación**, tipo **Aplicación web**.
   - **Ejecutar como:** *Yo*. **Quién tiene acceso:** *Cualquier usuario*.
   - **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
7. Comprueba que funciona: abre en el navegador `LA_URL?action=list&token=TU_TOKEN`. Debe responder `{"ok":true,"exams":[]}`.

### Parte 3. Conectar la web con el script

1. En tu repositorio, edita el archivo [`js/config.js`](js/config.js) (en GitHub: abrir el archivo → icono del lápiz) y pega la URL entre las comillas:

   ```js
   export const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
   ```

   Esa URL **no es un secreto**: la ve cualquiera que abra un examen. El token, en cambio, nunca va aquí.
2. Guarda el cambio (**Commit changes**).

### Parte 4. Activar GitHub Pages (frontend)

1. En el repositorio: **Settings → Pages**.
2. En *Build and deployment*: **Source: Deploy from a branch**; **Branch: `main`** (o la rama donde estén los archivos) y carpeta **`/ (root)`**. **Save**.
3. Espera uno o dos minutos. GitHub te mostrará la dirección, del estilo `https://TU_USUARIO.github.io/NOMBRE_REPO/`.
4. Tu panel está en `…/admin.html`. Ábrelo, escribe tu token y ya puedes publicar.

---

## Uso diario

### Preparar un examen (formato GIFT)

Escribe las preguntas en un archivo de texto con este formato (la respuesta correcta lleva `=`, las incorrectas `~`):

```
// Los comentarios empiezan por //
::P01::¿Qué nos convierte en científicos?{
=El modo en que buscamos respuestas
~Trabajar en un laboratorio
~Usar fórmulas matemáticas
~Tener un título universitario
}

::P02::¿Cuánto es 2 + 2?{
~3
=4
~5
}
```

Reglas:
- Una pregunta por bloque; los bloques se separan con una línea en blanco.
- El título `::P01::` es opcional.
- Cada pregunta tiene **exactamente una** opción correcta (`=`) y al menos dos opciones en total.
- Si exportas desde Moodle, los pesos `%-33.33333%` se ignoran: la penalización la calcula la aplicación.
- Para escribir los caracteres `: = ~ # { }` dentro de un texto, ponles delante una barra invertida (`\=`, `\{`…).

**Guarda estos archivos fuera del repositorio** (llevan las soluciones). El `.gitignore` bloquea `*.gift` y `*.txt`, pero lo más seguro es no ponerlos nunca en la carpeta del proyecto.

### Publicar

1. Abre `admin.html` e introduce tu token (se guarda solo en tu navegador).
2. En **Crear examen**, sube el archivo (o pega el texto). Verás una vista previa con la respuesta correcta marcada; revisa que sea la que esperas. Si hay errores, la pantalla te dice en qué pregunta.
3. Rellena los ajustes: título, grupo, tiempo límite, código de acceso (opcional), barajar preguntas y opciones, mostrar la nota al terminar, permitir nota negativa y vigilar salidas (con cuántas salidas se permiten).
4. **Publicar examen.** Obtendrás un **enlace** y un **código QR** para dárselos a los alumnos.

### Examen vigilado (control de salidas)

Al publicar, la casilla **«Vigilar salidas»** viene marcada, con **3 salidas permitidas** (puedes cambiar el número, de 0 a 20). Con ella:

- Cada vez que el alumno **cambia de pestaña, de ventana o de aplicación**, o bloquea el dispositivo, se **cuenta una salida** y se mide el **tiempo que está fuera**. Al volver ve un aviso con las salidas que lleva y las que le quedan.
- Mientras no supere el límite, el alumno **puede seguir con el examen**: una notificación o un toque accidental no le cuesta la nota.
- Al **superar las salidas permitidas** (con 3, a la cuarta), el examen **se envía automáticamente** tal como esté.
- Las salidas y el tiempo fuera **quedan siempre registrados**, tanto si el alumno envía el examen él mismo como si se envía solo o se acaba el tiempo.
- La pantalla inicial explica la norma al alumno. Durante el examen se desactivan **copiar, cortar, pegar, el menú contextual y seleccionar texto** (frena la copia casual; no es infalible).
- En la hoja de resultados aparecen cuatro columnas más: `salidas`, `segundos_fuera`, `tipo_envio` (`manual`, `tiempo` o `salida`) y `envio_id`.

La nota se calcula con normalidad: la app **no pone un 0 automático**. Las columnas `salidas` y `segundos_fuera` son una señal para que decidas tú.

**Límites que conviene conocer.** Una web puede detectar que el alumno se va, pero no impedirlo, ni ver otros dispositivos (por ejemplo, un móvil al lado). El registro lo envía el navegador del alumno. Si el alumno sale y no vuelve a abrir el examen mientras le quedan salidas, no se genera ninguna fila hasta que lo envíe. Para un bloqueo real en iPad, usa el **Acceso guiado** del propio iPad (*Ajustes → Accesibilidad → Acceso guiado*; se inicia con triple clic en el botón lateral) o el modo de app única que el centro puede activar desde su sistema de gestión de dispositivos. Se complementa con esta vigilancia.

**Cómo se detecta la salida.** Se combinan varias señales, porque ninguna basta por sí sola: página oculta (otra pestaña, otra app, pantalla bloqueada), ventana sin foco, y —solo en tabletas— ventana reducida (pantalla dividida, Slide Over o Stage Manager). Si en algún dispositivo una salida no se cuenta, abre `diagnostico.html` en él: muestra en directo qué señales emite el dispositivo.

Si actualizas desde una versión anterior: los exámenes ya publicados con vigilancia pasan a tener 3 salidas permitidas, los que se publicaron sin vigilancia siguen sin vigilar, y las hojas `R_<id>` antiguas reciben las columnas nuevas automáticamente.

### Ver resultados

En **Mis exámenes** pulsa **Ver resultados** para abrir la hoja `R_<id>` de ese examen, con una fila por envío:

`fecha | nombre | grupo | aciertos | errores | blancos | nota | duracion_min | posible_duplicado | respuestas_json | salidas | segundos_fuera | tipo_envio | envio_id`

`envio_id` es un identificador interno que evita filas repetidas si un envío se reintenta. `posible_duplicado` es `TRUE` si ya había un envío con el mismo nombre y grupo (sin tener en cuenta tildes, mayúsculas ni espacios). No se bloquea el envío; solo se marca para que lo revises.

### Cerrar un examen

Desde **Mis exámenes → Cerrar examen**. Los alumnos que abran el enlace verán «Examen cerrado». Puedes volver a abrirlo cuando quieras.

### Cómo se calcula la nota

Para cada pregunta con *k* opciones: acierto **+1**, error **−1/(k−1)**, en blanco **0**.

`nota = (aciertos − Σ penalizaciones) / nº de preguntas × 10`, redondeada a 2 decimales. Por defecto la nota mínima es 0 (se puede permitir negativa al publicar el examen).

---

## Modificar el script más adelante

Si cambias `Code.gs`, hay que publicar una **versión nueva sin cambiar la URL**:

**Implementar → Gestionar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar.**

Si en su lugar eliges «Nueva implementación» obtendrás una URL distinta y tendrás que actualizar `js/config.js`.

## Qué datos se guardan

Solo **nombre, grupo, respuestas y nota** de cada alumno, en tu hoja de Google. No se piden correos ni otros datos y los alumnos no tienen cuenta. No compartas la hoja con nadie: contiene las soluciones y los nombres. Recuerda informar a las familias de este tratamiento según la política de tu centro.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El alumno ve «La aplicación no está configurada» | Falta la URL en `js/config.js` (Parte 3). |
| El panel dice «Token de administración incorrecto» | El token escrito no coincide con `ADMIN_TOKEN`. Revisa mayúsculas y espacios. |
| `token_not_configured` | No has creado la propiedad `ADMIN_TOKEN` (Parte 2, paso 4). |
| «No hay conexión con el servidor» pero hay internet | La implementación no tiene acceso *Cualquier usuario*, o la URL de `config.js` no es la de `/exec`. Revisa el paso 6 de la Parte 2. |
| Cambié `Code.gs` pero nada cambia | Falta publicar una **Nueva versión** de la implementación (ver arriba). |
| «El examen es demasiado grande» | Supera el límite de una celda de Google Sheets (~49 000 caracteres). Divídelo en dos exámenes. |
| GitHub Pages da error 404 | Espera unos minutos tras activarlo y comprueba rama y carpeta en *Settings → Pages*. |

## Para desarrolladores

No hay paso de compilación: HTML, CSS y JavaScript con módulos ES nativos.

```
index.html, admin.html     Páginas del alumno y del profesor
css/styles.css             Estilos (claro y oscuro)
js/config.js               URL del Apps Script
js/api.js                  Llamadas al Apps Script (POST como text/plain, sin preflight CORS)
js/student.js, admin.js    Lógica de cada página
js/gift.js                 Parser GIFT (función pura)
js/grading.js              Corrección (función pura; replicada en Code.gs)
js/util.js, dom.js         Utilidades
js/vendor/qrcode.js        qrcode-generator 1.4.4 (MIT), incluido para no depender de un CDN
apps-script/Code.gs        Backend (se copia a mano al editor de Apps Script)
tests/                     Tests con Node
```

Tests (requieren Node 20 o superior; no hay dependencias que instalar):

```
node --test
```

Guía de validación con Google real: [docs/PRUEBA_FINAL.md](docs/PRUEBA_FINAL.md).

`tests/codegs.test.js` carga `Code.gs` con una hoja de cálculo simulada y comprueba que su corrección coincide con `js/grading.js`. **Si cambias la lógica de corrección en uno de los dos archivos, cámbiala también en el otro.**
