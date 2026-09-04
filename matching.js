const crypto = require('crypto');

function generateId() {
  return 'p_' + crypto.randomBytes(4).toString('hex');
}

/**
 * Añade un participante y aplica la lógica de emparejamiento dinámico:
 * - Si es el primero: queda en estado 'esperando participantes'.
 * - Si hay participantes anteriores sin quién les regale: el nuevo participante le regala
 *   a uno que ya haya ingresado su nombre.
 * - Cada persona solo da 1 regalo y solo recibe 1 regalo.
 * - Al completarse el cupo (o cerrar sorteo), el primer participante recibe su asignación
 *   cerrando el ciclo dirigido.
 */
function joinAndMatch(room, { name, gender, giftPreferences }) {
  if (!room) throw new Error('Sala no encontrada');

  const cleanName = (name || '').trim();
  if (!cleanName) throw new Error('El nombre es obligatorio');

  const cleanGender = (gender || 'No especificado').trim();
  const cleanPreferences = (giftPreferences || '').trim();

  // 1. Verificar si ya existe un participante con ese nombre (evitar duplicados accidentales o permitir reconexión)
  const existing = room.participants.find(
    p => p.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (existing) {
    // Si ya existe, actualizamos datos secundarios y devolvemos su estado actual
    if (cleanGender && existing.gender === 'No especificado') {
      existing.gender = cleanGender;
    }
    if (cleanPreferences && !existing.giftPreferences) {
      existing.giftPreferences = cleanPreferences;
    }

    const assignedTo = existing.givingTo
      ? room.participants.find(p => p.id === existing.givingTo)
      : null;

    return {
      isExisting: true,
      participant: existing,
      matchedWith: assignedTo
        ? { name: assignedTo.name, gender: assignedTo.gender, preferences: assignedTo.giftPreferences }
        : null,
      status: assignedTo ? 'matched' : 'waiting',
      message: assignedTo
        ? `¡Bienvenido de nuevo! Tu amigo secreto es: ${assignedTo.name}`
        : '¡Bienvenido de nuevo! Aún estás en espera de que ingresen más participantes.'
    };
  }

  // 2. Validar que no se exceda el cupo configurado
  if (room.participants.length >= room.maxParticipants) {
    throw new Error(`La sala ya alcanzó su cupo máximo de ${room.maxParticipants} participantes.`);
  }

  const newParticipant = {
    id: generateId(),
    name: cleanName,
    gender: cleanGender,
    giftPreferences: cleanPreferences,
    joinedAt: new Date().toISOString(),
    givingTo: null,      // A quién le da regalo este participante
    receivingFrom: null  // Quién le da regalo a este participante
  };

  const currentCount = room.participants.length;

  // Buscar si hay algún participante anterior esperando pareja (alguien sin givingTo)
  const waitingParticipant = room.participants.find(p => p.givingTo === null);

  if (waitingParticipant) {
    // ¡Encontramos a alguien esperando! Los emparejamos mutuamente
    waitingParticipant.givingTo = newParticipant.id;
    waitingParticipant.receivingFrom = newParticipant.id;

    newParticipant.givingTo = waitingParticipant.id;
    newParticipant.receivingFrom = waitingParticipant.id;

    room.participants.push(newParticipant);

    // Si ya se alcanzó el cupo máximo
    if (room.participants.length >= room.maxParticipants) {
      room.status = 'completed';
    }

    return {
      isExisting: false,
      participant: newParticipant,
      matchedWith: {
        name: waitingParticipant.name,
        gender: waitingParticipant.gender,
        preferences: waitingParticipant.giftPreferences
      },
      status: 'matched',
      message: `¡Emparejado con éxito! Tu amigo secreto es ${waitingParticipant.name}.`
    };
  }

  // Si nadie estaba esperando:
  // ¿Es este el último participante del cupo y el número total es impar (ej: 3, 5)?
  if (room.participants.length >= 2 && room.participants.length + 1 >= room.maxParticipants) {
    // Se integra con la última pareja para formar un trío circular perfecto (A -> B -> Nuevo -> A)
    const prev1 = room.participants[room.participants.length - 2];
    const prev2 = room.participants[room.participants.length - 1];

    prev1.givingTo = prev2.id;
    prev1.receivingFrom = newParticipant.id;

    prev2.givingTo = newParticipant.id;
    prev2.receivingFrom = prev1.id;

    newParticipant.givingTo = prev1.id;
    newParticipant.receivingFrom = prev2.id;

    room.participants.push(newParticipant);
    room.status = 'completed';

    return {
      isExisting: false,
      participant: newParticipant,
      matchedWith: {
        name: prev1.name,
        gender: prev1.gender,
        preferences: prev1.giftPreferences
      },
      status: 'matched',
      message: `¡Emparejado con éxito! Tu amigo secreto es ${prev1.name}.`
    };
  }

  // Caso: Es el primero o no hay nadie libre aún para emparejar
  room.participants.push(newParticipant);

  return {
    isExisting: false,
    participant: newParticipant,
    matchedWith: null,
    status: 'waiting',
    message: 'Aún no hay nadie para emparejar. Espera a que ingresen más participantes.'
  };
}

/**
 * Consulta la asignación de un participante por nombre o ID.
 * Útil para la pantalla de espera que consulta periódicamente (polling)
 * o cuando el usuario reabre la página en su celular.
 */
function getParticipantMatch(room, nameOrId) {
  if (!room || !nameOrId) return null;
  const clean = nameOrId.trim().toLowerCase();

  const participant = room.participants.find(
    p => p.id.toLowerCase() === clean || p.name.toLowerCase() === clean
  );

  if (!participant) return null;

  const receiver = participant.givingTo
    ? room.participants.find(p => p.id === participant.givingTo)
    : null;

  return {
    participant: {
      id: participant.id,
      name: participant.name,
      gender: participant.gender
    },
    matchedWith: receiver
      ? {
          name: receiver.name,
          gender: receiver.gender,
          preferences: receiver.giftPreferences
        }
      : null,
    status: receiver ? 'matched' : 'waiting',
    roomStatus: room.status,
    totalJoined: room.participants.length,
    maxParticipants: room.maxParticipants
  };
}

/**
 * Cierre manual / anticipado por parte del Administrador.
 * Si no se alcanzó el maxParticipants pero el admin desea sortear
 * con los participantes que ya están (mínimo 2).
 */
function closeAndFinalize(room) {
  if (!room) throw new Error('Sala no encontrada');
  if (room.participants.length < 2) {
    throw new Error('Se necesitan al menos 2 participantes para cerrar el sorteo.');
  }

  // Buscar si alguien quedó sin pareja
  const unpaired = room.participants.find(p => p.givingTo === null);
  if (unpaired && room.participants.length >= 3) {
    // Integrar al participante suelto con una pareja existente para hacer un trío
    const other1 = room.participants.find(p => p.id !== unpaired.id);
    const other2 = room.participants.find(p => p.id === other1.givingTo);

    if (other1 && other2) {
      other1.givingTo = other2.id;
      other1.receivingFrom = unpaired.id;

      other2.givingTo = unpaired.id;
      other2.receivingFrom = other1.id;

      unpaired.givingTo = other1.id;
      unpaired.receivingFrom = other2.id;
    }
  }

  room.status = 'completed';
  return room;
}

/**
 * Reiniciar la sala (borra participantes y emparejamientos)
 */
function resetRoom(room) {
  if (!room) throw new Error('Sala no encontrada');
  room.participants = [];
  room.status = 'waiting_participants';
  return room;
}

module.exports = {
  joinAndMatch,
  getParticipantMatch,
  closeAndFinalize,
  resetRoom
};
