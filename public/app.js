// Utilerías y Helpers Compartidos para la Aplicación

// 1. Efecto Confetti en Canvas Nativo
function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas') || createConfettiCanvas();
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ffffff'];

  for (let i = 0; i < 120; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 9 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 4 + 3,
      angle: Math.random() * 360,
      rotationSpeed: Math.random() * 6 - 3
    });
  }

  let animationFrame;
  let startTime = Date.now();

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    pieces.forEach(p => {
      p.y += p.speed;
      p.angle += p.rotationSpeed;

      if (p.y < canvas.height + 20) {
        alive = true;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (alive && Date.now() - startTime < 4500) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  animate();
}

function createConfettiCanvas() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confettiCanvas';
  document.body.appendChild(canvas);
  return canvas;
}

// 2. Sistema de Notificaciones Toast
function showToast(message, duration = 3000) {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// 3. Copiar al Portapapeles
async function copyToClipboard(text, successMsg = '¡Enlace copiado al portapapeles!') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    showToast(successMsg);
  } catch (err) {
    console.error('Error al copiar:', err);
    showToast('No se pudo copiar automáticamente.');
  }
}

// 4. Generar URL para compartir por WhatsApp
function openWhatsAppShare(shareUrl, roomTitle) {
  const text = `🎁 ¡Hola familia! Ya está abierto el juego de *Amigo Secreto* (*${roomTitle || 'Familiar'}*).\n\nEntra a este enlace para ingresar tu nombre y descubrir a quién le darás regalo:\n👉 ${shareUrl}`;
  const encoded = encodeURIComponent(text);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
  window.open(whatsappUrl, '_blank');
}

// 5. Gestión de Sesión Local de Participante (por sala)
const ParticipantSession = {
  save(roomCode, participantData) {
    try {
      localStorage.setItem(`as_p_${roomCode.toUpperCase()}`, JSON.stringify(participantData));
    } catch (e) {
      console.warn('LocalStorage no disponible');
    }
  },

  get(roomCode) {
    try {
      const data = localStorage.getItem(`as_p_${roomCode.toUpperCase()}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  clear(roomCode) {
    try {
      localStorage.removeItem(`as_p_${roomCode.toUpperCase()}`);
    } catch (e) {}
  }
};
