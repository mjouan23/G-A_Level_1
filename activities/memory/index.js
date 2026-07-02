export const activity = {
  id: "memory",
  number: "Activité 04",
  icon: "PIC",
  title: "Le Memory G&A",
  description: "Les équipes devront retrouver un maximum de paires de photos d'Axel et Gabriel affichées à l'écran ; chaque paire correctement identifiée rapportera des points à l'équipe.",
  points: "2 pts / paire",
  layout: "memory-fullscreen"
};

const POINTS_PER_PAIR = 2;
const MEMORY_MUSIC_URL = new URL("./sons/Kevin MacLeod Wallpaper.mp3", import.meta.url);

const photos = Array.from({ length: 15 }, (_, index) => ({
  id: `memory-${index + 1}`,
  src: `activities/memory/images/memory${index + 1}.png`,
  alt: `Photo memory ${index + 1}`
}));

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createDeck() {
  return shuffle(
    photos.flatMap((photo) => [
      { ...photo, cardId: `${photo.id}-a` },
      { ...photo, cardId: `${photo.id}-b` }
    ])
  );
}

export function render({
  container,
  teams = [],
  activeTeamIndex = 0,
  setActiveTeam = () => {},
  incrementTeamScore = () => {}
}) {
  let deck = createDeck();
  let currentTeamIndex = activeTeamIndex;
  let flippedCards = [];
  let foundPairs = 0;
  let locked = false;

  container.innerHTML = `
    <section class="memory-game" aria-label="Jeu de memory">
      <div class="memory-grid"></div>
    </section>
  `;

  const grid = container.querySelector(".memory-grid");

  function getCurrentTeam() {
    return teams[currentTeamIndex] || { index: currentTeamIndex, name: "Équipe" };
  }

  function updateTurnDisplay() {
    const team = getCurrentTeam();
    setActiveTeam(team.index);
  }

  function nextTeam() {
    currentTeamIndex = teams.length ? (currentTeamIndex + 1) % teams.length : 0;
    updateTurnDisplay();
  }

  function renderDeck() {
    grid.innerHTML = deck
      .map(
        (card) => `
          <button class="memory-card" type="button" data-card-id="${card.cardId}" data-photo-id="${card.id}" aria-label="Carte cachée">
            <span class="memory-card-inner">
              <span class="memory-card-face memory-card-back" aria-hidden="true">${activity.icon}</span>
              <span class="memory-card-face memory-card-front">
                <img src="${card.src}" alt="${card.alt}" loading="lazy" />
              </span>
            </span>
          </button>
        `
      )
      .join("");
  }

  function finishTurn() {
    flippedCards = [];
    nextTeam();
    locked = false;
  }

  function handleMatch(firstCard, secondCard) {
    const team = getCurrentTeam();

    firstCard.classList.add("is-found");
    secondCard.classList.add("is-found");
    firstCard.style.setProperty("--found-team-color", team.color);
    secondCard.style.setProperty("--found-team-color", team.color);
    firstCard.disabled = true;
    secondCard.disabled = true;
    foundPairs += 1;

    for (let point = 0; point < POINTS_PER_PAIR; point += 1) {
      incrementTeamScore(team.index);
    }

    if (foundPairs === photos.length) {
      locked = false;
      return;
    }
    window.setTimeout(finishTurn, 850);
  }

  function handleMiss(firstCard, secondCard) {
    const team = getCurrentTeam();

    window.setTimeout(() => {
      firstCard.classList.remove("is-flipped");
      secondCard.classList.remove("is-flipped");
      firstCard.setAttribute("aria-label", "Carte cachée");
      secondCard.setAttribute("aria-label", "Carte cachée");
      finishTurn();
    }, 1100);
  }

  function handleCardClick(card) {
    if (locked || card.classList.contains("is-flipped") || card.classList.contains("is-found")) {
      return;
    }

    card.classList.add("is-flipped");
    card.setAttribute("aria-label", "Carte dévoilée");
    flippedCards.push(card);

    if (flippedCards.length < 2) return;

    locked = true;
    const [firstCard, secondCard] = flippedCards;

    if (firstCard.dataset.photoId === secondCard.dataset.photoId) {
      handleMatch(firstCard, secondCard);
    } else {
      handleMiss(firstCard, secondCard);
    }
  }

  grid.addEventListener("click", (event) => {
    const card = event.target.closest(".memory-card");
    if (!card) return;
    handleCardClick(card);
  });

  const memoryMusic = new Audio(MEMORY_MUSIC_URL);
  memoryMusic.loop = true;
  memoryMusic.volume = 0.5;
  memoryMusic.play().catch(() => {});

  renderDeck();
  updateTurnDisplay();

  return () => {
    memoryMusic.pause();
    memoryMusic.currentTime = 0;
    setActiveTeam(null);
  };
}






