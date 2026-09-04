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

  if (currentCount === 0) {
    // Caso 1: Es el primer participante en ingresar a la sala
    // No hay nadie previo con quien emparejarlo.
    room.participants.push(newParticipant);

    return {
      isExisting: false,
      participant: newParticipant,
      matchedWith: null,
      status: 'waiting',
      message: 'Aún no hay nadie para emparejar. Espera a que ingresen más participantes.'
    };
  }

  // Caso 2: Ya hay participantes registrados anteriormente
  // Buscamos candidatos elegibles que ya ingresaron su nombre y que AÚN NO tengan quién les dé un regalo.
  // Regla: no puede recibir de sí mismo (obvio porque es nuevo) y no puede tener ya un regalo asignado.
  const eligibleReceivers = room.participants.filter(
    p => p.id !== newParticipant.id && p.receivingFrom === null
  );

  let chosenReceiver = null;

  if (eligibleReceivers.length > 0) {
    // En una cadena secuencial, el último en ingresar antes de este no tiene quién le dé,
    // o podemos elegir aleatoriamente si hubiera varios disponibles.
    // Para respetar el flujo intuitivo: emparejar con el participante previo disponible.
    chosenReceiver = eligibleReceivers[eligibleReceivers.length - 1];

    // Asignamos: el nuevo participante le dará regalo a chosenReceiver
    newParticipant.givingTo = chosenReceiver.id;
    chosenReceiver.receivingFrom = newParticipant.id;
  }

  // Agregamos el nuevo participante a la sala
  room.participants.push(newParticipant);

  // Caso 3: ¿Se completó el cupo máximo con este ingreso?
  if (room.participants.length >= room.maxParticipants) {
    // Es el último participante.
    // Cerramos el ciclo: el primer participante (que no tiene a quién darle regalo todavía)
    // se le asigna el último participante (que aún no recibe de nadie).
    const firstParticipant = room.participants[0];
    if (firstParticipant && !firstParticipant.givingTo) {
      firstParticipant.givingTo = newParticipant.id;
      newParticipant.receivingFrom = firstParticipant.id;
    }
    room.status = 'completed';
  }

  return {
    isExisting: false,
    participant: newParticipant,
    matchedWith: chosenReceiver
      ? { name: chosenReceiver.name, gender: chosenReceiver.gender, preferences: chosenReceiver.giftPreferences }
      : null,
    status: chosenReceiver ? 'matched' : 'waiting',
    message: chosenReceiver
      ? `¡Felicidades! Se te ha asignado como amigo secreto a ${chosenReceiver.name}.`
      : 'Espera a que ingresen más participantes para conocer tu amigo secreto.'
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

  // Verificar si el primer participante aún no tiene a quién regalarle
  const first = room.participants[0];
  const last = room.participants[room.participants.length - 1];

  if (!first.givingTo) {
    first.givingTo = last.id;
    last.receivingFrom = first.id;
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
