import { activity as justeGaActivity, render as renderJusteGa } from "./activities/juste-ga/index.js";
import { activity as chaussettesActivity, render as renderChaussettes } from "./activities/chaussettes/index.js";
import { activity as baballesActivity, render as renderBaballes } from "./activities/baballes/index.js";
import { activity as memoryActivity, render as renderMemory } from "./activities/memory/index.js";
import { activity as dessinActivity, render as renderDessin } from "./activities/dessin/index.js";
import { activity as comptinesActivity, render as renderComptines } from "./activities/comptines/index.js";

const activityModules = {
  [justeGaActivity.id]: { activity: justeGaActivity, render: renderJusteGa },
  [chaussettesActivity.id]: { activity: chaussettesActivity, render: renderChaussettes },
  [baballesActivity.id]: { activity: baballesActivity, render: renderBaballes },
  [memoryActivity.id]: { activity: memoryActivity, render: renderMemory },
  [dessinActivity.id]: { activity: dessinActivity, render: renderDessin },
  [comptinesActivity.id]: { activity: comptinesActivity, render: renderComptines }
};

const homeScreen = document.querySelector("#homeScreen");
const moduleScreen = document.querySelector("#moduleScreen");
const backButton = document.querySelector("#backButton");
const cards = [...document.querySelectorAll(".activity-card")];
const teamCards = [...document.querySelectorAll(".team-card")];

const moduleNumber = document.querySelector("#moduleNumber");
const moduleTitle = document.querySelector("#moduleTitle");
const moduleDescription = document.querySelector("#moduleDescription");
const activityModuleMount = document.querySelector("#activityModuleMount");

let activeModuleCleanup = null;
let activeTeamIndex = 0;

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);
window.addEventListener("load", () => {
  document.activeElement?.blur();
  window.setTimeout(() => window.scrollTo(0, 0), 0);
});

function cleanupActiveModule() {
  if (typeof activeModuleCleanup === "function") {
    activeModuleCleanup();
  }

  activeModuleCleanup = null;
  activityModuleMount.innerHTML = "";
  moduleScreen.classList.remove("sock-mode");
  moduleScreen.classList.remove("memory-mode");
  moduleScreen.classList.remove("drawing-mode");
  setActiveTeam(null);
}

function getTeamName(teamCard) {
  return teamCard.querySelector(".team-name")?.textContent.trim() || "";
}

function getTeamColor(teamCard) {
  return window.getComputedStyle(teamCard).getPropertyValue("--team-color").trim();
}

function setActiveTeam(index) {
  activeTeamIndex = Number.isInteger(index) ? index : activeTeamIndex;
  teamCards.forEach((teamCard, teamIndex) => {
    teamCard.classList.toggle("is-current-turn", teamIndex === index);
  });
}

function adjustTeamScore(index, delta) {
  const teamCard = teamCards[index];
  const points = teamCard?.querySelector(".team-points");
  if (!points) return;

  const currentScore = Number(points.textContent);
  points.textContent = String(Math.max(0, currentScore + delta));
}

function renderActivityModule(id) {
  const module = activityModules[id];
  if (!module) return;

  cleanupActiveModule();
  moduleScreen.classList.toggle("sock-mode", module.activity.layout === "sock-timer");
  moduleScreen.classList.toggle("memory-mode", module.activity.layout === "memory-fullscreen");
  moduleScreen.classList.toggle("drawing-mode", module.activity.layout === "drawing-fullscreen");
  activeModuleCleanup = module.render({
    activity: module.activity,
    container: activityModuleMount,
    teams: teamCards.map((teamCard, index) => ({
      index,
      name: getTeamName(teamCard),
      color: getTeamColor(teamCard)
    })),
    activeTeamIndex,
    setActiveTeam,
    incrementTeamScore: (index) => adjustTeamScore(index, 1)
  });
}

function openActivity(id) {
  const module = activityModules[id];
  if (!module) return;

  const { activity } = module;
  moduleNumber.textContent = activity.number;
  moduleTitle.textContent = activity.title;
  moduleDescription.textContent = activity.description;
  renderActivityModule(id);

  homeScreen.classList.add("hidden");
  moduleScreen.classList.remove("hidden");
  window.scrollTo(0, 0);
  backButton.focus({ preventScroll: true });
}

function showHome() {
  cleanupActiveModule();
  moduleScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
  window.scrollTo(0, 0);
  document.querySelector(".activity-card.active")?.focus({ preventScroll: true });
}

cards.forEach((card) => {
  card.addEventListener("click", () => openActivity(card.dataset.activity));
  card.addEventListener("focus", () => {
    cards.forEach((item) => item.classList.remove("active"));
    card.classList.add("active");
  });
});

teamCards.forEach((teamCard) => {
  teamCard.querySelectorAll(".team-score-button").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.scoreDelta);
      adjustTeamScore(teamCards.indexOf(teamCard), delta);
    });
  });
});

backButton.addEventListener("click", showHome);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !moduleScreen.classList.contains("hidden")) {
    showHome();
  }
});
