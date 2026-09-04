const fs = require('fs');
const path = require('path');
const os = require('os');

// En entornos serverless como Vercel o AWS Lambda, solo /tmp es escribible
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join(os.tmpdir(), 'amigo-secreto-data') : path.join(__dirname, 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const FIREBASE_KEY_FILE = path.join(__dirname, 'firebase-key.json');

// Memoria caché para máxima resiliencia
let memoryRooms = {};

let firestoreDb = null;
let storageMode = 'local';
let firebaseProjectId = null;

// 1. Obtener credenciales de Firebase (soporta Variables de Entorno en Vercel o archivo local)
function getServiceAccount() {
  // A) Variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON completo o Base64)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (raw.startsWith('{')) {
        return JSON.parse(raw);
      } else {
        // Posible base64
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        return JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error parseando FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }

  // B) Variables de entorno individuales
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }

  // C) Archivo local firebase-key.json
  if (fs.existsSync(FIREBASE_KEY_FILE)) {
    try {
      return require(FIREBASE_KEY_FILE);
    } catch (e) {
      console.error('Error leyendo firebase-key.json:', e.message);
    }
  }

  return null;
}

// Intentar inicializar Firebase
try {
  const serviceAccount = getServiceAccount();

  if (serviceAccount && serviceAccount.project_id) {
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
    firebaseProjectId = serviceAccount.project_id;
    console.log(`🔥 [Firebase] Conectado exitosamente a Cloud Firestore (Proyecto: ${firebaseProjectId})`);
  } else {
    console.log('📁 [Almacenamiento] Firebase no configurado aún en Vercel/Local. Usando almacenamiento seguro como respaldo.');
  }
} catch (err) {
  console.warn('⚠️ [Firebase] Error inicializando Firebase Admin SDK:', err.message);
  firestoreDb = null;
  storageMode = 'local';
}

// Helpers para almacenamiento local / respaldo
function ensureLocalDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ROOMS_FILE)) {
      fs.writeFileSync(ROOMS_FILE, JSON.stringify({}, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('Advertencia creando directorio local, operando en memoria:', e.message);
  }
}

function readLocalData() {
  ensureLocalDir();
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
      const data = JSON.parse(raw || '{}');
      memoryRooms = { ...memoryRooms, ...data };
      return memoryRooms;
    }
  } catch (err) {
    console.warn('Aviso leyendo rooms.json (usando memoria):', err.message);
  }
  return memoryRooms;
}

function writeLocalData(data) {
  memoryRooms = { ...data };
  ensureLocalDir();
  try {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Aviso guardando en rooms.json (datos seguros en memoria):', err.message);
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
      projectId: firebaseProjectId,
      isServerless
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
