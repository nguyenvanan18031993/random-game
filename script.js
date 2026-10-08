(function () {
  "use strict";

  const TOTAL_GIFTS = 35;
  const STORAGE_KEY = "codex-team-gift-pinning-v1";

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
    { key: "speaker", name: "Speaker", type: "Grand gift", rarity: "grand", count: 5, icon: "speaker" },
    { key: "power-bank", name: "Pin dự phòng", type: "Special gift", rarity: "special", count: 1, icon: "battery" },
    { key: "can-holder", name: "Insulated can holder", type: "Small gift", rarity: "small", count: 5, image: "assets/can-holder.jpg" },
    { key: "clear-mug", name: "Clear mug", type: "Small gift", rarity: "small", count: 5, image: "assets/clear-mugs.jpg" },
    { key: "desk-cup", name: "Desk cup set", type: "Small gift", rarity: "small", count: 3, image: "assets/desk-cups.jpg" },
    { key: "travel-bottle", name: "Travel bottle", type: "Small gift", rarity: "small", count: 3, image: "assets/travel-bottles.jpg" },
    { key: "white-bottle", name: "Clear bottle", type: "Small gift", rarity: "small", count: 3, image: "assets/white-bottles.jpg" },
    { key: "laptop-sleeve", name: "Laptop sleeve", type: "Small gift", rarity: "small", count: 3, image: "assets/laptop-sleeves.jpg" },
    { key: "mixed-small", name: "Small gift surprise", type: "Small gift", rarity: "small", count: 5, imagePool: PHOTO_POOL },
    { key: "team-bonus", name: "Team bonus gift", type: "Small gift", rarity: "bonus", count: 2, icon: "bonus" }
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
    giftBoard: document.getElementById("giftBoard"),
    boardTitle: document.getElementById("boardTitle"),
    reelStrip: document.getElementById("reelStrip"),
    spinStatus: document.getElementById("spinStatus"),
    resultVisual: document.getElementById("resultVisual"),
    resultBadge: document.getElementById("resultBadge"),
    resultParticipant: document.getElementById("resultParticipant"),
    resultGift: document.getElementById("resultGift"),
    resultType: document.getElementById("resultType"),
    confettiLayer: document.getElementById("confettiLayer")
  };

  const confettiColors = ["#d5523a", "#087b83", "#d49a22", "#4f7c38", "#6d579b", "#191714"];
  let state = loadState();
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
      history: []
    };
  }

  function saveState() {
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
    elements.boardTitle.textContent = "Spinning the jackpot...";
    elements.spinStatus.textContent = "Reels are spinning";
    ensureAudio();
    playDrumroll();

    const selected = available[randomInt(available.length)];
    let delay = 22;
    const steps = Math.max(22, Math.min(46, available.length * 3 + 16));

    for (let step = 0; step < steps; step += 1) {
      const gift = step === steps - 1 ? selected : available[randomInt(available.length)];
      highlightedGiftId = gift.id;
      renderReel(gift, available, step);
      renderBoard();
      playTick(step, steps);
      await wait(delay);
      delay += step > steps * 0.72 ? 13 : step > steps * 0.48 ? 6 : 2;
    }

    elements.spinStatus.textContent = "Locked in";
    await wait(360);
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
    renderIdleReel();
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
    elements.boardTitle.textContent = remaining ? "Choose the next lucky gift" : "All gifts have been pinned";
    if (!spinning) {
      renderIdleReel();
      elements.spinStatus.textContent = remaining ? `${remaining} chances left` : "Prize board complete";
    }

    renderBoard();
    renderHistory();
  }

  function renderIdleReel() {
    const remaining = state.deck.filter((gift) => !gift.revealed).length;
    elements.reelStrip.innerHTML = [
      "Ready",
      remaining ? `${remaining} Left` : "Done",
      "Lucky"
    ].map((label) => `<span class="reel-symbol">${escapeHtml(label)}</span>`).join("");
  }

  function renderReel(activeGift, available, step) {
    const before = available[randomInt(available.length)] || activeGift;
    const after = available[randomInt(available.length)] || activeGift;
    const label = activeGift.rarity === "grand" ? "Speaker" : activeGift.rarity === "special" ? "Power" : "Gift";
    const symbols = [
      `${before.slot}`,
      step % 3 === 0 ? label : `${activeGift.slot}`,
      `${after.slot}`
    ];

    elements.reelStrip.innerHTML = symbols.map((symbol, index) => `
      <span class="reel-symbol ${index === 1 ? "active-symbol" : ""}">${escapeHtml(symbol)}</span>
    `).join("");
  }

  function countRemaining(rarity) {
    return state.deck.filter((gift) => gift.rarity === rarity && !gift.revealed).length;
  }

  function renderBoard() {
    elements.giftBoard.innerHTML = state.deck.map(renderGiftCard).join("");
  }

  function renderGiftCard(gift) {
    const classes = [
      "gift-card",
      gift.rarity,
      gift.revealed ? "revealed" : "",
      gift.id === highlightedGiftId ? "is-hot" : ""
    ].filter(Boolean).join(" ");

    if (!gift.revealed) {
      return `
        <article class="${classes}" aria-label="Unrevealed gift slot ${gift.slot}">
          <div class="card-cover">
            <span class="pin-mark" aria-hidden="true"></span>
            <span class="slot-number">${gift.slot}</span>
            <span class="cover-label">Gift Pin</span>
          </div>
        </article>
      `;
    }

    return `
      <article class="${classes}" aria-label="${escapeHtml(gift.name)} won by ${escapeHtml(gift.winner)}">
        <div class="card-face">
          ${renderGiftVisual(gift)}
          <div>
            <div class="gift-name">${escapeHtml(gift.name)}</div>
            <div class="winner-name">${escapeHtml(gift.winner)}</div>
          </div>
        </div>
      </article>
    `;
  }

  function renderGiftVisual(gift) {
    if (gift.image) {
      return `<img class="card-image" src="${escapeAttribute(gift.image)}" alt="${escapeAttribute(gift.name)}">`;
    }

    const iconClass = gift.icon === "battery" ? "battery-icon" : gift.icon === "bonus" ? "bonus-icon" : "speaker-icon";
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
