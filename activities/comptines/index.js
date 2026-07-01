export const activity = {
  id: "comptines",
  number: "Activité 06",
  icon: "LA",
  title: "N'oubliez pas les comptines !",
  description: "Toutes les équipes complètent les paroles sur téléphone. Les réponses et les points sont révélés depuis la télé.",
  layout: "comptines-fullscreen",
  points: "1 pt / mot"
};

const apiUrl = new URL("./api.php", import.meta.url).href;
const playerUrl = new URL("./player.html", import.meta.url).href;
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encodeURIComponent(playerUrl)}`;
const requestTimeout = 10000;

function normalizeWord(word) {
  return String(word || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreWords(expectedWords, submittedWords = []) {
  return expectedWords.reduce((score, expectedWord, index) => {
    return score + (normalizeWord(submittedWords[index]) === normalizeWord(expectedWord) ? 1 : 0);
  }, 0);
}

function answerLine(song, revealed) {
  if (revealed) {
    return song.words.map((word) => `<span class="comptine-answer-word">${word}</span>`).join("");
  }

  return song.words.map(() => `<span class="comptine-blank"></span>`).join("");
}

function apiFormatError(text) {
  const sample = text.trim().slice(0, 160);

  if (sample.startsWith("<?php")) {
    return "API non JSON : api.php est servi comme un fichier texte. Ouvre la page via Laragon/PHP, pas via Live Server/port 5500.";
  }

  if (/^<!doctype|^<html/i.test(sample)) {
    return "API non JSON : l'URL API renvoie une page HTML. Vérifie que l'adresse pointe bien vers Laragon et vers activities/comptines/api.php.";
  }

  return `API non JSON : ${sample || "réponse vide"}`;
}

function showComptinesError(message) {
  teamResults.hidden = false;
  teamResults.innerHTML = "";
  const errorNode = document.createElement("p");
  errorNode.className = "comptines-error";
  errorNode.textContent = message;
  teamResults.append(errorNode);
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`API HTTP ${response.status}: ${text || "réponse vide"}`);
  }

  if (!text.trim()) {
    throw new Error("API vide: Laragon/PHP ne répond pas correctement");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(apiFormatError(text));
  }
}


async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("API indisponible : Laragon/PHP ne répond pas.");
    }
    throw new Error(`API indisponible : vérifie que Laragon est lancé et que la page est ouverte via Laragon/PHP. URL appelée : ${url}`);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
async function fetchState() {
  const response = await fetchWithTimeout(apiUrl, { cache: "no-store" });
  return readJsonResponse(response);
}

async function postState(payload) {
  const response = await fetchWithTimeout(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return readJsonResponse(response);
}

export function render({ container, teams = [], incrementTeamScore = () => {} }) {
  let state = null;
  let pollTimer = null;
  let scoredRound = null;
  let revealInProgress = false;
  let consecutiveApiErrors = 0;
  let listeningRound = null;
  let promptUnlockedRound = null;
  let audioElement = null;
  let audioPlayInProgress = false;

  container.innerHTML = `
    <section class="comptines-host" aria-label="Jeu des comptines">
      <button class="rejoin-qr-button" type="button" data-rejoin-qr-toggle aria-expanded="false">QR</button>
      <div class="rejoin-qr-popover" data-rejoin-qr-popover hidden>
        <strong>Rejoindre</strong>
        <img src="${qrCodeUrl}" alt="QR code pour revenir au jeu des comptines" />
        <span>${playerUrl}</span>
      </div>
      <!--<button class="comptines-reset-game-button" type="button">Réinitialiser</button>-->
      <div class="comptines-waiting" data-waiting>
        <div class="comptines-waiting-copy">
          <div class="comptines-kicker">Connexion des équipes</div>
          <h3>Scannez le QR code</h3>
          <p>Chaque équipe choisit son nom sur son téléphone. La première comptine apparaîtra automatiquement quand les 6 équipes seront connectées.</p>
          <div class="comptines-phone-url" data-phone-url>${playerUrl}</div>
          <strong class="comptines-connected-count" data-connected-count>0/6 connectées</strong>
        </div>
        <div class="comptines-qr-card">
          <img src="${qrCodeUrl}" alt="QR code pour rejoindre le jeu des comptines" />
        </div>
        <div class="comptines-connected-teams" data-connected-teams></div>
      </div>

      <div class="comptines-listening" data-listening-panel hidden>
        <div class="comptines-kicker">Écoute de la comptine</div>
        <h3 data-listening-title></h3>
        <p class="comptines-listening-status" data-listening-status>La musique se lance...</p>
        <button class="comptines-play-button" type="button" data-listening-play hidden>Lancer l'écoute</button>
      </div>

      <div class="comptines-main" data-game-panel hidden>
        <div class="comptines-kicker">Téléphone des équipes</div>
        <div class="comptines-phone-url" data-phone-url>${playerUrl}</div>
        <h3 data-song-title></h3>
        <p class="comptines-prompt" data-song-prompt></p>
        <div class="comptines-answer-line" data-answer-line></div>
        <div class="comptines-actions">
          <button class="comptines-reveal-button" type="button">Montre la réponse</button>
          <!-- <button class="comptines-prev-button" type="button">Comptine precedente</button>-->
          <button class="comptines-next-button" type="button">Comptine suivante</button>
        </div>
      </div>
      <div class="comptines-teams" data-team-results hidden></div>
    </section>
  `;

  const qrToggleButton = container.querySelector("[data-rejoin-qr-toggle]");
  const qrPopover = container.querySelector("[data-rejoin-qr-popover]");
  const waitingPanel = container.querySelector("[data-waiting]");
  const listeningPanel = container.querySelector("[data-listening-panel]");
  const listeningTitle = container.querySelector("[data-listening-title]");
  const listeningStatus = container.querySelector("[data-listening-status]");
  const listeningPlayButton = container.querySelector("[data-listening-play]");
  const gamePanel = container.querySelector("[data-game-panel]");
  const connectedCount = container.querySelector("[data-connected-count]");
  const connectedTeams = container.querySelector("[data-connected-teams]");
  const songTitle = container.querySelector("[data-song-title]");
  const songPrompt = container.querySelector("[data-song-prompt]");
  const answerContainer = container.querySelector("[data-answer-line]");
  const revealButton = container.querySelector(".comptines-reveal-button");
  // const prevButton = container.querySelector(".comptines-prev-button");
  const nextButton = container.querySelector(".comptines-next-button");
  const teamResults = container.querySelector("[data-team-results]");
  const resetGameButton = container.querySelector(".comptines-reset-game-button");

  function initializeStableView() {
    waitingPanel.hidden = false;
    listeningPanel.hidden = true;
    gamePanel.hidden = true;
    teamResults.hidden = true;
    connectedCount.textContent = "0/6 connectées";
    connectedTeams.innerHTML = "";
    songTitle.textContent = "";
    songPrompt.textContent = "";
    answerContainer.innerHTML = "";
    revealButton.disabled = true;
  }

  function toggleQrPopover() {
    const hidden = !qrPopover.hidden;
    qrPopover.hidden = hidden;
    qrToggleButton.setAttribute("aria-expanded", String(!hidden));
  }

  function songAudioUrl(song) {
    return song?.mp3 ? new URL(song.mp3, apiUrl).href : "";
  }

  function stopIntroAudio() {
    if (!audioElement) return;

    audioElement.pause();
    audioElement.removeAttribute("src");
    audioElement.load();
    audioElement = null;
    audioPlayInProgress = false;
  }

  async function unlockPromptForCurrentRound() {
    if (!state) return;

    promptUnlockedRound = state.round;
    listeningPanel.hidden = true;

    try {
      renderState(await postState({ action: "introDone" }));
    } catch (error) {
      renderState({ ...state, introDone: true });
    }
  }

  async function playIntroAudio(song) {
    const mp3Url = songAudioUrl(song);
    if (!mp3Url) {
      unlockPromptForCurrentRound();
      return;
    }

    stopIntroAudio();
    audioPlayInProgress = true;
    listeningPlayButton.hidden = true;
    listeningStatus.textContent = "Écoutez la comptine...";

    audioElement = new Audio(mp3Url);
    audioElement.preload = "auto";
    audioElement.addEventListener("ended", unlockPromptForCurrentRound, { once: true });
    audioElement.addEventListener("error", () => {
      audioPlayInProgress = false;
      listeningPlayButton.hidden = false;
      listeningStatus.textContent = "Impossible de lire le MP3. Lance l'écoute manuellement ou passe à la suite.";
    }, { once: true });

    try {
      await audioElement.play();
    } catch (error) {
      audioPlayInProgress = false;
      listeningPlayButton.hidden = false;
      listeningStatus.textContent = "Clique sur \"Lancer l'écoute\" pour démarrer la musique.";
    }
  }

  function renderListening(song) {
    waitingPanel.hidden = true;
    listeningPanel.hidden = false;
    gamePanel.hidden = true;
    teamResults.hidden = true;
    listeningTitle.textContent = song.title;

    if (listeningRound !== state.round) {
      listeningRound = state.round;
      listeningStatus.textContent = "La musique se lance...";
      playIntroAudio(song);
    }
  }
  function renderWaiting() {
    const participants = state?.participants || {};
    const participantCount = state?.participantCount || 0;
    const teamCount = state?.teamCount || teams.length;

    connectedCount.textContent = `${participantCount}/${teamCount} connectées`;
    connectedTeams.innerHTML = teams
      .map((team) => {
        const connected = Boolean(participants[String(team.index)]);
        return `
          <span class="comptines-connected-team ${connected ? "is-connected" : ""}" style="--team-color: ${team.color}">
            ${team.name}
          </span>
        `;
      })
      .join("");
  }

  function renderTeams() {
    const submissions = state?.submissions || {};
    const song = state?.currentSong;
    if (!song) return;

    teamResults.innerHTML = teams
      .map((team) => {
        const submission = submissions[String(team.index)];
        const words = submission?.words || [];
        const score = scoreWords(song.words, words);
        const wordsHtml = state.revealed
          ? song.words.map((expectedWord, index) => {
              const submittedWord = words[index] || "";
              const valid = normalizeWord(submittedWord) === normalizeWord(expectedWord);
              return `<span class="comptine-team-word ${valid ? "valid" : "wrong"}">${submittedWord || "-"}</span>`;
            }).join("")
          : `<span class="comptine-team-pending">${submission ? "Réponse envoyée" : "En attente"}</span>`;

        return `
          <article class="comptine-team-result" style="--team-color: ${team.color}">
            <strong>${team.name}</strong>
            <div class="comptine-team-score">${state.revealed ? `${score}/${song.words.length}` : "..."}</div>
            <div class="comptine-team-words">${wordsHtml}</div>
          </article>
        `;
      })
      .join("");
  }

  function renderState(nextState) {
    state = nextState;
    const isReady = Boolean(state.ready);

    waitingPanel.hidden = isReady;
    gamePanel.hidden = !isReady;
    teamResults.hidden = !isReady;

    if (!isReady) {
      renderWaiting();
      return;
    }

    const song = state.currentSong;
    songTitle.textContent = song.title;
    songPrompt.textContent = song.prompt;
    answerContainer.innerHTML = answerLine(song, state.revealed);
    revealButton.disabled = state.revealed;
    renderTeams();
  }

  function scoreRound(nextState, { requireRevealed = false } = {}) {
    if (!nextState || (requireRevealed && !nextState.revealed) || scoredRound === nextState.round) return;

    scoredRound = nextState.round;
    const song = nextState.currentSong;
    teams.forEach((team) => {
      const words = nextState.submissions?.[String(team.index)]?.words || [];
      const score = scoreWords(song.words, words);
      for (let point = 0; point < score; point += 1) {
        incrementTeamScore(team.index);
      }
    });
  }

  async function refresh() {
    let nextState;

    try {
      nextState = await fetchState();
      consecutiveApiErrors = 0;
    } catch (error) {
      consecutiveApiErrors += 1;
      if (consecutiveApiErrors >= 3) {
        teamResults.hidden = false;
        teamResults.innerHTML = `<p class="comptines-error">${error.message || "API indisponible. Vérifie que la page passe par Laragon/PHP."}</p>`;
      }
      return;
    }

    try {
      renderState(nextState);
    } catch (error) {
      teamResults.hidden = false;
      teamResults.innerHTML = `<p class="comptines-error">Erreur affichage comptines: ${error.message}</p>`;
    }
  }

  // async function restartGame() {
  //   const confirmed = window.confirm("Réinitialiser la partie comptines ?");
  //   if (!confirmed) return;

  //   scoredRound = null;
  //   renderState(await postState({ action: "restart" }));
  // }

  async function revealAnswer() {
    if (revealInProgress || state?.revealed) return;

    revealInProgress = true;
    revealButton.disabled = true;

    try {
      const nextState = await postState({ action: "reveal" });
      renderState(nextState);
    } finally {
      revealInProgress = false;
      if (!state?.revealed) {
        revealButton.disabled = false;
      }
    }
  }

  async function goToNextSong() {
    const latestState = await fetchState();
    scoreRound(latestState, { requireRevealed: true });

    const nextIndex = latestState?.songs?.length ? (latestState.songIndex + 1) % latestState.songs.length : 0;
    await resetSong(nextIndex);
  }
  async function resetSong(songIndex) {
    scoredRound = null;
    promptUnlockedRound = null;
    listeningRound = null;
    stopIntroAudio();
    renderState(await postState({ action: "reset", songIndex }));
  }

  initializeStableView();

  qrToggleButton.addEventListener("click", toggleQrPopover);
  listeningPlayButton.addEventListener("click", () => {
    if (!state?.currentSong || audioPlayInProgress) return;
    playIntroAudio(state.currentSong);
  });
  // resetGameButton.addEventListener("click", restartGame);
  revealButton.addEventListener("click", revealAnswer);
  // prevButton.addEventListener("click", () => {
  //   const songCount = state?.songs?.length || 0;
  //   const previousIndex = songCount ? (state.songIndex - 1 + songCount) % songCount : 0;
  //   resetSong(previousIndex);
  // });
  nextButton.addEventListener("click", goToNextSong);

  refresh();
  pollTimer = window.setInterval(refresh, 2500);

  return () => {
    window.clearInterval(pollTimer);
    stopIntroAudio();
    qrToggleButton.removeEventListener("click", toggleQrPopover);
    // resetGameButton.removeEventListener("click", restartGame);
    revealButton.removeEventListener("click", revealAnswer);
    nextButton.removeEventListener("click", goToNextSong);
  };
}



