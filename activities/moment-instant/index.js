export const activity = {
  id: "moment-instant",
  number: "Activité 01",
  icon: "INST",
  title: "Moment Instant'",
  description: "Chaque équipe devra prendre une photo instantanée avec Axel ainsi qu'une photo avec Gabriel, puis voter depuis son téléphone pour ses 2 photos préférées. Une équipe ne peut pas voter pour ses propres photos.",
  points: "2 pts / vote",
};

const pointsPerVote = 2;
const apiUrl = "http://192.168.1.37/G&A_Level_1/activities/moment-instant/api.php";
const playerUrl = "http://192.168.1.37/G&A_Level_1/activities/moment-instant/player.html";
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encodeURIComponent(playerUrl)}`;
const requestTimeout = 10000;
const appliedVotesStorageKey = "momentInstantAppliedVotes";

const photoOwners = [
  { teamIndex: 0, teamName: "Ninou", photos: [1, 2] },
  { teamIndex: 1, teamName: "Loulou", photos: [3, 4] },
  { teamIndex: 2, teamName: "Davy", photos: [5, 6] },
  { teamIndex: 3, teamName: "Croquette", photos: [7, 8] },
  { teamIndex: 4, teamName: "Ta-ta", photos: [9, 10] },
  { teamIndex: 5, teamName: "A-ten !", photos: [11, 12] }
];

function ownerForPhoto(photoNumber) {
  return photoOwners.find((owner) => owner.photos.includes(Number(photoNumber)));
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
      throw new Error("API indisponible: Laragon/PHP ne répond pas");
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

function readAppliedVotes(round) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(appliedVotesStorageKey) || "{}");
    if (stored.round !== round || !stored.votesByTeam) {
      return { round, votesByTeam: {} };
    }
    return stored;
  } catch {
    return { round, votesByTeam: {} };
  }
}

function saveAppliedVotes(appliedVotes) {
  window.localStorage.setItem(appliedVotesStorageKey, JSON.stringify(appliedVotes));
}

function contributionForPhotos(photos = []) {
  return photos.reduce((counts, photoNumber) => {
    const owner = ownerForPhoto(photoNumber);
    if (!owner) return counts;
    const key = String(owner.teamIndex);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function applyContributionDelta(previous = {}, next = {}, adjustTeamScore) {
  const teamIndexes = new Set([...Object.keys(previous), ...Object.keys(next)]);
  teamIndexes.forEach((teamIndex) => {
    const deltaVotes = (next[teamIndex] || 0) - (previous[teamIndex] || 0);
    if (deltaVotes !== 0) {
      adjustTeamScore(Number(teamIndex), deltaVotes * pointsPerVote);
    }
  });
}

export function render({ container, teams = [], adjustTeamScore = () => {} }) {
  let pollTimer = null;
  let consecutiveApiErrors = 0;

  container.innerHTML = `
    <section class="moment-instant-module" aria-label="Vote Moment Instant">
      <button class="rejoin-qr-button" type="button" data-rejoin-qr-toggle aria-expanded="false">QR</button>
      <div class="rejoin-qr-popover" data-rejoin-qr-popover hidden>
        <strong>Rejoindre</strong>
        <img src="${qrCodeUrl}" alt="QR code pour revenir au vote Moment Instant" />
        <span>${playerUrl}</span>
      </div>
      <div class="moment-visual-panel">
        <img src="activities/moment-instant/images/photo_instant.png" alt="Moment Instant" class="activity-image moment-instant-image">
        <div class="moment-photo-map" aria-label="Numéros des photos par équipe">
          ${photoOwners.map((owner) => `
            <span class="moment-photo-owner" style="--team-color: ${teams[owner.teamIndex]?.color || "var(--blue)"}">
              ${owner.teamName} : ${owner.photos.join(" & ")}
            </span>
          `).join("")}
        </div>
      </div>

      <div class="moment-connectéd-panel" data-waiting>
        <div class="moment-connectéd-copy">
          <div class="comptines-kicker">Connexion des équipes</div>
          <h3>Scannez le QR code</h3>
          <p>Chaque équipe choisit son nom sur son téléphone. Le vote s'ouvre automatiquement quand les 6 équipes sont connectées.</p>
          <div class="comptines-phone-url">${playerUrl}</div>
          <strong class="comptines-connectéd-count" data-connectéd-count>0/6 connectées</strong>
        </div>
        <div class="comptines-qr-card">
          <img src="${qrCodeUrl}" alt="QR code pour voter au Moment Instant" />
        </div>
        <div class="comptines-connectéd-teams" data-connectéd-teams></div>
      </div>

      <div class="moment-vote-panel" data-vote-panel hidden>
        <div class="moment-vote-header">
          <strong>Votes reçus</strong>
          <span>2 votes par équipe</span>
        </div>
        <div class="moment-team-votes" data-team-votes></div>
        <div class="moment-photo-results" data-photo-results></div>
      </div>
    </section>
  `;

  const qrToggleButton = container.querySelector("[data-rejoin-qr-toggle]");
  const qrPopover = container.querySelector("[data-rejoin-qr-popover]");
  const waitingPanel = container.querySelector("[data-waiting]");
  const votePanel = container.querySelector("[data-vote-panel]");
  const connectédCount = container.querySelector("[data-connectéd-count]");
  const connectédTeams = container.querySelector("[data-connectéd-teams]");
  const teamVotes = container.querySelector("[data-team-votes]");
  const photoResults = container.querySelector("[data-photo-results]");

  function toggleQrPopover() {
    const hidden = !qrPopover.hidden;
    qrPopover.hidden = hidden;
    qrToggleButton.setAttribute("aria-expanded", String(!hidden));
  }

  function renderWaiting(state) {
    const participants = state?.participants || {};
    const participantCount = state?.participantCount || 0;
    const teamCount = state?.teamCount || teams.length;

    connectédCount.textContent = `${participantCount}/${teamCount} connectées`;
    connectédTeams.innerHTML = teams
      .map((team) => {
        const connectéd = Boolean(participants[String(team.index)]);
        return `
          <span class="comptines-connectéd-team ${connectéd ? "is-connectéd" : ""}" style="--team-color: ${team.color}">
            ${team.name}
          </span>
        `;
      })
      .join("");
  }

  function renderVotes(state) {
    const votes = state?.votes || {};
    teamVotes.innerHTML = teams.map((team) => {
      const selectedPhotos = votes[String(team.index)]?.photos || [];
      return `
        <article class="moment-vote-card" style="--team-color: ${team.color};">
          <span class="moment-vote-name">${team.name}</span>
          <strong class="moment-vote-count">${selectedPhotos.length ? selectedPhotos.map((photo) => `#${photo}`).join(" + ") : "En attente"}</strong>
        </article>
      `;
    }).join("");

    const photoScores = state?.tally?.photos || {};
    photoResults.innerHTML = Array.from({ length: 12 }, (_, index) => index + 1).map((photoNumber) => {
      const owner = ownerForPhoto(photoNumber);
      const ownerTeam = teams[owner?.teamIndex || 0];
      return `
        <article class="moment-photo-result" style="--team-color: ${ownerTeam?.color || "var(--blue)"};">
          <span>Photo ${photoNumber}</span>
          <strong>${photoScores[String(photoNumber)] || 0}</strong>
        </article>
      `;
    }).join("");
  }

  function applyVoteScores(state) {
    if (!state?.ready || !state.votes) return;

    const appliedVotes = readAppliedVotes(state.round);
    Object.entries(state.votes).forEach(([voterTeamIndex, vote]) => {
      const photos = Array.isArray(vote?.photos) ? vote.photos : [];
      const signature = photos.join("|");
      const previousVote = appliedVotes.votesByTeam[voterTeamIndex];
      if (previousVote?.signature === signature) return;

      const nextContribution = contributionForPhotos(photos);
      applyContributionDelta(previousVote?.contribution || {}, nextContribution, adjustTeamScore);
      appliedVotes.votesByTeam[voterTeamIndex] = {
        signature,
        contribution: nextContribution
      };
    });
    saveAppliedVotes(appliedVotes);
  }

  function renderState(state) {
    const isReady = Boolean(state.ready);
    waitingPanel.hidden = isReady;
    votePanel.hidden = !isReady;

    if (!isReady) {
      renderWaiting(state);
      return;
    }

    renderVotes(state);
    applyVoteScores(state);
  }

  async function refresh() {
    try {
      const state = await fetchState();
      consecutiveApiErrors = 0;
      renderState(state);
    } catch (error) {
      consecutiveApiErrors += 1;
      if (consecutiveApiErrors >= 3) {
        votePanel.hidden = false;
        votePanel.innerHTML = `<p class="comptines-error">${error.message || "API indisponible. Verifie que la page passe par Laragon/PHP."}</p>`;
      }
    }
  }

  qrToggleButton.addEventListener("click", toggleQrPopover);

  refresh();
  pollTimer = window.setInterval(refresh, 2500);

  return () => {
    window.clearInterval(pollTimer);
    qrToggleButton.removeEventListener("click", toggleQrPopover);
  };
}

