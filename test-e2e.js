const http = require('http');

// Helper para hacer peticiones HTTP simples en Node nativo
function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log('--- INICIANDO PRUEBAS E2E DE LA APLICACIÓN WEB ---');

  // 1. Crear Sala
  console.log('1. Creando sala de prueba...');
  const createRes = await request({
    hostname: 'localhost',
    port: 3333,
    path: '/api/rooms',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    title: 'Navidad Familia Morales',
    maxParticipants: 3,
    adminPin: '4321',
    giftBudget: '$50.000 COP',
    exchangeDate: '24 Dic'
  });

  if (createRes.status !== 201 || !createRes.data.code) {
    throw new Error('Fallo al crear la sala: ' + JSON.stringify(createRes));
  }
  const roomCode = createRes.data.code;
  console.log(`✓ Sala creada con código: ${roomCode}`);
  console.log(`✓ Enlace generado para WhatsApp: ${createRes.data.shareUrl}`);

  // 2. Ingresa Participante 1: "Pedro" (Masculino)
  console.log('2. Registrando primer participante (Pedro)...');
  const p1Res = await request({
    hostname: 'localhost',
    port: 3333,
    path: `/api/rooms/${roomCode}/join`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Pedro',
    gender: 'Masculino'
  });

  if (p1Res.status !== 200 || p1Res.data.status !== 'waiting') {
    throw new Error('P1 debería estar en estado waiting');
  }
  console.log(`✓ Pedro quedó en espera: "${p1Res.data.message}"`);

  // 3. Consultar estado de Pedro antes de que ingrese nadie más
  const p1Check = await request({
    hostname: 'localhost',
    port: 3333,
    path: `/api/rooms/${roomCode}/match?name=Pedro`,
    method: 'GET'
  });
  if (p1Check.data.status !== 'waiting') {
    throw new Error('Consulta de Pedro debería seguir en waiting');
  }
  console.log('✓ Consulta GET /match para Pedro confirma estado waiting.');

  // 4. Ingresa Participante 2: "Lucía" (Femenino)
  console.log('3. Registrando segundo participante (Lucía)...');
  const p2Res = await request({
    hostname: 'localhost',
    port: 3333,
    path: `/api/rooms/${roomCode}/join`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Lucía',
    gender: 'Femenino'
  });

  if (p2Res.status !== 200 || !p2Res.data.matchedWith || p2Res.data.matchedWith.name !== 'Pedro') {
    throw new Error('Lucía debería haberse emparejado con Pedro');
  }
  console.log(`✓ Lucía emparejada inmediatamente con: ${p2Res.data.matchedWith.name} (${p2Res.data.matchedWith.gender})`);

  // 5. Ingresa Participante 3: "Andrés" (Masculino) -> Cupo total alcanzado
  console.log('4. Registrando tercer participante (Andrés) para completar la sala...');
  const p3Res = await request({
    hostname: 'localhost',
    port: 3333,
    path: `/api/rooms/${roomCode}/join`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Andrés',
    gender: 'Masculino'
  });

  if (p3Res.status !== 200 || !p3Res.data.matchedWith || p3Res.data.matchedWith.name !== 'Lucía') {
    throw new Error('Andrés debería haberse emparejado con Lucía');
  }
  console.log(`✓ Andrés emparejado con: ${p3Res.data.matchedWith.name}`);

  // 6. Ahora Pedro (que estaba esperando) consulta su amigo secreto
  console.log('5. Verificando que Pedro ahora tenga a Andrés...');
  const p1Final = await request({
    hostname: 'localhost',
    port: 3333,
    path: `/api/rooms/${roomCode}/match?name=Pedro`,
    method: 'GET'
  });
  if (!p1Final.data.matchedWith || p1Final.data.matchedWith.name !== 'Andrés') {
    throw new Error('Pedro debería tener como amigo secreto a Andrés al completarse el ciclo');
  }
  console.log(`✓ ¡El ciclo se cerró! Pedro ahora tiene como amigo secreto a: ${p1Final.data.matchedWith.name}`);

  // 7. Intentar ingresar un 4to participante cuando el cupo era 3
  console.log('6. Validando límite de cupo...');
  const p4Res = await request({
    hostname: 'localhost',
    port: 3333,
    path: `/api/rooms/${roomCode}/join`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Extra',
    gender: 'Otro'
  });
  if (p4Res.status !== 400) {
    throw new Error('Debería rechazar participantes extras cuando la sala está llena');
  }
  console.log(`✓ Cupo lleno protegido correctamente: "${p4Res.data.error}"`);

  // 8. Consultar Panel de Administrador con PIN
  console.log('7. Verificando autenticación y datos del Administrador...');
  const adminRes = await request({
    hostname: 'localhost',
    port: 3333,
    path: `/api/rooms/${roomCode}/admin/data`,
    method: 'GET',
    headers: { 'x-admin-pin': '4321' }
  });

  if (adminRes.status !== 200 || adminRes.data.participants.length !== 3) {
    throw new Error('Panel de administración falló al retornar datos');
  }
  console.log(`✓ Panel de administración validado:`);
  console.log(`  - Título: ${adminRes.data.title}`);
  console.log(`  - Estado: ${adminRes.data.status}`);
  console.log(`  - Participantes en el admin:`);
  adminRes.data.participants.forEach(p => {
    console.log(`    * ${p.name} (${p.gender}) -> Le regala a: ${p.givesTo}`);
  });

  console.log('--- ¡TODAS LAS PRUEBAS E2E FUERON SUPERADAS CON ÉXITO! ---');
}

runE2ETests().catch(err => {
  console.error('❌ Error en pruebas E2E:', err);
  process.exit(1);
});
