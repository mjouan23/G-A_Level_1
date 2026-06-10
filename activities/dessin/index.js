const DRAW_CHANNEL_NAME = "ga-dessin-live";
const DRAW_BOARD_URL = new URL("./draw.html", import.meta.url);
const DRAW_DURATION_SECONDS = 60;

export const activity = {
  id: "dessin",
  number: "Activite 05",
  icon: "ART",
  title: "Dessine-moi un... les yeux bandes !",
  description: "Un joueur dessine sur la tablette pendant que l'ecran principal affiche le dessin en direct.",
  layout: "drawing-fullscreen"
};

function resizeCanvas(canvas, context) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#1f2b46";
  context.lineWidth = Math.max(6, Math.min(rect.width, rect.height) * 0.012);
}

function pointToCanvas(canvas, point) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: point.x * rect.width,
    y: point.y * rect.height
  };
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function render({
  container,
  teams = [],
  activeTeamIndex = 0,
  setActiveTeam = () => {}
}) {
  let channel = null;
  let drawWindow = null;
  let lastPoint = null;
  let resizeFrame = null;
  let remaining = DRAW_DURATION_SECONDS;
  let timer = null;
  let drawingLocked = false;
  let currentTeamIndex = activeTeamIndex;

  container.innerHTML = `
    <section class="drawing-host" aria-label="Visualisation du dessin">
      <div class="drawing-actions">
      <div class="drawing-countdown" aria-live="polite">${formatTime(remaining)}</div>
      <button class="drawing-start-button" type="button">Lancer 1 min</button>
      </div>
      <div class="drawing-timeout hidden" aria-live="assertive">Trop tard !</div>
      <canvas class="drawing-preview" aria-label="Dessin en direct"></canvas>
      <p class="drawing-status" aria-live="polite">Ouvre la fenetre tablette, deplace-la sur l'ecran secondaire, puis mets-la en plein ecran.</p>
    </section>
  `;

  const canvas = container.querySelector(".drawing-preview");
  const context = canvas.getContext("2d");
  const startButton = container.querySelector(".drawing-start-button");
  const countdown = container.querySelector(".drawing-countdown");
  const timeoutMessage = container.querySelector(".drawing-timeout");
  const status = container.querySelector(".drawing-status");

  function getCurrentTeam() {
    return teams[currentTeamIndex] || { index: currentTeamIndex, name: "Equipe" };
  }

  function updateActiveTeam() {
    const team = getCurrentTeam();
    setActiveTeam(team.index);
    return team;
  }

  function nextTeam() {
    currentTeamIndex = teams.length ? (currentTeamIndex + 1) % teams.length : 0;
    return updateActiveTeam();
  }

  function scheduleResize() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeCanvas(canvas, context);
    });
  }

  function clearPreview() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    lastPoint = null;
  }

  function drawLine(point) {
    if (drawingLocked) return;

    if (canvas.width <= 1 || canvas.height <= 1) {
      resizeCanvas(canvas, context);
    }

    const nextPoint = pointToCanvas(canvas, point);

    if (!lastPoint) {
      lastPoint = nextPoint;
    }

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
    lastPoint = nextPoint;
  }

  function handleMessage(event) {
    const message = event.data;
    if (!message || typeof message !== "object") return;

    if (message.type === "draw-ready") {
      status.textContent = "Tablette connectee. Le dessin apparaitra ici en direct.";
      resizeCanvas(canvas, context);
      clearPreview();
      channel?.postMessage({ type: drawingLocked ? "draw-lock" : "draw-unlock" });
      return;
    }

    if (message.type === "draw-clear") {
      clearPreview();
      return;
    }

    if (message.type === "draw-start") {
      if (drawingLocked) return;

      if (canvas.width <= 1 || canvas.height <= 1) {
        resizeCanvas(canvas, context);
      }

      lastPoint = pointToCanvas(canvas, message.point);
      return;
    }

    if (message.type === "draw-move") {
      if (drawingLocked) return;

      drawLine(message.point);
      return;
    }

    if (message.type === "draw-end") {
      lastPoint = null;
    }
  }

  function openDrawingWindow() {
    drawWindow = window.open(DRAW_BOARD_URL.href, "ga-dessin-tablette", "popup=yes,width=1200,height=800");

    if (!drawWindow) {
      status.textContent = "La fenetre tablette a ete bloquee par le navigateur. Autorise les pop-ups puis reessaie.";
      return;
    }

    drawWindow.focus();
    status.textContent = "Fenetre tablette ouverte. Deplace-la sur l'ecran secondaire puis passe-la en plein ecran.";
  }

  function clearDrawing({ hideTimeout = true } = {}) {
    clearPreview();
    if (hideTimeout) {
      timeoutMessage.classList.add("hidden");
    }
    channel?.postMessage({ type: "draw-clear" });
  }

  function lockDrawing() {
    drawingLocked = true;
    lastPoint = null;
    timeoutMessage.classList.remove("hidden");
    channel?.postMessage({ type: "draw-lock" });
  }

  function unlockDrawing() {
    drawingLocked = false;
    timeoutMessage.classList.add("hidden");
    channel?.postMessage({ type: "draw-unlock" });
  }

  function stopTimer() {
    window.clearInterval(timer);
    timer = null;
  }

  function updateCountdown() {
    countdown.textContent = formatTime(remaining);
  }

  function startCountdown() {
    stopTimer();
    const team = updateActiveTeam();
    remaining = DRAW_DURATION_SECONDS;
    updateCountdown();
    startButton.textContent = "C'est parti !";
    startButton.disabled = true;
    unlockDrawing();
    status.textContent = `Dessin en cours pour ${team.name} : 1 minute pour faire deviner.`;

    timer = window.setInterval(() => {
      remaining -= 1;
      updateCountdown();

      if (remaining <= 0) {
        stopTimer();
        remaining = 0;
        updateCountdown();
        lockDrawing();
        clearDrawing({ hideTimeout: false });
        const nextTeamToPlay = nextTeam();
        startButton.textContent = "Lancer 1 min";
        startButton.disabled = false;
        status.textContent = `Temps ecoule ! Prochaine equipe : ${nextTeamToPlay.name}.`;
      }
    }, 1000);
  }

  scheduleResize();
  updateActiveTeam();
  channel = new BroadcastChannel(DRAW_CHANNEL_NAME);
  channel.addEventListener("message", handleMessage);
  startButton.addEventListener("click", startCountdown);
  const handleResize = scheduleResize;
  window.addEventListener("resize", handleResize);
  window.setTimeout(openDrawingWindow, 0);

  return () => {
    window.cancelAnimationFrame(resizeFrame);
    stopTimer();
    channel?.removeEventListener("message", handleMessage);
    channel?.close();
    startButton.removeEventListener("click", startCountdown);
    window.removeEventListener("resize", handleResize);
    setActiveTeam(null);
    if (drawWindow && !drawWindow.closed) {
      drawWindow.close();
    }
  };
}
