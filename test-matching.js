const storage = require('./storage');
const { joinAndMatch, getParticipantMatch } = require('./matching');

async function runMatchingTests() {
  console.log('--- INICIANDO PRUEBAS DE AMIGO SECRETO (EMPAREJAMIENTO INMEDIATO) ---');

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
  if (r1.status !== 'waiting') throw new Error('P1 debería estar en espera al no haber nadie antes');

  // 3. Ingresa Participante 2: Ana (Femenino)
  const r2 = joinAndMatch(room, { name: 'Ana', gender: 'Femenino' });
  console.log(`✓ Participante 2 (Ana): status = ${r2.status}, amigo secreto = ${r2.matchedWith?.name}`);
  if (!r2.matchedWith || r2.matchedWith.name !== 'Carlos') {
    throw new Error('P2 (Ana) debería haberse emparejado con Carlos');
  }

  // 4. VERIFICAR QUE CARLOS (P1, EL QUE ESTABA EN ESPERA) YA NO ESTÉ EN ESPERA
  const checkCarlos = getParticipantMatch(room, 'Carlos');
  console.log(`✓ Carlos (P1, que estaba esperando) ahora tiene asignado a: ${checkCarlos.matchedWith?.name} (status = ${checkCarlos.status})`);
  if (checkCarlos.status !== 'matched' || checkCarlos.matchedWith?.name !== 'Ana') {
    throw new Error('Carlos ya NO debe estar en espera; debe estar emparejado con Ana de inmediato');
  }

  // 5. Ingresa Participante 3: Sofía (Femenino)
  const r3 = joinAndMatch(room, { name: 'Sofía', gender: 'Femenino' });
  console.log(`✓ Participante 3 (Sofía): status = ${r3.status}, mensaje = "${r3.message}"`);
  if (r3.status !== 'waiting') throw new Error('P3 (Sofía) debería estar en espera de su pareja');

  // 6. Ingresa Participante 4: David (Masculino)
  const r4 = joinAndMatch(room, { name: 'David', gender: 'Masculino' });
  console.log(`✓ Participante 4 (David): status = ${r4.status}, amigo secreto = ${r4.matchedWith?.name}`);
  if (!r4.matchedWith || r4.matchedWith.name !== 'Sofía') {
    throw new Error('P4 (David) debería haberse emparejado con Sofía');
  }

  // 7. Verificar que Sofía ya no esté en espera y tenga a David
  const checkSofia = getParticipantMatch(room, 'Sofía');
  console.log(`✓ Sofía (P3, que estaba esperando) ahora tiene asignado a: ${checkSofia.matchedWith?.name}`);
  if (checkSofia.status !== 'matched' || checkSofia.matchedWith?.name !== 'David') {
    throw new Error('Sofía ya NO debe estar en espera; debe estar emparejada con David');
  }

  // 8. Verificar biyección y no repetición en toda la sala
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
  console.log(`  - Ninguna persona da 2 regalos ni recibe 2 regalos.`);
  console.log(`  - Las parejas no se repiten.`);

  console.log('--- TODAS LAS PRUEBAS PASARON EXITOSAMENTE ---');
}

runMatchingTests().catch(err => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});
