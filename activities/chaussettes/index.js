const SOCK_HUNT_DURATION_SECONDS = 2 * 60;
const SOCK_MUSIC_SRC = "activities/chaussettes/sons/The_Pink_Panther.mp3";
const SOCK_GONG_SRC = "activities/chaussettes/sons/gong.mp3";
const POINTS_PER_PAIR = 3;

export const activity = {
  id: "chaussettes",
  number: "Activité 02",
  icon: "SOX",
  title: "La chasse aux chaussettes",
  description: "Pendant le temps du compte à rebours, chaque équipe devra retrouver et associer les chaussettes d'Axel et Gabriel afin de reconstituer un maximum de paires. À la fin du temps imparti, seules les paires correctement reconstituées seront comptabilisées.",
  layout: "sock-timer",
  points: "3 pts / paire"
};

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function render({ container, teams = [], incrementTeamScore = () => {}, adjustTeamScore = null }) {
  let remaining = SOCK_HUNT_DURATION_SECONDS;
  let interval = null;
  const pairsByTeam = new Map(teams.map((team) => [team.index, 0]));
  const huntMusic = new Audio(SOCK_MUSIC_SRC);
  const endGong = new Audio(SOCK_GONG_SRC);

  huntMusic.preload = "auto";
  endGong.preload = "auto";

  container.innerHTML = `
    <div class="sock-timer" id="sockTimerModule">
      <div class="sock-timer-label">Compte à rebours</div>
      <div class="sock-timer-display" id="sockTimerDisplay">${formatTime(remaining)}</div>
      <button class="sock-go-button" type="button" id="sockGoButton">Go !</button>

      <div class="sock-pair-panel" id="sockPairPanel" hidden>
        <div class="sock-pair-header">
          <strong>Paires reconstituées</strong>
          <span>1 paire = ${POINTS_PER_PAIR} points</span>
        </div>

        <div class="sock-pair-teams">
          ${teams.map((team) => `
            <article class="sock-pair-card" style="--team-color: ${team.color};">
              <span class="sock-pair-name">${team.name}</span>
              <div class="sock-pair-controls" aria-label="Paires ${team.name}">
                <button class="sock-pair-button" type="button" data-pair-delta="-1" data-team-index="${team.index}" aria-label="Retirer une paire à ${team.name}">-</button>
                <strong class="sock-pair-count" data-pair-count="${team.index}">0</strong>
                <button class="sock-pair-button" type="button" data-pair-delta="1" data-team-index="${team.index}" aria-label="Ajouter une paire à ${team.name}">+</button>
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  const timerModule = container.querySelector("#sockTimerModule");
  const display = container.querySelector("#sockTimerDisplay");
  const goButton = container.querySelector("#sockGoButton");
  const pairPanel = container.querySelector("#sockPairPanel");
  const pairTeams = container.querySelector(".sock-pair-teams");

  function stopTimer() {
    window.clearInterval(interval);
    interval = null;
  }

  function stopAudio(audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  function playAudio(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Browsers may block playback if the user has not interacted enough.
    });
  }

  function updateGlobalScore(teamIndex, pairDelta) {
    const scoreDelta = pairDelta * POINTS_PER_PAIR;

    if (typeof adjustTeamScore === "function") {
      adjustTeamScore(teamIndex, scoreDelta);
      return;
    }

    if (scoreDelta > 0) {
      for (let index = 0; index < scoreDelta; index += 1) {
        incrementTeamScore(teamIndex);
      }
    }
  }

  function setPairCount(teamIndex, pairCount) {
    pairsByTeam.set(teamIndex, pairCount);
    const count = container.querySelector(`[data-pair-count="${teamIndex}"]`);
    if (count) count.textContent = String(pairCount);
  }

  function showPairPanel() {
    timerModule.classList.add("is-finished");
    pairPanel.hidden = false;
  }

  function hidePairPanel() {
    timerModule.classList.remove("is-finished");
    pairPanel.hidden = true;
  }

  function startTimer() {
    stopTimer();
    stopAudio(endGong);
    hidePairPanel();
    remaining = SOCK_HUNT_DURATION_SECONDS;
    display.textContent = formatTime(remaining);
    goButton.textContent = "C'est parti !";
    goButton.disabled = true;
    playAudio(huntMusic);

    interval = window.setInterval(() => {
      remaining -= 1;
      display.textContent = formatTime(Math.max(remaining, 0));

      if (remaining <= 0) {
        stopTimer();
        stopAudio(huntMusic);
        playAudio(endGong);
        goButton.textContent = "Terminé !";
        showPairPanel();
      }
    }, 1000);
  }

  function handlePairClick(event) {
    const button = event.target.closest(".sock-pair-button");
    if (!button || pairPanel.hidden) return;

    const teamIndex = Number(button.dataset.teamIndex);
    const pairDelta = Number(button.dataset.pairDelta);
    const currentPairs = pairsByTeam.get(teamIndex) || 0;

    if (pairDelta < 0 && currentPairs === 0) return;

    setPairCount(teamIndex, currentPairs + pairDelta);
    updateGlobalScore(teamIndex, pairDelta);
  }

  goButton.addEventListener("click", startTimer);
  pairTeams.addEventListener("click", handlePairClick);

  return () => {
    stopTimer();
    stopAudio(huntMusic);
    stopAudio(endGong);
    goButton.removeEventListener("click", startTimer);
    pairTeams.removeEventListener("click", handlePairClick);
  };
}


