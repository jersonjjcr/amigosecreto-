const storage = require('./storage');

console.log('--- ESTADO DEL ALMACENAMIENTO ---');
const mode = storage.getMode();
console.log('Modo actual:', mode.mode);
console.log('¿Es Firebase?:', mode.isFirebase);
console.log('Proyecto ID:', mode.projectId || 'Ninguno (Esperando firebase-key.json)');

if (!mode.isFirebase) {
  console.log('\n💡 Instrucciones para activar Firebase:');
  console.log('1. Crea tu proyecto gratis en https://console.firebase.google.com/');
  console.log('2. Descarga la clave de cuenta de servicio (Service Account)');
  console.log('3. Guárdala como "firebase-key.json" en la carpeta del proyecto.');
  console.log('Consulta FIREBASE_SETUP.md para la guía completa paso a paso.');
} else {
  console.log('🔥 ¡Firebase Firestore está completamente activo y conectado!');
}
