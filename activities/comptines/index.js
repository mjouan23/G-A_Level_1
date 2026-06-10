export const activity = {
  id: "comptines",
  number: "Activite 06",
  icon: "LA",
  title: "N'oubliez pas les comptines !",
  description: "Les paroles s'arretent en plein milieu. Les equipes doivent retrouver la suite exacte pour marquer des points.",
  hint: "Prochain module : affichage des paroles, bouton de revelation et attribution des points."
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
