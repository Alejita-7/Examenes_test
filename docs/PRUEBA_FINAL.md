# Prueba de principio a fin (fase 6)

Lista de comprobación para validar la instalación real con Google. Marca cada punto.
Esta guía **no contiene soluciones**: las respuestas correctas las miras tú en tu archivo GIFT, que no está en el repositorio.

## 0. Antes de empezar

- [ ] La hoja de Google tiene el script pegado y `ADMIN_TOKEN` creado.
- [ ] La implementación está como aplicación web (*Ejecutar como: yo*, *Acceso: cualquier usuario*).
- [ ] `js/config.js` tiene la URL `/exec` y GitHub Pages está activo.
- [ ] `LA_URL?action=list&token=TU_TOKEN` responde `{"ok":true,"exams":[...]}`.
- [ ] Con un token incorrecto responde `unauthorized`.

## 1. Publicar el examen (ordenador)

- [ ] Abres `…/admin.html`, escribes el token y entras.
- [ ] Subes el examen del tema 1: la vista previa muestra **20 preguntas** y cada una tiene marcada la respuesta que esperas.
- [ ] Ajustes sugeridos para la prueba: tiempo 30 min, código de acceso generado, barajar preguntas y opciones, mostrar nota **activado**.
- [ ] Publicas: aparecen el enlace y el QR.
- [ ] En la hoja de Google han aparecido la fila del examen en `Examenes` y una pestaña `R_<id>`.
- [ ] La celda `preguntas_json` contiene las soluciones (es normal: la hoja es privada). Confirma que la hoja **no está compartida** con nadie.

## 2. Hacer el examen desde el móvil

Abre el enlace (o escanea el QR) con el móvil.

- [ ] Pide nombre, grupo y código. Un código incorrecto da error; el correcto abre el examen.
- [ ] La pantalla inicial explica la puntuación («cada respuesta incorrecta resta 1/3»).
- [ ] Los botones se pulsan bien con el dedo y el texto se lee sin hacer zoom.
- [ ] «Dejar en blanco» deshace una respuesta.
- [ ] Recargas la página a mitad del examen: se conservan las respuestas y el tiempo restante sigue bajando.
- [ ] Con modo avión: el envío avisa de que no hay conexión y **no pierde** las respuestas; al volver la conexión, «Reintentar el envío» funciona.

## 3. Caso con nota calculada a mano

Contesta con exactamente estos resultados (mira tu archivo GIFT para saber cuáles son correctas e incorrectas):

| | Cantidad |
|---|---|
| Aciertos | 12 |
| Errores | 5 |
| En blanco | 3 |

Cálculo: `(12 − 5 × 1/3) / 20 × 10 = 5,1667` → **5,17**

- [ ] El alumno ve **5,17 / 10**, con 12 aciertos, 5 errores y 3 en blanco.
- [ ] En `R_<id>` hay una fila con: aciertos 12, errores 5, blancos 3, nota **5,17**, `posible_duplicado` = FALSE.
- [ ] `respuestas_json` contiene las 20 preguntas (las 3 en blanco como `null`).

Otros casos rápidos (cada uno es un envío más, con otro nombre):

| Caso | Nota esperada |
|---|---|
| 20 aciertos | 10 |
| 20 en blanco | 0 |
| 20 errores | 0 (se recorta; con «nota negativa» activada sería −3,33) |
| 16 aciertos, 2 errores, 2 en blanco | 7,67 |

## 4. Duplicados, cierre y límites

- [ ] Repites el envío con el mismo nombre y grupo, cambiando tildes o mayúsculas (por ejemplo «MARTA RUIZ» en vez de «Marta Ruiz»): la fila nueva sale con `posible_duplicado` = TRUE y no se bloquea.
- [ ] Panel → **Mis exámenes** muestra el número correcto de envíos y **Ver resultados** abre la hoja `R_<id>`.
- [ ] **Cerrar examen**: al abrir el enlace el alumno ve «Examen cerrado», y un alumno que ya lo tenía abierto no puede enviar.
- [ ] **Abrir examen** lo reactiva.
- [ ] Probar el tiempo límite: publica un examen de 1 minuto, empieza y espera: al llegar a 0 se envía solo con lo contestado.

## 4b. Examen vigilado (control de salidas)

Publica un examen con **Vigilar salidas** marcado y **2 salidas permitidas** (así se prueba rápido). Hazlo desde un iPad o móvil, con un nombre distinto en cada prueba:

- [ ] La pantalla inicial explica la norma («Puedes salir como máximo 2 veces…»).
- [ ] Arriba aparece el contador «Salidas: 0 de 2». No se puede seleccionar ni copiar el texto de las preguntas.
- [ ] **Salida 1:** sal a la pantalla de inicio, espera unos 5 segundos y vuelve. Aparece un aviso («salida número 1 de 2») y **sigues pudiendo hacer el examen** con tus respuestas intactas. El contador marca «1 de 2». En la hoja todavía **no hay fila**.
- [ ] **Salida 2:** igual. El contador marca «2 de 2» y sigues dentro.
- [ ] **Salida 3:** al salir por tercera vez y volver, el examen aparece enviado, con el aviso «superaste las salidas permitidas».
- [ ] En `R_<id>` hay **una sola fila** con `salidas` = 3, `tipo_envio` = `salida` y `segundos_fuera` con la suma del tiempo de las salidas.
- [ ] Prueba con otro nombre: sal **una vez** y envía tú el examen con el botón. La fila debe tener `salidas` = 1, `tipo_envio` = `manual` y `segundos_fuera` > 0.
- [ ] Prueba con otro nombre: sal una vez y **recarga la página** sin enviar. Al volver a entrar con el mismo nombre y grupo, sigues dentro del examen con el contador en «1 de 2».
- [ ] Prueba cambiar de pestaña y bloquear la pantalla: ambas cuentan como salida.
- [ ] **Pantalla dividida (iPad):** con el examen en una mitad y otra web en la otra, el examen cuenta **1 salida** (por el cambio de tamaño de la ventana), aunque no toques la otra web, y el tiempo corre hasta que vuelves a pantalla completa. Si no cuenta, abre `diagnostico.html` en el iPad, repite la prueba y revisa qué señales aparecen.
- [ ] Girar el iPad (vertical/horizontal) **no** cuenta como salida.
- [ ] En un examen **sin** vigilar, cambiar de app no cuenta nada ni avisa.
- [ ] Un examen publicado antes de esta versión sigue funcionando.

## 5. Privacidad (importante)

- [ ] Abre el repositorio en GitHub (o una ventana de incógnito): **no** hay ningún `.gift` ni `.txt` con exámenes, ni el token.
- [ ] Abre `…/index.html?e=ID` y revisa las herramientas de desarrollo (pestaña *Red*): la respuesta del examen **no incluye** el campo `correct`.
- [ ] La hoja de Google sigue sin compartirse.

## Si algo falla

Anota el mensaje exacto que aparece, la hora y si ocurrió en ordenador o móvil. La sección «Problemas frecuentes» del [README](../README.md) cubre los casos más comunes. En el editor de Apps Script, **Ejecuciones** muestra los errores del servidor.
