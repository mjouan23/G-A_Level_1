const DRAW_CHANNEL_NAME = "ga-dessin-live";

const canvas = document.querySelector("#drawCanvas");
const timeoutMessage = document.querySelector("#drawTimeout");
const context = canvas.getContext("2d");
const channel = new BroadcastChannel(DRAW_CHANNEL_NAME);

let drawing = false;
let lastPoint = null;
let locked = false;

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const snapshot = document.createElement("canvas");
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  snapshot.getContext("2d").drawImage(canvas, 0, 0);

  canvas.width = Math.max(1, Math.round(window.innerWidth * ratio));
  canvas.height = Math.max(1, Math.round(window.innerHeight * ratio));
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#1f2b46";
  context.lineWidth = Math.max(8, Math.min(window.innerWidth, window.innerHeight) * 0.012);

  if (snapshot.width && snapshot.height) {
    context.drawImage(snapshot, 0, 0, window.innerWidth, window.innerHeight);
  }
}

function getPoint(event) {
  return {
    x: event.clientX / window.innerWidth,
    y: event.clientY / window.innerHeight
  };
}

function pointToCanvas(point) {
  return {
    x: point.x * window.innerWidth,
    y: point.y * window.innerHeight
  };
}

function drawLine(point) {
  const nextPoint = pointToCanvas(point);

  if (!lastPoint) {
    lastPoint = nextPoint;
  }

  context.beginPath();
  context.moveTo(lastPoint.x, lastPoint.y);
  context.lineTo(nextPoint.x, nextPoint.y);
  context.stroke();
  lastPoint = nextPoint;
}

function clearCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  lastPoint = null;
}

function startDrawing(event) {
  if (locked) return;

  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  drawing = true;
  const point = getPoint(event);
  lastPoint = pointToCanvas(point);
  channel.postMessage({ type: "draw-start", point });
}

function moveDrawing(event) {
  if (!drawing || locked) return;

  event.preventDefault();
  const point = getPoint(event);
  drawLine(point);
  channel.postMessage({ type: "draw-move", point });
}

function stopDrawing(event) {
  if (!drawing) return;

  drawing = false;
  lastPoint = null;
  canvas.releasePointerCapture(event.pointerId);
  channel.postMessage({ type: "draw-end" });
}

channel.addEventListener("message", (event) => {
  if (event.data?.type === "draw-clear") {
    clearCanvas();
    return;
  }

  if (event.data?.type === "draw-lock") {
    locked = true;
    drawing = false;
    lastPoint = null;
    timeoutMessage.classList.remove("hidden");
    return;
  }

  if (event.data?.type === "draw-unlock") {
    locked = false;
    timeoutMessage.classList.add("hidden");
  }
});

window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", moveDrawing);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);

resizeCanvas();
channel.postMessage({ type: "draw-ready" });
