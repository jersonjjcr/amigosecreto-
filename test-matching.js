const storage = require('./storage');
const { joinAndMatch, getParticipantMatch } = require('./matching');

async function runMatchingTests() {
  console.log('--- INICIANDO PRUEBAS DE AMIGO SECRETO ---');

  // 1. Crear sala de prueba para 4 participantes
  const room = await storage.createRoom({
    title: 'Prueba Familia Gómez',
    maxParticipants: 4,
    adminPin: '9999'
  });

  console.log(`✓ Sala creada: ${room.code} (Máx: ${room.maxParticipants})`);

  // 2. Ingresa Participante 1: Carlos (Masculino)
  const r1 = joinAndMatch(room, { name: 'Carlos', gender: 'Masculino' });
  console.log(`✓ Participante 1 (Carlos): status = ${r1.status}, mensaje = "${r1.message}"`);
  if (r1.status !== 'waiting') throw new Error('P1 debería estar en espera');

  // 3. Ingresa Participante 2: Ana (Femenino)
  const r2 = joinAndMatch(room, { name: 'Ana', gender: 'Femenino' });
  console.log(`✓ Participante 2 (Ana): status = ${r2.status}, amigo secreto = ${r2.matchedWith?.name}`);
  if (!r2.matchedWith || r2.matchedWith.name !== 'Carlos') {
    throw new Error('P2 (Ana) debería haberse emparejado con Carlos');
  }

  // 4. Ingresa Participante 3: Sofía (Femenino)
  const r3 = joinAndMatch(room, { name: 'Sofía', gender: 'Femenino' });
  console.log(`✓ Participante 3 (Sofía): status = ${r3.status}, amigo secreto = ${r3.matchedWith?.name}`);
  if (!r3.matchedWith || r3.matchedWith.name !== 'Ana') {
    throw new Error('P3 (Sofía) debería haberse emparejado con Ana');
  }

  // 5. Ingresa Participante 4: David (Masculino) -> Cupo máximo completado
  const r4 = joinAndMatch(room, { name: 'David', gender: 'Masculino' });
  console.log(`✓ Participante 4 (David): status = ${r4.status}, amigo secreto = ${r4.matchedWith?.name}`);
  if (!r4.matchedWith || r4.matchedWith.name !== 'Sofía') {
    throw new Error('P4 (David) debería haberse emparejado con Sofía');
  }

  // 6. Consultar el estado de Carlos (P1) que estaba en espera
  const checkCarlos = getParticipantMatch(room, 'Carlos');
  console.log(`✓ Carlos (P1) ahora tiene asignado a: ${checkCarlos.matchedWith?.name}`);
  if (!checkCarlos.matchedWith || checkCarlos.matchedWith.name !== 'David') {
    throw new Error('Carlos debería estar emparejado con David al cerrarse el ciclo');
  }

  // 7. Verificar biyección y no repetición:
  const givers = new Set();
  const receivers = new Set();

  for (const p of room.participants) {
    if (p.givingTo === p.id) throw new Error(`Autoasignación detectada para ${p.name}`);
    if (givers.has(p.givingTo)) throw new Error(`Receptor duplicado detectado: ${p.givingTo}`);
    if (receivers.has(p.id)) throw new Error(`Dador duplicado`);
    givers.add(p.givingTo);
    receivers.add(p.id);
  }

  console.log('✓ Verificación matemática exitosa:');
  console.log(`  - Total participantes: ${room.participants.length}`);
  console.log(`  - Dadores únicos: ${givers.size}`);
  console.log(`  - Receptores únicos: ${receivers.size}`);
  console.log(`  - Nadie se regala a sí mismo.`);
  console.log(`  - Ninguna persona da 2 regalos ni recibe 2 regalos.`);

  // 8. Probar reingreso de Ana
  const recheckAna = joinAndMatch(room, { name: 'ana', gender: 'Femenino' });
  if (recheckAna.matchedWith.name !== 'Carlos') {
    throw new Error('El reingreso no devolvió la pareja original');
  }
  console.log('✓ Reingreso idempotente verificado: Ana sigue teniendo a Carlos.');

  console.log('--- TODAS LAS PRUEBAS PASARON EXITOSAMENTE ---');
}

runMatchingTests().catch(err => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});
