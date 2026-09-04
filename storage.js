const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const FIREBASE_KEY_FILE = path.join(__dirname, 'firebase-key.json');

let firestoreDb = null;
let storageMode = 'local';
let firebaseProjectId = null;

// Intentar inicializar Firebase si existe el archivo de credenciales
try {
  if (fs.existsSync(FIREBASE_KEY_FILE)) {
    const serviceAccount = require(FIREBASE_KEY_FILE);
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');

    const existingApps = typeof getApps === 'function' ? getApps() : [];
    if (existingApps.length === 0) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }

    firestoreDb = getFirestore();
    storageMode = 'firebase';
    firebaseProjectId = serviceAccount.project_id || 'configurado';
    console.log(`🔥 [Firebase] Conectado exitosamente a Cloud Firestore (Proyecto: ${firebaseProjectId})`);
  } else {
    console.log('📁 [Almacenamiento] No se encontró "firebase-key.json". Usando almacenamiento local persistente (data/rooms.json) como respaldo.');
  }
} catch (err) {
  console.warn('⚠️ [Firebase] Error inicializando Firebase Admin SDK:', err.message);
  console.log('📁 [Almacenamiento] Operando con respaldo local (data/rooms.json).');
  firestoreDb = null;
  storageMode = 'local';
}

// Helpers para almacenamiento local
function ensureLocalDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ROOMS_FILE)) {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify({}, null, 2), 'utf-8');
  }
}

function readLocalData() {
  ensureLocalDir();
  try {
    const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Error leyendo rooms.json:', err);
    return {};
  }
}

function writeLocalData(data) {
  ensureLocalDir();
  try {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando en rooms.json:', err);
    throw err;
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const storage = {
  getMode() {
    return {
      mode: storageMode,
      isFirebase: storageMode === 'firebase',
      projectId: firebaseProjectId
    };
  },

  async createRoom({ title, maxParticipants, adminPin, notes, giftBudget, exchangeDate }) {
    let code = generateCode();

    if (firestoreDb) {
      // Verificar colisión en Firestore
      let doc = await firestoreDb.collection('rooms').doc(code).get();
      while (doc.exists) {
        code = generateCode();
        doc = await firestoreDb.collection('rooms').doc(code).get();
      }
    } else {
      const data = readLocalData();
      while (data[code]) {
        code = generateCode();
      }
    }

    const room = {
      code,
      title: title && title.trim() ? title.trim() : 'Amigo Secreto Familiar',
      maxParticipants: parseInt(maxParticipants, 10) || 5,
      adminPin: (adminPin && adminPin.trim()) ? adminPin.trim() : '1234',
      notes: notes ? notes.trim() : '',
      giftBudget: giftBudget ? giftBudget.trim() : '',
      exchangeDate: exchangeDate ? exchangeDate.trim() : '',
      status: 'waiting_participants', // 'waiting_participants' | 'completed'
      createdAt: new Date().toISOString(),
      participants: []
    };

    if (firestoreDb) {
      await firestoreDb.collection('rooms').doc(code).set(room);
    } else {
      const data = readLocalData();
      data[code] = room;
      writeLocalData(data);
    }

    return room;
  },

  async getRoom(code) {
    if (!code) return null;
    const upperCode = code.toUpperCase();

    if (firestoreDb) {
      const doc = await firestoreDb.collection('rooms').doc(upperCode).get();
      return doc.exists ? doc.data() : null;
    } else {
      const data = readLocalData();
      return data[upperCode] || null;
    }
  },

  async saveRoom(room) {
    if (!room || !room.code) return;
    const upperCode = room.code.toUpperCase();

    if (firestoreDb) {
      await firestoreDb.collection('rooms').doc(upperCode).set(room);
    } else {
      const data = readLocalData();
      data[upperCode] = room;
      writeLocalData(data);
    }
  },

  async deleteRoom(code) {
    if (!code) return false;
    const upperCode = code.toUpperCase();

    if (firestoreDb) {
      const ref = firestoreDb.collection('rooms').doc(upperCode);
      const doc = await ref.get();
      if (!doc.exists) return false;
      await ref.delete();
      return true;
    } else {
      const data = readLocalData();
      if (data[upperCode]) {
        delete data[upperCode];
        writeLocalData(data);
        return true;
      }
      return false;
    }
  },

  async listRooms() {
    if (firestoreDb) {
      const snapshot = await firestoreDb.collection('rooms').get();
      const rooms = [];
      snapshot.forEach(doc => {
        const r = doc.data();
        rooms.push({
          code: r.code,
          title: r.title,
          maxParticipants: r.maxParticipants,
          participantCount: r.participants ? r.participants.length : 0,
          status: r.status,
          createdAt: r.createdAt
        });
      });
      return rooms;
    } else {
      const data = readLocalData();
      return Object.values(data).map(r => ({
        code: r.code,
        title: r.title,
        maxParticipants: r.maxParticipants,
        participantCount: r.participants ? r.participants.length : 0,
        status: r.status,
        createdAt: r.createdAt
      }));
    }
  }
};

module.exports = storage;
