(function () {
  "use strict";

  const TOTAL_GIFTS = 33;
  const SEGMENT_DEGREES = 360 / TOTAL_GIFTS;
  const WHEEL_SPIN_MS = 4600;
  const STORAGE_KEY = "codex-team-gift-roulette-v6";

  const PHOTO_POOL = [
    "assets/can-holder.jpg",
    "assets/can-holder-detail.jpg",
    "assets/clear-mugs.jpg",
    "assets/clear-mug-detail.jpg",
    "assets/desk-cups.jpg",
    "assets/travel-bottles.jpg",
    "assets/white-bottles.jpg",
    "assets/laptop-sleeves.jpg"
  ];

  const GIFT_TEMPLATES = [
    { key: "speaker", name: "Speaker", type: "Grand gift", rarity: "grand", count: 5, image: "assets/speaker.jpg" },
    { key: "power-bank", name: "Pin dự phòng", type: "Special gift", rarity: "special", count: 1, icon: "battery" },
    { key: "can-holder", name: "Insulated can holder", type: "Small gift", rarity: "small", count: 5, image: "assets/can-holder.jpg" },
    { key: "clear-mug", name: "Clear mug", type: "Small gift", rarity: "small", count: 5, image: "assets/clear-mugs.jpg" },
    { key: "desk-cup", name: "Desk cup set", type: "Small gift", rarity: "small", count: 3, image: "assets/desk-cups.jpg" },
    { key: "travel-bottle", name: "Travel bottle", type: "Small gift", rarity: "small", count: 3, image: "assets/travel-bottles.jpg" },
    { key: "white-bottle", name: "Clear bottle", type: "Small gift", rarity: "small", count: 3, image: "assets/white-bottles.jpg" },
    { key: "laptop-sleeve", name: "Laptop sleeve", type: "Small gift", rarity: "small", count: 3, image: "assets/laptop-sleeves.jpg" },
    { key: "mixed-small", name: "Small gift surprise", type: "Small gift", rarity: "small", count: 5, imagePool: PHOTO_POOL }
  ];

  const elements = {
    startDialog: document.getElementById("startDialog"),
    resultDialog: document.getElementById("resultDialog"),
    startBtn: document.getElementById("startBtn"),
    nextBtn: document.getElementById("nextBtn"),
    pinBtn: document.getElementById("pinBtn"),
    resetBtn: document.getElementById("resetBtn"),
    exportBtn: document.getElementById("exportBtn"),
    fullscreenBtn: document.getElementById("fullscreenBtn"),
    soundBtn: document.getElementById("soundBtn"),
    participantName: document.getElementById("participantName"),
    roundNumber: document.getElementById("roundNumber"),
    remainingCopy: document.getElementById("remainingCopy"),
    progressBar: document.getElementById("progressBar"),
    speakerCount: document.getElementById("speakerCount"),
    powerCount: document.getElementById("powerCount"),
    smallCount: document.getElementById("smallCount"),
    historyList: document.getElementById("historyList"),
    boardTitle: document.getElementById("boardTitle"),
    rouletteWheel: document.getElementById("rouletteWheel"),
    wheelCenter: document.getElementById("wheelCenter"),
    spinStatus: document.getElementById("spinStatus"),
    currentPrizeVisual: document.getElementById("currentPrizeVisual"),
    currentPrizeName: document.getElementById("currentPrizeName"),
    currentPrizeMeta: document.getElementById("currentPrizeMeta"),
    pocketStrip: document.getElementById("pocketStrip"),
    resultVisual: document.getElementById("resultVisual"),
    resultBadge: document.getElementById("resultBadge"),
    resultParticipant: document.getElementById("resultParticipant"),
    resultGift: document.getElementById("resultGift"),
    resultType: document.getElementById("resultType"),
    confettiLayer: document.getElementById("confettiLayer")
  };

  const confettiColors = ["#d5523a", "#087b83", "#d49a22", "#4f7c38", "#6d579b", "#191714"];
  let state = loadState();
  let wheelRotation = Number.isFinite(state.wheelRotation) ? state.wheelRotation : 0;
  let highlightedGiftId = "";
  let spinning = false;
  let audioContext = null;
  let soundOn = true;

  init();

  function init() {
    render();
    bindEvents();
    preloadImages();

    if (!state.started && typeof elements.startDialog.showModal === "function") {
      elements.startDialog.showModal();
    }
  }

  function bindEvents() {
    elements.startBtn.addEventListener("click", startGame);
    elements.pinBtn.addEventListener("click", pinGift);
    elements.nextBtn.addEventListener("click", closeResult);
    elements.resetBtn.addEventListener("click", resetGame);
    elements.exportBtn.addEventListener("click", exportCsv);
    elements.fullscreenBtn.addEventListener("click", toggleFullscreen);
    elements.soundBtn.addEventListener("click", toggleSound);

    elements.participantName.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        pinGift();
      }
    });
  }

  function startGame() {
    state.started = true;
    saveState();
    ensureAudio();
    playStartSound();
    elements.startDialog.close();
    elements.participantName.focus();
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (stored && Array.isArray(stored.deck) && stored.deck.length === TOTAL_GIFTS) {
        return stored;
      }
    } catch (error) {
      console.warn("Could not load saved game", error);
    }

    return {
      started: false,
      deck: buildDeck(),
      history: [],
      wheelRotation: 0
    };
  }

  function saveState() {
    state.wheelRotation = wheelRotation;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function buildDeck() {
    const deck = [];

    GIFT_TEMPLATES.forEach((template) => {
      for (let index = 1; index <= template.count; index += 1) {
        const image = template.image || pickFromPool(template.imagePool, index);
        deck.push({
          id: `${template.key}-${index}-${deck.length}`,
          slot: deck.length + 1,
          name: `${template.name} ${template.count > 1 ? index : ""}`.trim(),
          type: template.type,
          rarity: template.rarity,
          image,
          icon: template.icon || "",
          revealed: false,
          winner: "",
          revealedAt: ""
        });
      }
    });

    return shuffle(deck).map((gift, index) => ({
      ...gift,
      slot: index + 1
    }));
  }

  function pickFromPool(pool, index) {
    if (!pool || !pool.length) {
      return "";
    }

    return pool[(index - 1) % pool.length];
  }

  function shuffle(items) {
    const next = [...items];

    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      const value = next[index];
      next[index] = next[swapIndex];
      next[swapIndex] = value;
    }

    return next;
  }

  function randomInt(limit) {
    if (window.crypto && window.crypto.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % limit;
    }

    return Math.floor(Math.random() * limit);
  }

  async function pinGift() {
    if (spinning) {
      return;
    }

    const available = state.deck.filter((gift) => !gift.revealed);
    if (!available.length) {
      elements.boardTitle.textContent = "All gifts have been pinned";
      return;
    }

    spinning = true;
    document.body.classList.add("is-spinning");
    elements.pinBtn.disabled = true;
    elements.participantName.disabled = true;
    highlightedGiftId = "";
    elements.boardTitle.textContent = "Roulette wheel spinning...";
    elements.spinStatus.textContent = "Wheel is spinning";
    ensureAudio();
    playDrumroll();

    const selected = available[randomInt(available.length)];
    renderCurrentPrize(null, "Wheel spinning");
    spinWheelToGift(selected);
    scheduleSpinTicks(WHEEL_SPIN_MS);

    await wait(WHEEL_SPIN_MS + 180);
    highlightedGiftId = selected.id;
    renderRoulette();
    elements.spinStatus.textContent = "Wheel locked";
    await wait(420);
    revealGift(selected);
  }

  function revealGift(gift) {
    const participant = sanitizeParticipant(elements.participantName.value, state.history.length + 1);
    const revealedAt = new Date().toLocaleString();
    const target = state.deck.find((item) => item.id === gift.id);

    target.revealed = true;
    target.winner = participant;
    target.revealedAt = revealedAt;
    state.history.unshift({
      id: target.id,
      slot: target.slot,
      participant,
      gift: target.name,
      type: target.type,
      rarity: target.rarity,
      revealedAt
    });

    saveState();
    document.body.classList.remove("is-spinning");
    render();
    showResult(target, participant);
    launchConfetti();
    playRevealSound();
    speakBravo(participant, target.name);

    spinning = false;
    elements.pinBtn.disabled = false;
    elements.participantName.disabled = false;
  }

  function sanitizeParticipant(value, fallbackNumber) {
    const clean = value.trim().replace(/\s+/g, " ");
    return clean || `Person ${fallbackNumber}`;
  }

  function showResult(gift, participant) {
    elements.resultBadge.textContent = gift.rarity === "grand" ? "Mega Jackpot" : gift.rarity === "special" ? "Power Hit" : "Jackpot";
    elements.resultParticipant.textContent = participant;
    elements.resultGift.textContent = gift.name;
    elements.resultType.textContent = gift.type;
    elements.resultVisual.innerHTML = renderGiftVisual(gift);

    if (typeof elements.resultDialog.showModal === "function") {
      elements.resultDialog.showModal();
    }
  }

  function closeResult() {
    elements.resultDialog.close();
    highlightedGiftId = "";
    elements.participantName.value = "";
    elements.participantName.focus();
    render();
  }

  function resetGame() {
    const confirmed = window.confirm("Reset all pinned gifts and winners?");
    if (!confirmed) {
      return;
    }

    state = {
      started: true,
      deck: buildDeck(),
      history: []
    };
    highlightedGiftId = "";
    wheelRotation = 0;
    document.body.classList.remove("is-spinning");
    saveState();
    render();
    elements.participantName.focus();
  }

  function exportCsv() {
    const rows = [
      ["No", "Participant", "Gift", "Type", "Slot", "Pinned At"],
      ...state.history.slice().reverse().map((entry, index) => [
        index + 1,
        entry.participant,
        entry.gift,
        entry.type,
        entry.slot,
        entry.revealedAt
      ])
    ];

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = URL.createObjectURL(blob);
    link.download = `gift-winners-${datePart}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function csvCell(value) {
    return `"${String(value).replaceAll("\"", "\"\"")}"`;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      return;
    }

    document.exitFullscreen?.();
  }

  function toggleSound() {
    soundOn = !soundOn;
    elements.soundBtn.setAttribute("aria-pressed", String(soundOn));
    elements.soundBtn.textContent = soundOn ? "Sound On" : "Sound Off";

    if (soundOn) {
      ensureAudio();
      playStartSound();
    }
  }

  function render() {
    const claimed = state.deck.filter((gift) => gift.revealed);
    const remaining = TOTAL_GIFTS - claimed.length;
    const currentRound = Math.min(claimed.length + 1, TOTAL_GIFTS);
    const speakerRemaining = countRemaining("grand");
    const powerRemaining = countRemaining("special");
    const smallRemaining = remaining - speakerRemaining - powerRemaining;

    elements.roundNumber.textContent = String(currentRound);
    elements.remainingCopy.textContent = `${remaining} gift${remaining === 1 ? "" : "s"} remaining`;
    elements.progressBar.style.width = `${(claimed.length / TOTAL_GIFTS) * 100}%`;
    elements.speakerCount.textContent = String(speakerRemaining);
    elements.powerCount.textContent = String(powerRemaining);
    elements.smallCount.textContent = String(smallRemaining);
    elements.pinBtn.textContent = remaining ? "Spin Gift" : "Finished";
    elements.pinBtn.disabled = spinning || remaining === 0;
    elements.exportBtn.disabled = state.history.length === 0;
    elements.boardTitle.textContent = remaining ? "Spin the wheel for the next gift" : "All gifts have been pinned";
    if (!spinning) {
      const lastGift = getLastRevealedGift();
      elements.spinStatus.textContent = remaining ? `${remaining} roulette pockets left` : "Prize wheel complete";
      renderCurrentPrize(lastGift, lastGift ? "Last landed" : "Waiting for spin");
    }

    renderRoulette();
    renderPocketStrip();
    renderHistory();
  }

  function countRemaining(rarity) {
    return state.deck.filter((gift) => gift.rarity === rarity && !gift.revealed).length;
  }

  function renderRoulette() {
    elements.rouletteWheel.style.background = buildWheelGradient();
    elements.rouletteWheel.style.transform = `rotate(${wheelRotation}deg)`;
    elements.rouletteWheel.innerHTML = state.deck.map(renderRoulettePocket).join("");
    const remaining = state.deck.filter((gift) => !gift.revealed).length;
    elements.wheelCenter.innerHTML = `<span>${remaining}</span><small>${remaining === 1 ? "Pocket left" : "Pockets left"}</small>`;
  }

  function renderRoulettePocket(gift, index) {
    const angle = index * SEGMENT_DEGREES + SEGMENT_DEGREES / 2;
    const classes = [
      "roulette-pocket",
      gift.rarity,
      gift.revealed ? "revealed" : "",
      gift.id === highlightedGiftId ? "is-active" : ""
    ].filter(Boolean).join(" ");

    return `
      <span class="${classes}" style="transform: rotate(${angle}deg) translateY(calc(var(--wheel-size) * -0.41)) rotate(${-angle}deg);" aria-label="Pocket ${gift.slot}, ${escapeAttribute(gift.name)}">
        ${gift.slot}
      </span>
    `;
  }

  function buildWheelGradient() {
    const segments = state.deck.map((gift, index) => {
      const color = getSegmentColor(gift);
      const start = index * SEGMENT_DEGREES;
      const end = (index + 1) * SEGMENT_DEGREES - 0.18;
      return `${color} ${start}deg ${end}deg, rgba(255, 247, 223, 0.30) ${end}deg ${(index + 1) * SEGMENT_DEGREES}deg`;
    });

    return `conic-gradient(from 0deg, ${segments.join(", ")})`;
  }

  function getSegmentColor(gift) {
    if (gift.revealed) {
      return "rgba(255, 255, 255, 0.16)";
    }

    if (gift.rarity === "grand") {
      return "#a86c00";
    }

    if (gift.rarity === "special") {
      return "#087b83";
    }

    if (gift.rarity === "bonus") {
      return "#6d579b";
    }

    const oddSlot = gift.slot % 2 === 1;
    return oddSlot ? "#28301f" : "#8f1f34";
  }

  function renderPocketStrip() {
    elements.pocketStrip.innerHTML = state.deck.map((gift) => {
      const classes = [
        "pocket-chip",
        gift.rarity,
        gift.revealed ? "revealed" : "",
        gift.id === highlightedGiftId ? "is-active" : ""
      ].filter(Boolean).join(" ");

      return `<span class="${classes}" title="${escapeAttribute(gift.name)}">${gift.slot}</span>`;
    }).join("");
  }

  function renderCurrentPrize(gift, statusLabel) {
    if (!gift) {
      elements.currentPrizeVisual.innerHTML = "";
      elements.currentPrizeName.textContent = statusLabel || "Waiting for spin";
      elements.currentPrizeMeta.textContent = `${state.deck.filter((item) => !item.revealed).length} chances ready`;
      return;
    }

    elements.currentPrizeVisual.innerHTML = renderGiftVisual(gift);
    elements.currentPrizeName.textContent = gift.name;
    elements.currentPrizeMeta.textContent = `${statusLabel} · Pocket ${gift.slot}`;
  }

  function getLastRevealedGift() {
    const last = state.history[0];
    if (!last) {
      return null;
    }

    return state.deck.find((gift) => gift.id === last.id) || null;
  }

  function spinWheelToGift(gift) {
    const selectedIndex = state.deck.findIndex((item) => item.id === gift.id);
    const selectedCenter = selectedIndex * SEGMENT_DEGREES + SEGMENT_DEGREES / 2;
    const targetRotation = -selectedCenter;
    const delta = normalizeDegrees(targetRotation - normalizeDegrees(wheelRotation));
    wheelRotation += 360 * 7 + delta;
    elements.rouletteWheel.style.transition = `transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.08, 0.78, 0.04, 1)`;
    elements.rouletteWheel.style.transform = `rotate(${wheelRotation}deg)`;
  }

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function scheduleSpinTicks(duration) {
    const ticks = 34;
    for (let index = 0; index < ticks; index += 1) {
      const progress = index / ticks;
      const delay = Math.round(duration * Math.pow(progress, 1.68));
      window.setTimeout(() => playTick(index, ticks), delay);
    }
  }

  function renderGiftVisual(gift) {
    if (gift.image) {
      return `<img class="card-image" src="${escapeAttribute(gift.image)}" alt="${escapeAttribute(gift.name)}">`;
    }

    const iconMap = {
      battery: "battery-icon",
      bonus: "bonus-icon",
      speaker: "speaker-icon"
    };
    const iconClass = iconMap[gift.icon] || "speaker-icon";
    return `<div class="icon-tile" aria-hidden="true"><span class="${iconClass}"></span></div>`;
  }

  function renderHistory() {
    if (!state.history.length) {
      elements.historyList.innerHTML = "<li>No winners yet</li>";
      return;
    }

    elements.historyList.innerHTML = state.history.map((entry) => `
      <li>
        <strong>${escapeHtml(entry.participant)}</strong><br>
        ${escapeHtml(entry.gift)}
      </li>
    `).join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function preloadImages() {
    PHOTO_POOL.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }

  function ensureAudio() {
    if (!soundOn) {
      return null;
    }

    if (!audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      audioContext = Context ? new Context() : null;
    }

    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }

    return audioContext;
  }

  function playStartSound() {
    const context = ensureAudio();
    if (!context) {
      return;
    }

    playTone(330, 0.06, 0.03);
    window.setTimeout(() => playTone(440, 0.08, 0.04), 70);
    window.setTimeout(() => playTone(660, 0.1, 0.045), 150);
  }

  function playTick(step, totalSteps) {
    if (!soundOn) {
      return;
    }

    const nearEnd = step > totalSteps * 0.72;
    playTone(480 + step * 10, nearEnd ? 0.052 : 0.026, nearEnd ? 0.034 : 0.018);
    if (nearEnd && step % 3 === 0) {
      playTone(240, 0.05, 0.02);
    }
  }

  function playDrumroll() {
    if (!soundOn) {
      return;
    }

    for (let index = 0; index < 24; index += 1) {
      window.setTimeout(() => playNoise(0.034, 0.04), index * 58);
    }
  }

  function playRevealSound() {
    if (!soundOn) {
      return;
    }

    [392, 523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      window.setTimeout(() => playTone(frequency, 0.24, 0.09), index * 86);
    });

    for (let index = 0; index < 12; index += 1) {
      window.setTimeout(() => playNoise(0.05, 0.074), 410 + index * 72);
    }
  }

  function playTone(frequency, duration, gainValue) {
    const context = ensureAudio();
    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  function playNoise(duration, gainValue) {
    const context = ensureAudio();
    if (!context) {
      return;
    }

    const bufferSize = context.sampleRate * duration;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    gain.gain.value = gainValue;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
  }

  function speakBravo(participant, giftName) {
    if (!soundOn || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Bravo! Chúc mừng ${participant}. ${giftName}.`);
    utterance.lang = "vi-VN";
    utterance.rate = 0.98;
    utterance.pitch = 1.08;
    window.setTimeout(() => window.speechSynthesis.speak(utterance), 620);
  }

  function launchConfetti() {
    elements.confettiLayer.innerHTML = "";

    for (let index = 0; index < 150; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.background = confettiColors[index % confettiColors.length];
      piece.style.setProperty("--x", `${randomBetween(-48, 48)}vw`);
      piece.style.setProperty("--y", `${randomBetween(26, 58)}vh`);
      piece.style.setProperty("--r", `${randomBetween(-580, 580)}deg`);
      piece.style.animationDelay = `${randomBetween(0, 160)}ms`;
      elements.confettiLayer.appendChild(piece);
    }

    window.setTimeout(() => {
      elements.confettiLayer.innerHTML = "";
    }, 1900);
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
})();
