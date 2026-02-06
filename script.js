"use strict";

const STORAGE_KEY = "lucky_wheel_state_v1";

const DEFAULT_PRIZES = [
  { id: "tivi", label: "Tivi Sony 55 inch", total: 3, probability: 0 },
  { id: "iphone", label: "iPhone 17 Pro", total: 1, probability: 0 },
  { id: "vacuum", label: "Máy hút bụi", total: 3, probability: 3 },
  { id: "hopqua", label: "Hộp quà Tết Director", total: 1, probability: 1 },
  { id: "500k", label: "500k", total: 1, probability: 1 },
  { id: "200k", label: "200k", total: 2, probability: 2 },
  { id: "100k", label: "100k", total: 5, probability: 5 },
  { id: "50k", label: "50k", total: 10, probability: 10 },
  { id: "20k", label: "20k", total: 20, probability: 20 },
];

const COLORS = [
  "#fde047",
  "#93c5fd",
  "#fca5a5",
  "#86efac",
  "#c4b5fd",
  "#fdba74",
  "#67e8f9",
  "#f9a8d4",
];

const wheelCanvas = document.getElementById("wheel");
const wheelWrapper = document.querySelector(".wheel-wrapper");
const spinBtn = document.getElementById("spinBtn");
const resetBtn = document.getElementById("resetBtn");
const resultText = document.getElementById("resultText");
const prizeList = document.getElementById("prizeList");
const winModal = document.getElementById("winModal");
const modalDesc = document.getElementById("modalDesc");
const modalOk = document.getElementById("modalOk");
const modalClose = document.getElementById("modalClose");
const confettiLayer = document.getElementById("confettiLayer");

const ctx = wheelCanvas.getContext("2d");

let wheelSize = 0;
let isSpinning = false;
let currentRotation = 0;

let prizes = DEFAULT_PRIZES.map((p) => ({ ...p, remaining: p.total }));

let audioCtx = null;
let spinTickTimers = [];
let confettiClearTimer = null;
let lastFocusedEl = null;

const CONFETTI_COLORS = [
  "#a855f7",
  "#f472b6",
  "#60a5fa",
  "#22c55e",
  "#fde047",
  "#fb7185",
  "#67e8f9",
  "#fdba74",
];

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function ensureAudioContext() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playTick(volume = 0.06) {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(880, t);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.06);
}

function playWinJingle() {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const t0 = ctx.currentTime + 0.02;
  const notes = [
    { f: 523.25, t: 0.0, d: 0.14 }, // C5
    { f: 659.25, t: 0.14, d: 0.14 }, // E5
    { f: 783.99, t: 0.28, d: 0.16 }, // G5
    { f: 1046.5, t: 0.46, d: 0.24 }, // C6
  ];

  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(n.f, t0 + n.t);

    gain.gain.setValueAtTime(0.0001, t0 + n.t);
    gain.gain.linearRampToValueAtTime(0.09, t0 + n.t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.t + n.d);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0 + n.t);
    osc.stop(t0 + n.t + n.d + 0.02);
  }
}

function clearSpinTicks() {
  for (const id of spinTickTimers) window.clearTimeout(id);
  spinTickTimers = [];
}

function scheduleSpinTicks(segments, durationMs) {
  clearSpinTicks();
  if (segments <= 0 || durationMs <= 0) return;
  if (prefersReducedMotion()) return;

  ensureAudioContext();

  const exponent = 2.15; // tăng dần khoảng cách tick để tạo cảm giác chậm lại
  for (let i = 0; i < segments; i++) {
    const p = (i + 1) / segments;
    const when = Math.pow(p, exponent) * durationMs;
    const vol = 0.045 + (1 - p) * 0.03;
    spinTickTimers.push(window.setTimeout(() => playTick(vol), when));
  }
}

function clearConfetti() {
  if (!confettiLayer) return;
  if (confettiClearTimer) window.clearTimeout(confettiClearTimer);
  confettiClearTimer = null;
  confettiLayer.replaceChildren();
}

function spawnConfetti() {
  if (!confettiLayer) return;
  clearConfetti();
  if (prefersReducedMotion()) return;

  const count = 140;
  let maxMs = 0;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";

    const delay = Math.random() * 450;
    const duration = 2200 + Math.random() * 1600;
    maxMs = Math.max(maxMs, delay + duration);

    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];

    piece.style.setProperty("--x", `${Math.random() * 100}vw`);
    piece.style.setProperty("--w", `${6 + Math.random() * 7}px`);
    piece.style.setProperty("--h", `${10 + Math.random() * 14}px`);
    piece.style.setProperty("--c", color);
    piece.style.setProperty("--d", `${duration}ms`);
    piece.style.setProperty("--delay", `${delay}ms`);
    piece.style.setProperty("--r", `${Math.floor(Math.random() * 360)}deg`);

    confettiLayer.appendChild(piece);
  }

  confettiClearTimer = window.setTimeout(() => {
    confettiLayer.replaceChildren();
    confettiClearTimer = null;
  }, maxMs + 200);
}

