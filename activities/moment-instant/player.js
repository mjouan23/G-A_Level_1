const apiUrl = "http://level1.meeplix.fr/activities/moment-instant/api.php";
const requestTimeout = 10000;
const teams = [
  { index: 0, name: "Ninou", photos: [1, 2] },
  { index: 1, name: "Loulou", photos: [3, 4] },
  { index: 2, name: "Davy", photos: [5, 6] },
  { index: 3, name: "Croquette", photos: [7, 8] },
  { index: 4, name: "Ta-ta", photos: [9, 10] },
  { index: 5, name: "A-ten !", photos: [11, 12] }
];

const teamSelect = document.querySelector("#teamSelect");
const joinPrompt = document.querySelector("#joinPrompt");
const voteTitle = document.querySelector("#voteTitle");
const voteHeading = document.querySelector("#voteHeading");
const votePrompt = document.querySelector("#votePrompt");
const voteForm = document.querySelector("#voteForm");
const submitButton = document.querySelector("#submitButton");
const phoneStatus = document.querySelector("#phoneStatus");

let lastJoinedTeamIndex = null;
let currentRound = null;
let selectedPhotoNumbers = [];

function selectedTeamIndex() {
  return teamSelect.value === "" ? null : Number(teamSelect.value);
}

function selectedTeam() {
  const teamIndex = selectedTeamIndex();
  return teams.find((team) => team.index === teamIndex) || null;
}

function hasSelectedTeam() {
  return selectedTeamIndex() !== null;
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
    throw new Error(`API non JSON: ${text.slice(0, 120)}`);
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
      throw new Error("API indisponible: vérifiez Laragon/PHP");
    }
    throw error;
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

function renderTeams() {
  teamSelect.innerHTML = [
    `<option value="">Choix de l'équipe</option>`,
    ...teams.map((team) => `<option value="${team.index}">${team.name}</option>`)
  ].join("");
  teamSelect.value = "";
}


function allowedPhotos(team) {
  if (!team) return [];
  return Array.from({ length: 12 }, (_, index) => index + 1)
    .filter((photoNumber) => !team.photos.includes(photoNumber));
}

