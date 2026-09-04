const express = require('express');
const cors = require('cors');
const path = require('path');
const storage = require('./storage');
const { joinAndMatch, getParticipantMatch, closeAndFinalize, resetRoom } = require('./matching');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3333;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Servir favicon SVG para evitar errores 404
app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml').send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎁</text></svg>');
});

// Rutas de conveniencia para URLs amigables
app.get('/game/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/admin/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- API ROUTES ---

// 0. Estado del almacenamiento (Firebase vs Local)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    storage: storage.getMode()
  });
});

// 1. Crear nueva sala (Admin)
app.post('/api/rooms', async (req, res) => {
  try {
    const { title, maxParticipants, adminPin, notes, giftBudget, exchangeDate } = req.body;

    const parsedMax = parseInt(maxParticipants, 10);
    if (isNaN(parsedMax) || parsedMax < 2) {
      return res.status(400).json({ error: 'El número mínimo de participantes debe ser al menos 2.' });
    }

    const room = await storage.createRoom({
      title,
      maxParticipants: parsedMax,
      adminPin,
      notes,
      giftBudget,
      exchangeDate
    });

    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    res.status(201).json({
      success: true,
      code: room.code,
      adminPin: room.adminPin,
      shareUrl: `${baseUrl}/game/${room.code}`,
      adminUrl: `${baseUrl}/admin/${room.code}`,
      storageMode: storage.getMode().mode,
      room: {
        code: room.code,
        title: room.title,
        maxParticipants: room.maxParticipants,
        status: room.status
      }
    });
  } catch (err) {
    console.error('Error creando sala:', err);
    res.status(500).json({ error: 'Error interno al crear la sala.' });
  }
});

// 2. Obtener información pública de la sala
app.get('/api/rooms/:code', async (req, res) => {
  try {
    const room = await storage.getRoom(req.params.code);
    if (!room) {
      return res.status(404).json({ error: 'La sala de juego no existe o el enlace es incorrecto.' });
    }

    // Devolver solo información no confidencial (no se revelan los emparejamientos)
    res.json({
      code: room.code,
      title: room.title,
      maxParticipants: room.maxParticipants,
      participantCount: room.participants ? room.participants.length : 0,
      status: room.status,
      notes: room.notes,
      giftBudget: room.giftBudget,
      exchangeDate: room.exchangeDate,
      participantsList: (room.participants || []).map(p => ({
        id: p.id,
        name: p.name,
        gender: p.gender
      }))
    });
  } catch (err) {
    console.error('Error obteniendo sala:', err);
    res.status(500).json({ error: 'Error al consultar la sala.' });
  }
});

