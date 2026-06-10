const SOCK_HUNT_DURATION_SECONDS = 2 * 60;
const SOCK_MUSIC_SRC = "activities/chaussettes/sons/The_Pink_Panther.mp3";
const SOCK_GONG_SRC = "activities/chaussettes/sons/gong.mp3";

export const activity = {
  id: "chaussettes",
  number: "Activite 02",
  icon: "SOX",
  title: "La chasse aux chaussettes",
  description: "Les equipes cherchent les chaussettes cachees puis reconstituent un maximum de paires avant les autres.",
  layout: "sock-timer"
};

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function render({ container }) {
  let remaining = SOCK_HUNT_DURATION_SECONDS;
  let interval = null;
  const huntMusic = new Audio(SOCK_MUSIC_SRC);
  const endGong = new Audio(SOCK_GONG_SRC);

  huntMusic.preload = "auto";
  endGong.preload = "auto";

  container.innerHTML = `
    <div class="sock-timer" id="sockTimerModule">
      <div class="sock-timer-label">Compte a rebours</div>
      <div class="sock-timer-display" id="sockTimerDisplay">${formatTime(remaining)}</div>
      <button class="sock-go-button" type="button" id="sockGoButton">Go !</button>
    </div>
  `;

  const display = container.querySelector("#sockTimerDisplay");
  const goButton = container.querySelector("#sockGoButton");

  function stopTimer() {
    window.clearInterval(interval);
    interval = null;
  }

  function stopAudio(audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  function playAudio(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Browsers may block playback if the user has not interacted enough.
    });
  }

  function startTimer() {
    stopTimer();
    stopAudio(endGong);
    remaining = SOCK_HUNT_DURATION_SECONDS;
    display.textContent = formatTime(remaining);
    goButton.textContent = "C'est parti !";
    goButton.disabled = true;
    playAudio(huntMusic);

    interval = window.setInterval(() => {
      remaining -= 1;
      display.textContent = formatTime(Math.max(remaining, 0));

      if (remaining <= 0) {
        stopTimer();
        stopAudio(huntMusic);
        playAudio(endGong);
        goButton.textContent = "Termine !";
      }
    }, 1000);
  }

  goButton.addEventListener("click", startTimer);

  return () => {
    stopTimer();
    stopAudio(huntMusic);
    stopAudio(endGong);
    goButton.removeEventListener("click", startTimer);
  };
}
