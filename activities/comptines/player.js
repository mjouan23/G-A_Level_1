const apiUrl = new URL("./api.php", window.location.href).href;
const teams = ["Ninou", "Loulou", "Davy", "Croquette", "Ta-ta", "A-ten !"];
const requestTimeout = 6000;

const teamSelect = document.querySelector("#teamSelect");
const songTitle = document.querySelector("#songTitle");
const songPrompt = document.querySelector("#songPrompt");
const answerForm = document.querySelector("#answerForm");
const submitButton = document.querySelector("#submitButton");
const phoneStatus = document.querySelector("#phoneStatus");

let currentRound = null;
let currentSongId = null;
let lastJoinedTeamIndex = null;

function savedTeamIndex() {
  return window.localStorage.getItem("comptinesTeamIndex") || "";
}

function selectedTeamIndex() {
  return teamSelect.value === "" ? null : Number(teamSelect.value);
}

function hasSelectedTeam() {
  return selectedTeamIndex() !== null;
}

function apiFormatError(text) {
  const sample = text.trim().slice(0, 160);

  if (sample.startsWith("<?php")) {
    return "API non JSON : api.php est servi comme un fichier texte. Ouvre la page via Laragon/PHP, pas via Live Server/port 5500.";
  }

  if (/^<!doctype|^<html/i.test(sample)) {
    return "API non JSON : l'URL API renvoie une page HTML. Vérifiez que l'adresse pointe bien vers Laragon et vers activities/comptines/api.php.";
  }

  return `API non JSON : ${sample || "réponse vide"}`;
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`API HTTP ${response.status}: ${text || "réponse vide"}`);
  }

  if (!text.trim()) {
    throw new Error("API vide: vérifiez que la page est ouverte via Laragon/PHP");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(apiFormatError(text));
  }
}

function renderTeams() {
  teamSelect.innerHTML = [
    `<option value="">Choix de l'équipe</option>`,
    ...teams.map((team, index) => `<option value="${index}">${team}</option>`)
  ].join("");
  teamSelect.value = "";
}

function renderInputs(song, submission) {
  const words = submission?.words || [];
  answerForm.innerHTML = song.words
    .map((_, index) => `
      <label class="word-field">
        <span>Mot ${index + 1}</span>
        <input type="text" value="${words[index] || ""}" autocomplete="off" inputmode="text" />
      </label>
    `)
    .join("");
}

function focusNextInput(currentInput) {
  const inputs = [...answerForm.querySelectorAll("input")];
  const index = inputs.indexOf(currentInput);
  const nextInput = inputs[index + 1];

  if (nextInput) {
    nextInput.focus();
    nextInput.select();
  }
}

function handleAnswerInput(event) {
  const input = event.target.closest("input");
  if (!input || !input.value.includes(" ")) return;

  input.value = input.value.replace(/\s+/g, "");
  focusNextInput(input);
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
      throw new Error("API indisponible : vérifiez Laragon/PHP.");
    }
    throw new Error(`API indisponible : vérifiez que Laragon est lancé et que la page est ouverte via Laragon/PHP. URL appelée : ${url}`);
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

async function joinCurrentTeam() {
  const teamIndex = selectedTeamIndex();
  if (teamIndex === null) {
    return fetchState();
  }

  lastJoinedTeamIndex = teamIndex;
  return postState({ action: "join", teamIndex });
}

function renderNoTeamSelected(state) {
  songTitle.textContent = "Connexion au jeu";
  songPrompt.textContent = `En attente des équipes : ${state.participantCount || 0}/${state.teamCount || teams.length}`;
  answerForm.innerHTML = "";
  submitButton.disabled = true;
  phoneStatus.textContent = "Choisissez votre équipe pour rejoindre le jeu.";
}