// 3. Registrar participante y realizar emparejamiento dinámico
app.post('/api/rooms/:code/join', async (req, res) => {
  try {
    const room = await storage.getRoom(req.params.code);
    if (!room) {
      return res.status(404).json({ error: 'La sala de juego no existe.' });
    }

    const { name, gender, giftPreferences } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Por favor ingresa tu nombre.' });
    }

    if (!room.participants) {
      room.participants = [];
    }

    const result = joinAndMatch(room, { name, gender, giftPreferences });
    await storage.saveRoom(room);

    res.json({
      success: true,
      ...result,
      totalJoined: room.participants.length,
      maxParticipants: room.maxParticipants,
      roomStatus: room.status
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al unirse a la sala' });
  }
});

// 4. Consultar el amigo secreto asignado a un participante (por nombre o ID)
app.get('/api/rooms/:code/match', async (req, res) => {
  try {
    const room = await storage.getRoom(req.params.code);
    if (!room) {
      return res.status(404).json({ error: 'Sala no encontrada.' });
    }

    const query = req.query.name || req.query.id;
    if (!query) {
      return res.status(400).json({ error: 'Se requiere el nombre o ID del participante.' });
    }

    const matchData = getParticipantMatch(room, query);
    if (!matchData) {
      return res.status(404).json({ error: 'No se encontró un participante registrado con ese nombre.' });
    }

    res.json({
      success: true,
      ...matchData
    });
  } catch (err) {
    console.error('Error consultando match:', err);
    res.status(500).json({ error: 'Error consultando asignación.' });
  }
});

// Middleware simple para verificar PIN de Administrador
async function checkAdminAuth(req, res, next) {
  try {
    const room = await storage.getRoom(req.params.code);
    if (!room) {
      return res.status(404).json({ error: 'Sala no encontrada.' });
    }

    const pin = req.headers['x-admin-pin'] || req.query.pin || req.body.adminPin;
    if (!pin || String(pin).trim() !== String(room.adminPin).trim()) {
      return res.status(401).json({ error: 'PIN de administrador inválido.' });
    }

    req.room = room;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error de autenticación.' });
  }
}

// 5. Verificar PIN de Administrador
app.post('/api/rooms/:code/admin/login', async (req, res) => {
  try {
    const room = await storage.getRoom(req.params.code);
    if (!room) {
      return res.status(404).json({ error: 'Sala no encontrada.' });
    }

    const { adminPin } = req.body;
    if (!adminPin || String(adminPin).trim() !== String(room.adminPin).trim()) {
      return res.status(401).json({ error: 'PIN de Administrador incorrecto.' });
    }

    res.json({ success: true, message: 'Acceso concedido al panel de administración.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar sesión de administrador.' });
  }
});

// 6. Obtener datos completos de la sala para el Administrador
app.get('/api/rooms/:code/admin/data', checkAdminAuth, (req, res) => {
  const room = req.room;

  // Mapa para emparejamientos
  const participantMap = {};
  (room.participants || []).forEach(p => {
    participantMap[p.id] = p.name;
  });

  const fullParticipants = (room.participants || []).map(p => ({
    id: p.id,
    name: p.name,
    gender: p.gender,
    giftPreferences: p.giftPreferences,
    joinedAt: p.joinedAt,
    givesTo: p.givingTo ? participantMap[p.givingTo] || 'Asignado' : null,
    receivesFrom: p.receivingFrom ? participantMap[p.receivingFrom] || 'Asignado' : null,
    isPaired: Boolean(p.givingTo)
  }));

  res.json({
    code: room.code,
    title: room.title,
    maxParticipants: room.maxParticipants,
    notes: room.notes,
    giftBudget: room.giftBudget,
    exchangeDate: room.exchangeDate,
    status: room.status,
    totalJoined: (room.participants || []).length,
    storageMode: storage.getMode(),
    participants: fullParticipants
  });
});

// 7. Forzar cierre y emparejar participantes actuales (Admin)
app.post('/api/rooms/:code/admin/finalize', checkAdminAuth, async (req, res) => {
  try {
    const room = req.room;
    closeAndFinalize(room);
    await storage.saveRoom(room);
    res.json({ success: true, message: 'Sorteo finalizado con los participantes actuales.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Reiniciar sorteo en la sala (Admin)
app.post('/api/rooms/:code/admin/reset', checkAdminAuth, async (req, res) => {
  try {
    const room = req.room;
    resetRoom(room);
    await storage.saveRoom(room);
    res.json({ success: true, message: 'La sala ha sido reiniciada. Los participantes pueden volver a ingresar.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Iniciar servidor con recuperación de puerto
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`🎄 Servidor Amigo Secreto activo en: http://localhost:${portToTry}`);
    console.log(`📦 Modo de persistencia: ${storage.getMode().mode.toUpperCase()}`);
    if (storage.getMode().isFirebase) {
      console.log(`🔥 Proyecto Firebase: ${storage.getMode().projectId}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Puerto ${portToTry} ocupado, intentando puerto ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Error al iniciar el servidor:', err);
    }
  });
}

// Iniciar servidor si no estamos en entorno serverless (Vercel)
if (!process.env.VERCEL) {
  startServer(PORT);
}

module.exports = app;
