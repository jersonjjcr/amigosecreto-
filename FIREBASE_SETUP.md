# ☁️ Guía Rápida para Conectar Firebase Firestore

Sigue estos 3 sencillos pasos para conectar la aplicación a tu propia base de datos en la nube de Firebase (es 100% gratuito):

---

### Paso 1: Crear el Proyecto en Firebase Console
1. Entra a [https://console.firebase.google.com/](https://console.firebase.google.com/) con tu cuenta de Google.
2. Haz clic en **"Crear un proyecto"** (o "Add project").
3. Escribe un nombre, por ejemplo: `amigo-secreto-familiar`.
4. Puedes deshabilitar Google Analytics (no es necesario) y haz clic en **"Crear proyecto"**.

---

### Paso 2: Activar Cloud Firestore
1. En el menú lateral izquierdo de tu proyecto, haz clic en **"Compilación" (Build)** > **"Firestore Database"**.
2. Haz clic en el botón **"Crear base de datos"**.
3. Selecciona una ubicación cercana (por ejemplo: `nam5 (us-central)` o la sugerida).
4. Elige **"Comenzar en modo de prueba"** (o modo producción) y haz clic en **Habilitar**.

---

### Paso 3: Descargar la Clave de Servicio (`firebase-key.json`)
1. Haz clic en el ícono de engranaje ⚙️ (arriba a la izquierda, junto a *Descripción general del proyecto*) y selecciona **"Configuración del proyecto"** (Project settings).
2. Ve a la pestaña **"Cuentas de servicio"** (Service accounts).
3. Selecciona **Node.js** y haz clic en el botón azul **"Generar nueva clave privada"** (Generate new private key).
4. Se descargará un archivo `.json` en tu computador.
5. Cambia el nombre de ese archivo descargado a:
   `firebase-key.json`
6. Muévelo o cópialo a la carpeta del proyecto:
   `C:\Users\jerso\.gemini\antigravity\scratch\amigo-secreto\firebase-key.json`

---

### ¡Listo! 🎉
Al reiniciar el servidor (`node server.js`):
- El sistema detectará automáticamente `firebase-key.json`.
- Todas las salas, amigos secretos y participantes quedarán guardados permanentemente en tu Cloud Firestore bajo la colección `rooms`.
- Si aún no has colocado el archivo, el sistema usará el archivo local `data/rooms.json` de forma transparente sin interrumpir tu juego.