function openWinModal(prizeLabel) {
  if (!winModal || !modalDesc) return;

  lastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalDesc.textContent = `Bạn trúng: ${prizeLabel}\n\nTivi và iPhone vẫn còn nhiều, hãy cố lên nào...`;

  winModal.hidden = false;
  document.body.classList.add("modal-open");
  spawnConfetti();
  playWinJingle();

  window.setTimeout(() => {
    if (modalOk) modalOk.focus();
    else if (modalClose) modalClose.focus();
  }, 0);
}

function closeWinModal() {
  if (!winModal) return;
  winModal.hidden = true;
  document.body.classList.remove("modal-open");
  clearConfetti();
  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
  lastFocusedEl = null;
}

function clampInt(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const remainingById = parsed?.remainingById ?? {};
    const savedRotation = parsed?.rotation;

    prizes = DEFAULT_PRIZES.map((p) => ({
      ...p,
      remaining: clampInt(remainingById[p.id] ?? p.total, 0, p.total),
    }));
    if (Number.isFinite(savedRotation)) currentRotation = savedRotation;
  } catch {
    // ignore corrupt storage
  }
}

function saveState() {
  const remainingById = Object.fromEntries(prizes.map((p) => [p.id, p.remaining]));
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ remainingById, rotation: currentRotation }),
  );
}

function formatPrizeMeta(prize) {
  const stock = `Còn ${prize.remaining}/${prize.total}`;
  if (prize.probability <= 0) return `${stock}`;
  if (prize.remaining <= 0) return `${stock} • Hết giải`;
  return `${stock}`;
}

function renderPrizeList() {
  prizeList.replaceChildren();
  prizes.forEach((prize) => {
    const li = document.createElement("li");
    li.className = "prize-item" + (prize.remaining <= 0 ? " out" : "");

    const left = document.createElement("div");
    left.className = "prize-name";
    left.textContent = prize.label;

    const right = document.createElement("div");
    right.className = "prize-meta";
    right.textContent = formatPrizeMeta(prize);

    li.append(left, right);
    prizeList.append(li);
  });
}

function splitLabel(label) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [label];
  if (words.length === 2) return words;
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function drawWheel() {
  if (!wheelSize) return;

  ctx.clearRect(0, 0, wheelSize, wheelSize);

  const cx = wheelSize / 2;
  const cy = wheelSize / 2;
  const radius = wheelSize / 2 - 10;
  const count = prizes.length;
  const slice = (Math.PI * 2) / count;

  let start = -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const prize = prizes[i];
    const end = start + slice;

    const baseColor = COLORS[i % COLORS.length];
    const isActive = prize.remaining > 0 && prize.probability > 0;
    const fill = isActive ? baseColor : "#cbd5e1";

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const mid = (start + end) / 2;
    const labelLines = splitLabel(prize.label);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);
    ctx.textBaseline = "middle";

    let textAlign = "right";
    let x = radius - 14;
    if (mid > Math.PI / 2 && mid < (3 * Math.PI) / 2) {
      ctx.rotate(Math.PI);
      textAlign = "left";
      x = -(radius - 14);
    }
    ctx.textAlign = textAlign;

    const labelFontSize = prize.label.length > 10 ? 14 : 16;
    ctx.font = `800 ${labelFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.fillStyle = isActive ? "rgba(15, 23, 42, 0.92)" : "rgba(30, 41, 59, 0.72)";

    const lineH = labelFontSize + 2;
    const y0 = -((labelLines.length - 1) * lineH) / 2;
    for (let l = 0; l < labelLines.length; l++) {
      ctx.fillText(labelLines[l], x, y0 + l * lineH);
    }
    ctx.restore();

    start = end;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function resizeWheel() {
  const rect = wheelWrapper.getBoundingClientRect();
  const size = Math.max(240, Math.floor(Math.min(rect.width, rect.height)));
  wheelSize = size;

  const dpr = window.devicePixelRatio || 1;
  wheelCanvas.width = Math.round(size * dpr);
  wheelCanvas.height = Math.round(size * dpr);
  wheelCanvas.style.width = `${size}px`;
  wheelCanvas.style.height = `${size}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawWheel();
  if (!isSpinning) wheelCanvas.style.transform = `rotate(${currentRotation}deg)`;
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.probability, 0);
  if (total <= 0) return null;

  let r = Math.random() * total;
  for (const item of items) {
    r -= item.probability;
    if (r < 0) return item;
  }
  return items[items.length - 1] ?? null;
}

