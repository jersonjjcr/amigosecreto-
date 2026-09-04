# 🎁 Amigo Secreto Familiar - Aplicación Web

Una aplicación web completa, responsiva y festiva para organizar el juego del **Amigo Secreto** con tu familia o amigos mediante enlaces directos para **WhatsApp**, rol de **Administrador** y **emparejamiento dinámico** sin repetición de parejas ni autoasignaciones.

---

## 🚀 Características Principales

1. **Rol de Administrador**:
   - Creación de espacios de juego configurando el **número de participantes previstos**, nombre de la sala, presupuesto opcional y fecha de entrega.
   - Generación instantánea de **enlace único de invitación**.
   - Botón directo de **Compartir en WhatsApp** con mensaje predeterminado listo para enviar al grupo familiar.
   - Panel de control protegido por **PIN**:
     - Visualización del progreso en tiempo real (cuántos faltan por ingresar).
     - Lista de participantes con su nombre y género.
     - Botón de **Privacidad / Modo Secreto**: el administrador puede jugar sin ver a quién le tocó a cada uno, o activar la vista si necesita resolver dudas.
     - Opciones de control: **Finalizar sorteo anticipadamente** o **Reiniciar sala**.

2. **Rol de Participante (Vía Enlace de WhatsApp)**:
   - Formulario directo donde selecciona su **Género** (👨 Hombre, 👩 Mujer, ⭐ Otro) e ingresa su **Nombre**.
   - Opción para sugerir gustos o preferencias de regalo.
   - **Emparejamiento Dinámico en Tiempo Real**:
     - Si ya hay participantes registrados, el sistema lo empareja inmediatamente con alguien que ya haya ingresado.
     - Si es el primero o aún no hay nadie disponible, le muestra la pantalla interactiva con el mensaje:
       > *"Aún no hay nadie para emparejar. Espera a que ingresen más participantes."*
     - La pantalla se actualiza sola en tiempo real tan pronto otro familiar entra y lo empareja.
     - **Caja de regalo sorpresa interactiva**: al tocar la caja, explota confeti y se revela el nombre de su amigo secreto.
   - **Garantía Matemática**:
     - Nadie se autoasigna.
     - Nadie da dos regalos.
     - Nadie recibe dos regalos.
     - Las parejas no se repiten.
   - **Persistencia**: Si cierran la pestaña y vuelven a ingresar con su nombre, el sistema recuerda a quién le tocó sin alterar el juego.

---

## 🛠️ Cómo Iniciar el Proyecto

### 1. Iniciar el Servidor
Abre PowerShell o terminal en la carpeta del proyecto:
```bash
cd "C:\Users\jerso\.gemini\antigravity\scratch\amigo-secreto"
node server.js
```

### 2. Abrir en el Navegador
- **Página Principal**: [http://localhost:3333/](http://localhost:3333/)
- Si estás en la misma red Wi-Fi y quieres probarlo desde los teléfonos de tu familia, puedes usar la IP local de tu computador:
  `http://<TU-IP-LOCAL>:3333/`

---

## 🧪 Pruebas Automatizadas

El proyecto incluye dos suites de pruebas para garantizar la fiabilidad del juego:
```bash
# Probar el algoritmo matemático y biyecciones
node test-matching.js

# Probar el flujo completo de APIs y salas
node test-e2e.js
```
