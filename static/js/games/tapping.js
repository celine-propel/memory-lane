(() => {
  const DURATION_SECONDS = 15;

  const stageEl = document.getElementById("tappingStage");
  const metaEl = document.getElementById("tappingMeta");
  const timerEl = document.getElementById("tappingTimer");
  const areaEl = document.getElementById("tappingArea");
  const targetBtn = document.getElementById("tappingTarget");
  const startBtn = document.getElementById("tappingStart");
  const statusEl = document.getElementById("tappingStatus");

  if (!stageEl) return;

  let running = false;
  let taps = 0;
  let remaining = DURATION_SECONDS;
  let timerId = null;

  function setEnabled(enabled) {
    areaEl.setAttribute("aria-disabled", enabled ? "false" : "true");
    targetBtn.disabled = !enabled;
  }

  function updateMeta() {
    metaEl.textContent = `Taps: ${taps}`;
  }

  function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timerId);
      finish();
      return;
    }
    timerEl.textContent = `Time left: ${remaining}s`;
  }

  function start() {
    if (running) return;
    running = true;
    taps = 0;
    remaining = DURATION_SECONDS;
    stageEl.textContent = "Tap";
    updateMeta();
    statusEl.textContent = "Tap the button as fast as you can.";
    timerEl.textContent = `Time left: ${remaining}s`;
    startBtn.disabled = true;
    setEnabled(true);
    timerId = setInterval(tick, 1000);
  }

  function finish() {
    running = false;
    setEnabled(false);
    stageEl.textContent = "Done";
    timerEl.textContent = `Finished: ${DURATION_SECONDS}s`;
    statusEl.textContent = "Saving to your dashboard...";

    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "tapping",
        domain: "Attention",
        value: taps,
        duration_s: DURATION_SECONDS
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

  targetBtn.addEventListener("click", () => {
    if (!running) return;
    taps += 1;
    updateMeta();
  });

  startBtn.addEventListener("click", start);

  setEnabled(false);
})();
