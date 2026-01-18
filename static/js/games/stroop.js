(() => {
  const TRIALS = 12;
  const COLORS = [
    { name: "Red", hex: "#ef4444" },
    { name: "Blue", hex: "#3b82f6" },
    { name: "Green", hex: "#22c55e" },
    { name: "Yellow", hex: "#eab308" }
  ];

  const wordEl = document.getElementById("stroopWord");
  const progressEl = document.getElementById("stroopProgress");
  const metaEl = document.getElementById("stroopMeta");
  const statusEl = document.getElementById("stroopStatus");
  const startBtn = document.getElementById("stroopStart");
  const optionsWrap = document.getElementById("stroopOptions");
  const optionButtons = document.querySelectorAll(".stroop-option");

  if (!wordEl) return;

  let running = false;
  let trialIndex = 0;
  let errors = 0;
  let correctOnFirstTry = 0; // NEW: Track perfect hits
  let isFirstAttempt = true; // NEW: Track if current trial is on first attempt
  let times = [];
  let currentInk = null;
  let currentWord = null;
  let trialStart = 0;

  function setOptionsEnabled(enabled) {
    optionsWrap.setAttribute("aria-disabled", enabled ? "false" : "true");
    optionButtons.forEach(btn => {
      btn.disabled = !enabled;
    });
  }

  function pickTrial() {
    const word = COLORS[Math.floor(Math.random() * COLORS.length)];
    let ink = COLORS[Math.floor(Math.random() * COLORS.length)];
    while (ink.name === word.name) {
      ink = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    currentWord = word;
    currentInk = ink;
  }

  function renderTrial() {
    wordEl.textContent = currentWord.name.toUpperCase();
    wordEl.style.color = currentInk.hex;
    progressEl.textContent = `Trial ${trialIndex + 1} of ${TRIALS}`;
    metaEl.textContent = `Errors: ${errors}`;
    statusEl.textContent = "Select the ink color.";
  }

  function nextTrial() {
    if (trialIndex >= TRIALS) {
      finish();
      return;
    }
    isFirstAttempt = true; 
    pickTrial();
    renderTrial();
    trialStart = performance.now();
  }

  function finish() {
    running = false;
    setOptionsEnabled(false);

    const total = times.reduce((a, b) => a + b, 0);
    const meanMs = times.length ? Math.round(total / times.length) : 0;
    const score = Math.max(0, 3 - errors);
    wordEl.textContent = "DONE";
    wordEl.style.color = "#0f172a";
    progressEl.textContent = `Score: ${score} / 3`;
    metaEl.textContent = `Mean RT: ${meanMs} ms`;
    statusEl.textContent = "Saving to your dashboard...";

    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "stroop",
        domain: "Executive Function",
        value: score,
        details: {
          SATURN_SCORE_STROOP_POINTS: score,
          SATURN_TIME_STROOP_ERRORS: errors,
          SATURN_TIME_STROOP_MEAN_ms: meanMs,
          correct_first_try: correctOnFirstTry,
          total_trials: TRIALS
        }
      })
    }).then(() => {
      statusEl.textContent = "Saved. Redirecting to dashboard...";
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 800);
    }).catch(() => {
      statusEl.textContent = "Could not save score. Please try again.";
      startBtn.disabled = false;
    });
  }

  function handleChoice(colorName) {
    if (!running) return;
    if (colorName === currentInk.name) {
      if (isFirstAttempt) {
        correctOnFirstTry += 1; // Increment only if they got it right first try
      }
      const elapsed = performance.now() - trialStart;
      times.push(elapsed);
      trialIndex += 1;
      nextTrial();
      return;
    }
    isFirstAttempt = false; // They missed the first attempt for this trial
    errors += 1;
    metaEl.textContent = `Errors: ${errors}`;
    statusEl.textContent = "Incorrect. Try the ink color.";
  }

  startBtn.addEventListener("click", () => {
    if (running) return;
    running = true;
    trialIndex = 0;
    errors = 0;
    times = [];
    startBtn.disabled = true;
    setOptionsEnabled(true);
    nextTrial();
  });

  optionButtons.forEach(btn => {
    btn.addEventListener("click", () => handleChoice(btn.dataset.color));
  });

  setOptionsEnabled(false);
})();