function getSpinTargetRotation(prizeIndex) {
  const count = prizes.length;
  const sliceDeg = 360 / count;
  const segmentCenterDeg = prizeIndex * sliceDeg + sliceDeg / 2;
  const desiredDeg = (360 - segmentCenterDeg) % 360;

  const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
  const delta = (desiredDeg - normalizedCurrent + 360) % 360;

  const reducedMotion = prefersReducedMotion();
  const extraSpins = reducedMotion ? 0 : 6 + Math.floor(Math.random() * 3); // 6–8 vòng

  return currentRotation + extraSpins * 360 + delta;
}

function setResult(text, kind = "default") {
  resultText.textContent = text;
  if (kind === "success") resultText.style.color = "rgba(255,255,255,0.95)";
  else if (kind === "error") resultText.style.color = "#fecaca";
  else resultText.style.color = "rgba(255,255,255,0.92)";
}

function getAvailablePrizes() {
  return prizes.filter((p) => p.remaining > 0 && p.probability > 0);
}

function updateSpinAvailability() {
  const available = getAvailablePrizes();
  spinBtn.disabled = isSpinning || available.length === 0;
  if (!isSpinning && available.length === 0) {
    setResult("Đã hết giải có thể trúng. Vui lòng Reset để quay lại.", "error");
  }
}

function onSpin() {
  if (isSpinning) return;
  closeWinModal();
  const available = getAvailablePrizes();
  if (available.length === 0) {
    updateSpinAvailability();
    return;
  }

  ensureAudioContext();

  const chosen = weightedPick(available);
  if (!chosen) return;

  const chosenIndex = prizes.findIndex((p) => p.id === chosen.id);
  if (chosenIndex < 0) return;

  const startRotation = currentRotation;

  isSpinning = true;
  updateSpinAvailability();
  spinBtn.setAttribute("aria-label", "Đang quay…");
  spinBtn.classList.add("is-spinning");
  setResult("Đang quay…");

  const reducedMotion = prefersReducedMotion();
  const targetRotation = getSpinTargetRotation(chosenIndex);
  const durationMs = reducedMotion ? 0 : 5200;

  const sliceDeg = 360 / prizes.length;
  const segmentsToPass = Math.max(0, Math.round((targetRotation - startRotation) / sliceDeg));
  if (durationMs === 0) playTick(0.075);
  else scheduleSpinTicks(segmentsToPass, durationMs);

  const finalize = () => {
    clearSpinTicks();
    currentRotation = targetRotation;

    const updated = prizes.find((p) => p.id === chosen.id);
    if (updated) updated.remaining = Math.max(0, updated.remaining - 1);

    saveState();
    renderPrizeList();
    drawWheel();

    setResult(
      `Bạn trúng: ${chosen.label}\n\nTivi và iPhone vẫn còn nhiều, hãy cố lên nào...`,
      "success",
    );
    openWinModal(chosen.label);

    isSpinning = false;
    spinBtn.setAttribute("aria-label", "Quay");
    spinBtn.classList.remove("is-spinning");
    updateSpinAvailability();
  };

  if (durationMs === 0) {
    wheelCanvas.style.transition = "none";
    wheelCanvas.style.transform = `rotate(${targetRotation}deg)`;
    setTimeout(finalize, 0);
    return;
  }

  wheelCanvas.style.transition = `transform ${durationMs}ms cubic-bezier(0.18, 0.88, 0.22, 1)`;

  // Ensure the browser applies the transition cleanly.
  requestAnimationFrame(() => {
    wheelCanvas.style.transform = `rotate(${targetRotation}deg)`;
  });

  let finalized = false;
  const safeFinalize = () => {
    if (finalized) return;
    finalized = true;
    finalize();
  };

  const onEnd = (event) => {
    if (event.propertyName !== "transform") return;
    wheelCanvas.removeEventListener("transitionend", onEnd);
    safeFinalize();
  };

  wheelCanvas.addEventListener("transitionend", onEnd);
  window.setTimeout(() => {
    wheelCanvas.removeEventListener("transitionend", onEnd);
    safeFinalize();
  }, durationMs + 200);
}

function onReset() {
  if (isSpinning) return;
  clearSpinTicks();
  closeWinModal();
  prizes = DEFAULT_PRIZES.map((p) => ({ ...p, remaining: p.total }));
  currentRotation = 0;
  wheelCanvas.style.transition = "none";
  wheelCanvas.style.transform = "rotate(0deg)";
  saveState();
  renderPrizeList();
  drawWheel();
  setResult("Đã reset. Sẵn sàng quay.");
  updateSpinAvailability();
}

loadState();
renderPrizeList();
resizeWheel();
updateSpinAvailability();

spinBtn.addEventListener("click", onSpin);
resetBtn.addEventListener("click", onReset);
window.addEventListener("resize", resizeWheel, { passive: true });

if (modalOk) modalOk.addEventListener("click", closeWinModal);
if (modalClose) modalClose.addEventListener("click", closeWinModal);
if (winModal) {
  winModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.close === "true") closeWinModal();
  });
}
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!winModal || winModal.hidden) return;
  closeWinModal();
});
