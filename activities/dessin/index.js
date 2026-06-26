const DRAW_CHANNEL_NAME = "ga-dessin-live";
const DRAW_BOARD_URL = new URL("./draw.html", import.meta.url);
const DRAW_DURATION_SECONDS = 120;
const POINTS_PER_DRAWING = 5;
const POINTS_PER_GUESS = 2;

export const activity = {
  id: "dessin",
  number: "Activité 05",
  icon: "ART",
  title: "Dessine-moi un...",
  description: "Un membre de l'équipe recevra secrètement le nom d'un objet à faire deviner. Sans jamais révéler ce mot à son coéquipier, il devra lui donner des instructions pour réaliser un dessin sur la tablette. Les autres équipes devront ensuite deviner de quoi il s'agit avant la fin du temps imparti. Si la bonne réponse est trouvée, l'équipe qui faisait deviner ainsi que l'équipe ayant donné la bonne réponse remporteront des points.",
  layout: "drawing-fullscreen",
  points: "5 pts / dessin à faire deviner - 2 pts / dessin deviné"
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
  setActiveTeam = () => {},
  incrementTeamScore = () => {},
  adjustTeamScore = null
}) {
  let channel = null;
  let drawWindow = null;
  let lastPoint = null;
  let resizeFrame = null;
  let remaining = DRAW_DURATION_SECONDS;
  let timer = null;
  let timerRunning = false;
  let drawingLocked = true;
  let currentTeamIndex = activeTeamIndex;
  let controlsCard = null;
  let controls = null;
  let countdownBadge = null;
  let startButton = null;

  container.innerHTML = `
    <section class="drawing-host" aria-label="Visualisation du dessin">
      <div class="drawing-timeout hidden" aria-live="assertive">Trop tard !</div>
      <div class="drawing-stage">
        <canvas class="drawing-preview" aria-label="Dessin en direct"></canvas>
        <aside class="drawing-guess-panel" aria-label="Équipes qui devinent"></aside>
      </div>
      <p class="drawing-status" aria-live="polite">Ouvre la fenêtre tablette, déplace-la sur l'écran secondaire, puis mets-la en plein écran.</p>
    </section>
  `;

  const canvas = container.querySelector(".drawing-preview");
  const context = canvas.getContext("2d");
  const timeoutMessage = container.querySelector(".drawing-timeout");
  const status = container.querySelector(".drawing-status");
  const guessPanel = container.querySelector(".drawing-guess-panel");

  function getCurrentTeam() {
    return teams[currentTeamIndex] || { index: currentTeamIndex, name: "Équipe" };
  }

  function addTeamPoints(teamIndex, points) {
    if (typeof adjustTeamScore === "function") {
      adjustTeamScore(teamIndex, points);
      return;
    }

    for (let point = 0; point < points; point += 1) {
      incrementTeamScore(teamIndex);
    }
  }

  function renderGuessButtons() {
    const drawingTeam = getCurrentTeam();
    guessPanel.innerHTML = "";

    teams
      .filter((team) => team.index !== drawingTeam.index)
      .forEach((team) => {
        const button = document.createElement("button");
        button.className = "drawing-guess-button";
        button.type = "button";
        button.textContent = team.name;
        button.dataset.teamIndex = String(team.index);
        button.style.setProperty("--guess-team-color", team.color || "#4f7cff");
        button.disabled = !timerRunning;
        button.addEventListener("click", handleGuessButtonClick);
        guessPanel.append(button);
      });
  }

  function clearTeamControls() {
    startButton?.removeEventListener("click", handleStartButtonClick);
    controls?.remove();
    controlsCard = null;
    controls = null;
    countdownBadge = null;
    startButton = null;
  }

  function showTeamControls() {
    const team = getCurrentTeam();
    const teamCard = document.querySelectorAll(".team-card")[team.index];
    if (!teamCard) return;

    if (controlsCard !== teamCard) {
      clearTeamControls();
      controlsCard = teamCard;
      controls = document.createElement("div");
      controls.className = "team-turn-controls";
      controls.innerHTML = `
        <div class="team-turn-countdown" aria-live="polite">${formatTime(remaining)}</div>
        <button class="team-turn-start-button" type="button">Go !</button>
      `;
      startButton = controls.querySelector(".team-turn-start-button");
      countdownBadge = controls.querySelector(".team-turn-countdown");
      startButton.addEventListener("click", handleStartButtonClick);
      teamCard.append(controls);
    }

    countdownBadge.textContent = formatTime(remaining);
    if (startButton) {
      startButton.textContent = timerRunning ? "En cours" : "Go !";
      startButton.disabled = timerRunning;
    }
  }

  function updateActiveTeam() {
    const team = getCurrentTeam();
    setActiveTeam(team.index);
    showTeamControls();
    renderGuessButtons();
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
      status.textContent = "Tablette connectée. Le dessin apparaîtra ici en direct.";
      resizeCanvas(canvas, context);
      clearPreview();
      channel?.postMessage(drawingLocked ? { type: "draw-lock", showTimeout: !timeoutMessage.classList.contains("hidden") } : { type: "draw-unlock" });
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
      status.textContent = "La fenêtre tablette a été bloquée par le navigateur. Autorise les pop-ups puis réessaie.";
      return;
    }

    drawWindow.focus();
    status.textContent = "Fenêtre tablette ouverte. Déplace-la sur l'écran secondaire puis passe-la en plein écran.";
  }

  function clearDrawing({ hideTimeout = true } = {}) {
    clearPreview();
    if (hideTimeout) {
      timeoutMessage.classList.add("hidden");
    }
    channel?.postMessage({ type: "draw-clear" });
  }

  function lockDrawing({ showTimeout = false } = {}) {
    drawingLocked = true;
    lastPoint = null;
    timeoutMessage.classList.toggle("hidden", !showTimeout);
    channel?.postMessage({ type: "draw-lock", showTimeout });
  }

  function unlockDrawing() {
    drawingLocked = false;
    timeoutMessage.classList.add("hidden");
    channel?.postMessage({ type: "draw-unlock" });
  }

  function stopTimer() {
    window.clearInterval(timer);
    timer = null;
    timerRunning = false;
  }

  function updateCountdown() {
    showTeamControls();
  }

  function finishFoundRound(guessingTeamIndex) {
    if (!timerRunning) return;

    const drawingTeam = getCurrentTeam();
    const guessingTeam = teams[guessingTeamIndex];
    if (!guessingTeam || guessingTeam.index === drawingTeam.index) return;

    stopTimer();
    addTeamPoints(drawingTeam.index, POINTS_PER_DRAWING);
    addTeamPoints(guessingTeam.index, POINTS_PER_GUESS);
    clearDrawing();
    lockDrawing();
    remaining = DRAW_DURATION_SECONDS;
    const nextTeamToPlay = nextTeam();
    status.textContent = `${guessingTeam.name} a trouvé ! ${drawingTeam.name} +${POINTS_PER_DRAWING} pts, ${guessingTeam.name} +${POINTS_PER_GUESS} pts. Prochaine équipe : ${nextTeamToPlay.name}.`;
    renderGuessButtons();
  }

  function finishTimeoutRound() {
    stopTimer();
    remaining = 0;
    updateCountdown();
    lockDrawing({ showTimeout: true });
    clearDrawing({ hideTimeout: false });
    remaining = DRAW_DURATION_SECONDS;
    const nextTeamToPlay = nextTeam();
    status.textContent = `Temps écoulé ! Prochaine équipe : ${nextTeamToPlay.name}.`;
    renderGuessButtons();
  }

  function startCountdown() {
    stopTimer();
    const team = updateActiveTeam();
    remaining = DRAW_DURATION_SECONDS;
    timerRunning = true;
    updateCountdown();
    renderGuessButtons();
    unlockDrawing();
    status.textContent = `Dessin en cours pour ${team.name} : 2 minutes pour faire deviner.`;

    timer = window.setInterval(() => {
      remaining -= 1;
      updateCountdown();

      if (remaining <= 0) {
        finishTimeoutRound();
      }
    }, 1000);
  }

  function handleStartButtonClick() {
    if (timerRunning) return;

    startCountdown();
  }

  function handleGuessButtonClick(event) {
    const guessingTeamIndex = Number(event.currentTarget.dataset.teamIndex);
    finishFoundRound(guessingTeamIndex);
  }

  scheduleResize();
  updateActiveTeam();
  channel = new BroadcastChannel(DRAW_CHANNEL_NAME);
  channel.addEventListener("message", handleMessage);
  const handleResize = scheduleResize;
  window.addEventListener("resize", handleResize);
  window.setTimeout(openDrawingWindow, 0);

  return () => {
    window.cancelAnimationFrame(resizeFrame);
    stopTimer();
    channel?.removeEventListener("message", handleMessage);
    channel?.close();
    window.removeEventListener("resize", handleResize);
    clearTeamControls();
    setActiveTeam(null);
    if (drawWindow && !drawWindow.closed) {
      drawWindow.close();
    }
  };
}

