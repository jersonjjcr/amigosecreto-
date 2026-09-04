const storage = require('./storage');

async function testFirestoreOperations() {
  console.log('--- PROBANDO OPERACIONES REALES EN FIRESTORE ---');

  console.log('1. Creando sala en Cloud Firestore...');
  const room = await storage.createRoom({
    title: 'Prueba Firebase JJCR',
    maxParticipants: 4,
    adminPin: '8888',
    notes: 'Prueba en vivo de persistencia'
  });

  console.log(`✓ Sala creada en Firestore: ${room.code}`);

  console.log('2. Consultando sala desde Firestore...');
  const fetched = await storage.getRoom(room.code);
  if (!fetched || fetched.title !== 'Prueba Firebase JJCR') {
    throw new Error('Fallo al recuperar la sala desde Cloud Firestore');
  }
  console.log(`✓ Sala recuperada exitosamente: "${fetched.title}" (Máx: ${fetched.maxParticipants})`);

  console.log('3. Eliminando sala de prueba de Firestore...');
  await storage.deleteRoom(room.code);
  const verifyDeleted = await storage.getRoom(room.code);
  if (verifyDeleted) {
    throw new Error('La sala debería haber sido eliminada');
  }
  console.log('✓ Sala de prueba eliminada correctamente.');

  console.log('--- ¡TODAS LAS OPERACIONES DE CLOUD FIRESTORE FUNCIONAN PERFECTAMENTE! ---');
}

testFirestoreOperations().catch(err => {
  console.error('Error probando Firestore:', err);
  process.exit(1);
});
