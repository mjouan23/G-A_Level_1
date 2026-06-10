export const activity = {
  id: "baballes",
  number: "Activite 03",
  icon: "BAL",
  title: "Panier de baballes",
  description: "Chaque joueur tente de marquer un maximum de paniers avec des petites balles dans un temps limite.",
  hint: "Prochain module : minuteur grand format, score par equipe et manches successives."
};

export function render({ activity, container }) {
  container.innerHTML = `
    <div class="module-placeholder">
      <span>${activity.icon}</span>
      <strong>Module a venir</strong>
      <p>${activity.hint}</p>
    </div>
  `;
}
