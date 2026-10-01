# Instalar el backend (Google Sheets + Apps Script)

Necesitas una cuenta de Google. No hace falta instalar nada ni pagar.

## 1. Crear la hoja de cálculo

1. Entra en <https://sheets.google.com> y crea una hoja en blanco.
2. Ponle un nombre, por ejemplo **Exámenes test**.

No tienes que crear pestañas: el script crea `Examenes` y una pestaña `R_<id>` por cada examen publicado.

## 2. Pegar el script

1. En la hoja: **Extensiones → Apps Script**.
2. Borra el contenido de `Código.gs` y pega todo el contenido de [`Code.gs`](Code.gs).
3. Guarda (icono del disquete).

## 3. Crear el token de administración

El token es la «contraseña» del panel del profesor. Elige una larga y difícil de adivinar (no la reutilices de otro sitio).

1. En el editor de Apps Script: **Configuración del proyecto** (rueda dentada) → **Propiedades de la secuencia de comandos** → **Añadir propiedad de la secuencia de comandos**.
2. Propiedad: `ADMIN_TOKEN`. Valor: tu token. Guardar.

El token **no** debe escribirse nunca en el código ni subirse a GitHub.

## 4. Dar permisos (solo la primera vez)

1. En el editor, elige la función `setup` en el desplegable de arriba y pulsa **Ejecutar**.
2. Google pedirá autorización: **Revisar permisos** → tu cuenta → *Configuración avanzada* → *Ir a (proyecto)* → **Permitir**. (Aparece el aviso de «aplicación no verificada» porque es tu propio script.)
3. Comprueba que en la hoja ha aparecido la pestaña `Examenes`.

## 5. Desplegar como aplicación web

1. **Implementar → Nueva implementación**.
2. Tipo (rueda dentada): **Aplicación web**.
3. **Ejecutar como:** *Yo*. **Quién tiene acceso:** *Cualquier usuario*.
4. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`). Esa URL irá en `js/config.js` (fase 3).

## 6. Comprobar que funciona

Pega la URL en el navegador añadiendo `?action=list&token=TU_TOKEN`:

```
https://script.google.com/macros/s/XXXX/exec?action=list&token=TU_TOKEN
```

Debe responder `{"ok":true,"exams":[]}`. Con un token incorrecto responde `{"ok":false,"error":"unauthorized",...}`.

## Cambiar el script más adelante

Si modificas `Code.gs` hay que publicar una versión nueva **sin cambiar la URL**:
**Implementar → Gestionar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar**.
(Si eliges «Nueva implementación» obtendrás una URL distinta y tendrás que actualizar `config.js`.)

## Privacidad

- La hoja contiene las soluciones y los nombres de los alumnos: **no la compartas** con nadie.
- El repositorio de GitHub es público: nunca subas aquí archivos de exámenes ni el token.
- Solo se guardan nombre, grupo, respuestas y nota.