function renderVoteButtons(state) {
  const team = selectedTeam();
  const submission = state.votes?.[String(team.index)];
  selectedPhotoNumbers = [...(submission?.photos || [])];

  voteForm.innerHTML = `
    <div class="photo-button-grid" aria-label="Choix des photos">
      ${allowedPhotos(team).map((photoNumber) => {
        const selected = selectedPhotoNumbers.includes(photoNumber);
        return `
          <button class="photo-vote-button ${selected ? "is-selected" : ""}" type="button" data-photo-number="${photoNumber}" aria-pressed="${selected}">
            <span>${photoNumber}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function updateVoteButtons() {
  voteForm.querySelectorAll("[data-photo-number]").forEach((button) => {
    const photoNumber = Number(button.dataset.photoNumber);
    const selected = selectedPhotoNumbers.includes(photoNumber);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  submitButton.textContent = "Voter !";

  submitButton.disabled = selectedPhotoNumbers.length !== 2;
  phoneStatus.textContent = selectedPhotoNumbers.length === 2
    ? "Vous pouvez valider votre vote."
    : `Sélectionnez ${2 - selectedPhotoNumbers.length} photo${selectedPhotoNumbers.length === 1 ? "" : "s"}.`;
}

function handlePhotoButtonClick(event) {
  const button = event.target.closest("[data-photo-number]");
  if (!button) return;

  const photoNumber = Number(button.dataset.photoNumber);
  if (selectedPhotoNumbers.includes(photoNumber)) {
    selectedPhotoNumbers = selectedPhotoNumbers.filter((selectedPhoto) => selectedPhoto !== photoNumber);
    updateVoteButtons();
    return;
  }

  if (selectedPhotoNumbers.length >= 2) {
    phoneStatus.textContent = "Vous avez déjà choisi 2 photos. Retirez-en une pour changer.";
    return;
  }

  selectedPhotoNumbers = [...selectedPhotoNumbers, photoNumber];
  updateVoteButtons();
}

async function joinCurrentTeam() {
  const teamIndex = selectedTeamIndex();
  if (teamIndex === null) {
    return fetchState();
  }

  lastJoinedTeamIndex = teamIndex;
  return postState({ action: "join", teamIndex });
}

function showScreen(screen) {
  document.body.classList.toggle("is-joining", screen === "join");
  document.body.classList.toggle("is-voting", screen === "vote");
}

function renderNoTeamSelected(state) {
  showScreen("join");
  joinPrompt.textContent = `En attente des équipes : ${state.participantCount || 0}/${state.teamCount || teams.length}`;
  voteForm.innerHTML = "";
  selectedPhotoNumbers = [];
  submitButton.textContent = "Rejoindre";
  submitButton.disabled = true;
  phoneStatus.textContent = "Choisissez votre équipe pour rejoindre le vote.";
}

function renderTeamSelectedNotJoined(state) {
  showScreen("join");
  joinPrompt.textContent = `En attente des équipes : ${state.participantCount || 0}/${state.teamCount || teams.length}`;
  voteForm.innerHTML = "";
  selectedPhotoNumbers = [];
  submitButton.textContent = "Rejoindre";
  submitButton.disabled = false;
  phoneStatus.textContent = "Cliquez sur Rejoindre pour connectér votre équipe.";
}

function renderWaiting(state) {
  showScreen("join");
  joinPrompt.textContent = `Connecté. En attente des équipes : ${state.participantCount || 0}/${state.teamCount || teams.length}`;
  voteForm.innerHTML = "";
  selectedPhotoNumbers = [];
  submitButton.textContent = "Rejoindre";
  submitButton.disabled = true;
  phoneStatus.textContent = "Le vote commence quand les 6 équipes sont prêtes.";
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

  const team = selectedTeam();
  const roundChanged = currentRound !== state.round;
  showScreen("vote");
  voteTitle.textContent = team.name;
  voteHeading.textContent = "Choisis 2 photos";
  votePrompt.textContent = `Tes photos (${team.photos.join(" et ")}) sont masquees.`;

  if (roundChanged || !voteForm.children.length) {
    currentRound = state.round;
    renderVoteButtons(state);
    updateVoteButtons();
    return;
  }

  const hasVote = Boolean(state.votes?.[String(teamIndex)]);
  if (hasVote && selectedPhotoNumbers.length === 2) {
    phoneStatus.textContent = "Vote enregistre. Vous pouvez le modifier.";
  }
}

async function refresh() {
  try {
    renderState(await fetchState());
  } catch (error) {
    phoneStatus.textContent = error.message || "Connexion en attente...";
  }
}

function selectedPhotos() {
  return [...selectedPhotoNumbers];
}

async function submitVote() {
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

  const photos = selectedPhotos();
  const uniquePhotos = [...new Set(photos)];
  if (uniquePhotos.length !== 2) {
    phoneStatus.textContent = "Choisissez 2 photos différentes.";
    submitButton.disabled = false;
    return;
  }

  phoneStatus.textContent = "Envoi...";

  try {
    renderState(await postState({ action: "submit", teamIndex, photos: uniquePhotos }));
    phoneStatus.textContent = "Vote enregistre.";
  } catch (error) {
    phoneStatus.textContent = error.message || "Envoi impossible.";
  } finally {
    submitButton.disabled = selectedPhotoNumbers.length !== 2;
  }
}

renderTeams();
teamSelect.addEventListener("change", () => {
  currentRound = null;
  lastJoinedTeamIndex = null;
  selectedPhotoNumbers = [];
  voteForm.innerHTML = "";
  phoneStatus.textContent = teamSelect.value === "" ? "Choisissez votre équipe pour rejoindre le vote." : "Cliquez sur Voter ! pour connectér votre équipe.";
  refresh();
});
voteForm.addEventListener("click", handlePhotoButtonClick);
submitButton.addEventListener("click", submitVote);
refresh();
window.setInterval(refresh, 2500);










