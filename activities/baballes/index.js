export const activity = {
  id: "baballes",
  number: "Activité 03",
  icon: "BAL",
  title: "Panier de baballes",
  description: "Chaque joueur tente de marquer un maximum de paniers avec des petites balles dans un temps limité.",
  points: "1 pt / panier"
};

const pointsPerBasket = 1;
const roundDurationSeconds = 60;
const teamsPerRound = 3;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function render({ container, teams = [], incrementTeamScore = () => {}, adjustTeamScore = null }) {
  const basketsByTeam = new Map(teams.map((team) => [team.index, 0]));
  const rounds = [
    shuffle(teams).slice(0, teamsPerRound),
    []
  ];
  rounds[1] = teams.filter((team) => !rounds[0].some((selectedTeam) => selectedTeam.index === team.index));

  let currentRoundIndex = 0;
  let remaining = roundDurationSeconds;
  let timer = null;
  let timerRunning = false;
  let countersVisible = false;

  container.innerHTML = `
    <section class="baballes-module" aria-label="Compteurs Panier de baballes">
      <div class="baballes-hero" aria-hidden="true">
        <span class="baballes-ball ball-blue"></span>
        <span class="baballes-ball ball-yellow"></span>
        <span class="baballes-ball ball-mint"></span>
        <span class="baballes-ball ball-coral"></span>
        <strong>Panier !</strong>
      </div>

      <div class="baballes-score-panel">

        <div class="baballes-round-teams" data-round-teams></div>

        <div class="baballes-countdown" data-countdown-panel>
          <div class="baballes-countdown-label">Compte à rebours</div>
          <div class="baballes-countdown-display" data-countdown-display>${formatTime(remaining)}</div>
          <button class="baballes-start-button" type="button" data-start-button>Lancer la manche</button>
        </div>

        <div class="baballes-team-grid" data-team-grid hidden></div>
        <button class="baballes-next-round-button" type="button" data-next-round hidden>Lancer les 3 autres équipes</button>
      </div>
    </section>
  `;

  const roundTeams = container.querySelector("[data-round-teams]");
  const countdownPanel = container.querySelector("[data-countdown-panel]");
  const countdownDisplay = container.querySelector("[data-countdown-display]");
  const startButton = container.querySelector("[data-start-button]");
  const teamGrid = container.querySelector("[data-team-grid]");
  const nextRoundButton = container.querySelector("[data-next-round]");

  function getCurrentRoundTeams() {
    return rounds[currentRoundIndex] || [];
  }

  function stopTimer() {
    window.clearInterval(timer);
    timer = null;
    timerRunning = false;
  }

  function updateGlobalScore(teamIndex, delta) {
    if (typeof adjustTeamScore === "function") {
      adjustTeamScore(teamIndex, delta * pointsPerBasket);
      return;
    }

    if (delta > 0) {
      for (let point = 0; point < pointsPerBasket; point += 1) {
        incrementTeamScore(teamIndex);
      }
    }
  }

  function setBasketCount(teamIndex, basketCount) {
    basketsByTeam.set(teamIndex, basketCount);
    const count = container.querySelector(`[data-basket-count="${teamIndex}"]`);
    if (count) count.textContent = String(basketCount);
  }

  function renderRoundTeams() {
    roundTeams.innerHTML = getCurrentRoundTeams()
      .map((team) => `<span class="baballes-round-team" style="--team-color: ${team.color};">${team.name}</span>`)
      .join("");
  }

  function renderCounters() {
    teamGrid.innerHTML = getCurrentRoundTeams()
      .map((team) => `
        <article class="baballes-team-card" style="--team-color: ${team.color};">
          <span class="baballes-team-name">${team.name}</span>
          <div class="baballes-counter" aria-label="Paniers ${team.name}">
            <button class="baballes-counter-button" type="button" data-basket-delta="-1" data-team-index="${team.index}" aria-label="Retirer un panier à ${team.name}">-</button>
            <strong class="baballes-count" data-basket-count="${team.index}">${basketsByTeam.get(team.index) || 0}</strong>
            <button class="baballes-counter-button" type="button" data-basket-delta="1" data-team-index="${team.index}" aria-label="Ajouter un panier à ${team.name}">+</button>
          </div>
        </article>
      `)
      .join("");
  }

  function renderRound() {
    stopTimer();
    remaining = roundDurationSeconds;
    countersVisible = false;
    countdownDisplay.textContent = formatTime(remaining);
    startButton.disabled = false;
    startButton.textContent = "Lancer la manche";
    countdownPanel.hidden = false;
    teamGrid.hidden = true;
    nextRoundButton.hidden = true;
    renderRoundTeams();
    renderCounters();
  }

  function showCounters() {
    countersVisible = true;
    countdownPanel.hidden = true;
    teamGrid.hidden = false;
    renderCounters();

    const hasNextRound = currentRoundIndex < rounds.length - 1 && rounds[currentRoundIndex + 1].length > 0;
    nextRoundButton.hidden = !hasNextRound;
  }

  function startCountdown() {
    if (timerRunning) return;

    stopTimer();
    remaining = roundDurationSeconds;
    timerRunning = true;
    countersVisible = false;
    teamGrid.hidden = true;
    nextRoundButton.hidden = true;
    countdownPanel.hidden = false;
    countdownDisplay.textContent = formatTime(remaining);
    startButton.textContent = "C'est parti !";
    startButton.disabled = true;

    timer = window.setInterval(() => {
      remaining -= 1;
      countdownDisplay.textContent = formatTime(Math.max(remaining, 0));

      if (remaining <= 0) {
        stopTimer();
        showCounters();
      }
    }, 1000);
  }

  function goToNextRound() {
    if (timerRunning || !countersVisible || currentRoundIndex >= rounds.length - 1) return;

    currentRoundIndex += 1;
    renderRound();
  }

  function handleCounterClick(event) {
    const button = event.target.closest(".baballes-counter-button");
    if (!button || teamGrid.hidden) return;

    const teamIndex = Number(button.dataset.teamIndex);
    const delta = Number(button.dataset.basketDelta);
    const currentBaskets = basketsByTeam.get(teamIndex) || 0;

    if (delta < 0 && currentBaskets === 0) return;

    setBasketCount(teamIndex, currentBaskets + delta);
    updateGlobalScore(teamIndex, delta);
  }

  startButton.addEventListener("click", startCountdown);
  nextRoundButton.addEventListener("click", goToNextRound);
  teamGrid.addEventListener("click", handleCounterClick);

  renderRound();

  return () => {
    stopTimer();
    startButton.removeEventListener("click", startCountdown);
    nextRoundButton.removeEventListener("click", goToNextRound);
    teamGrid.removeEventListener("click", handleCounterClick);
  };
}