function renderTeamSelectedNotJoined(state) {
  songTitle.textContent = "Connexion au jeu";
  songPrompt.textContent = `En attente des équipes : ${state.participantCount || 0}/${state.teamCount || teams.length}`;
  answerForm.innerHTML = "";
  submitButton.disabled = false;
  phoneStatus.textContent = "Cliquez sur Valider pour connectér votre équipe.";
}

function renderWaiting(state) {
  songTitle.textContent = "Connexion au jeu";
  songPrompt.textContent = `En attente des équipes : ${state.participantCount || 0}/${state.teamCount || teams.length}`;
  answerForm.innerHTML = "";
  submitButton.disabled = true;
  phoneStatus.textContent = "Vous etes connecté. Le jeu commence quand les 6 équipes sont prêtes.";
}

function renderIntroListening(state) {
  songTitle.textContent = "Écoute de la comptine";
  songPrompt.textContent = "La phrase à compléter apparaîtra après la musique.";
  answerForm.innerHTML = "";
  submitButton.disabled = true;
  phoneStatus.textContent = "Écoutez la comptine sur la télévision.";
}

function renderState(state) {
  const teamIndex = selectedTeamIndex();

  if (teamIndex === null) {
    renderNoTeamSelected(state);
    return;
  }

  if (lastJoinedTeamIndex !== teamIndex) {
    renderTeamSelectedNotJoined(state);
    return;
  }

  if (!state.ready) {
    renderWaiting(state);
    return;
  }

  if (!state.introDone) {
    renderIntroListening(state);
    return;
  }

  const song = state.currentSong;
  const submission = state.submissions?.[String(teamIndex)];
  const roundChanged = currentRound !== state.round || currentSongId !== song.id;

  submitButton.disabled = false;
  songTitle.textContent = song.title;
  songPrompt.textContent = song.prompt;

  if (roundChanged) {
    currentRound = state.round;
    currentSongId = song.id;
    renderInputs(song, submission);
    phoneStatus.textContent = state.revealed ? "Réponse affichée sur la télé." : "Complétez les mots manquants.";
    return;
  }

  if (state.revealed) {
    phoneStatus.textContent = "Réponse affichée sur la télé.";
  }
}

async function refresh() {
  try {
    renderState(await fetchState());
  } catch (error) {
    phoneStatus.textContent = error.message || "Connexion en attente...";
  }
}

async function submitAnswer() {
  const teamIndex = selectedTeamIndex();
  if (teamIndex === null) {
    phoneStatus.textContent = "Choisissez votre équipe avant de valider.";
    return;
  }

  submitButton.disabled = true;

  if (lastJoinedTeamIndex !== teamIndex) {
    phoneStatus.textContent = "Connexion de votre équipe...";
    try {
      renderState(await joinCurrentTeam());
    } catch (error) {
      phoneStatus.textContent = error.message || "Connexion impossible.";
      submitButton.disabled = false;
    }
    return;
  }

  const inputs = [...answerForm.querySelectorAll("input")];
  const words = inputs.map((input) => input.value);

  phoneStatus.textContent = "Envoi...";

  try {
    await postState({
      action: "submit",
      teamIndex,
      words
    });
    phoneStatus.textContent = "Réponse envoyée.";
  } catch (error) {
    phoneStatus.textContent = error.message || "Envoi impossible.";
  } finally {
    submitButton.disabled = !hasSelectedTeam();
  }
}

renderTeams();
teamSelect.addEventListener("change", () => {
  if (teamSelect.value === "") {
    window.localStorage.removeItem("comptinesTeamIndex");
  } else {
    window.localStorage.setItem("comptinesTeamIndex", teamSelect.value);
  }
  currentRound = null;
  lastJoinedTeamIndex = null;
  phoneStatus.textContent = teamSelect.value === "" ? "Choisissez votre équipe pour rejoindre le jeu." : "Cliquez sur Valider pour connectér votre équipe.";
  refresh();
});
answerForm.addEventListener("input", handleAnswerInput);
submitButton.addEventListener("click", submitAnswer);
refresh();
window.setInterval(refresh, 2500);
