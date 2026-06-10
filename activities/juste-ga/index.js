export const activity = {
  id: "juste-ga",
  number: "Activite 01",
  icon: "?",
  title: "Le Juste G&A",
  description: "Les participants estiment au plus pres des informations sur d'Axel et Gabriel.",
  hint: "Prochain module : questions, saisie des estimations et revelation de la bonne reponse."
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
