(() => {
  let TRIALS = 12;
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
  let practiceLevel = "medium";
  let practiceContext = "mid";
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

  let trialTimer = null;
function nextTrial() {
    if (trialTimer) clearTimeout(trialTimer); // Clear any existing timer

    if (trialIndex >= TRIALS) {
      finish();
      return;
    }
    
    isFirstAttempt = true; 
    pickTrial();
    renderTrial();
    trialStart = performance.now();

    // Set 4-second limit
    trialTimer = setTimeout(() => {
      handleTimeout();
    }, 4000);
  }

  function handleTimeout() {
    if (!running) return;
    errors += 1;
    isFirstAttempt = false;
    times.push(4000); // Record maximum time as a penalty
    trialIndex += 1;
    nextTrial();
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
        practice_action: window.PRACTICE_MODE ? practiceLevel : null,
        practice_context: window.PRACTICE_MODE ? practiceContext : null,
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
    if (trialTimer) clearTimeout(trialTimer); // Stop the clock

    const elapsed = performance.now() - trialStart;
    times.push(elapsed);

    if (colorName === currentInk.name) {
      if (isFirstAttempt) {
        correctOnFirstTry += 1;
      }
    } else {
      errors += 1;
    }

    trialIndex += 1;
    nextTrial();
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
  initPractice();
})();
  async function initPractice() {
    if (!window.PRACTICE_MODE) return;
    try {
      const res = await fetch(`/api/practice/difficulty?game=stroop`);
      const data = await res.json();
      if (data.ok) {
        practiceLevel = data.level;
        practiceContext = data.context;
        if (practiceLevel === "easy") TRIALS = 8;
        if (practiceLevel === "hard") TRIALS = 16;
      }
    } catch {}
  }
