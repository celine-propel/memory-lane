(() => {
  const WORDS = ["face", "velvet", "church", "daisy", "red"];
  const STUDY_SECONDS = 20;
  const DELAY_SECONDS = 15;

  const stageEl = document.getElementById("recallStage");
  const metaEl = document.getElementById("recallMeta");
  const wordsEl = document.getElementById("recallWords");
  const timerEl = document.getElementById("recallTimer");
  const statusEl = document.getElementById("recallStatus");
  const startBtn = document.getElementById("recallStart");
  const actionsEl = document.getElementById("recallActions");
  const inputWrap = document.getElementById("recallInput");
  const answerField = document.getElementById("recallAnswer");
  const submitBtn = document.getElementById("recallSubmit");

  if (!stageEl) return;

  let phase = "ready";
  let studyCountdown = null;
  let delayCountdown = null;
  let recallStart = 0;

  function setStage(label) {
    stageEl.textContent = label;
  }

  function setTimer(text) {
    timerEl.textContent = text;
  }

  function showWords(show) {
    wordsEl.style.visibility = show ? "visible" : "hidden";
  }

  function startStudy() {
    phase = "study";
    setStage("Study");
    statusEl.textContent = "Memorize the words.";
    showWords(true);
    let remaining = STUDY_SECONDS;
    setTimer(`Study time: ${remaining}s`);
    studyCountdown = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(studyCountdown);
        startDelay();
        return;
      }
      setTimer(`Study time: ${remaining}s`);
    }, 1000);
  }

  function startDelay() {
    phase = "delay";
    setStage("Wait");
    showWords(false);
    statusEl.textContent = "Short break. Get ready to recall.";
    let remaining = DELAY_SECONDS;
    setTimer(`Recall starts in ${remaining}s`);
    delayCountdown = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(delayCountdown);
        startRecall();
        return;
      }
      setTimer(`Recall starts in ${remaining}s`);
    }, 1000);
  }

  function startRecall() {
    phase = "recall";
    setStage("Recall");
    setTimer("Type the words you remember.");
    statusEl.textContent = "Press submit when finished.";
    actionsEl.style.display = "none";
    inputWrap.style.display = "grid";
    inputWrap.setAttribute("aria-hidden", "false");
    answerField.value = "";
    answerField.focus();
    recallStart = performance.now();
  }

  function computeScore() {
    const raw = answerField.value.toLowerCase();
    const tokens = raw.split(/[^a-z]+/).filter(Boolean);
    const unique = new Set(tokens);
    let correct = 0;
    WORDS.forEach(word => {
      if (unique.has(word)) correct += 1;
    });
    return correct;
  }

  function submitRecall() {
    if (phase !== "recall") return;
    const score = computeScore();
    const elapsed = Math.round(performance.now() - recallStart);

    phase = "done";
    setStage("Done");
    metaEl.textContent = `Score: ${score} / 5`;
    statusEl.textContent = "Saving to your dashboard...";
    submitBtn.disabled = true;

    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "recall",
        domain: "Memory",
        value: score,
        recall_ms: elapsed
      })
    }).then(() => {
      statusEl.textContent = "Saved. Redirecting to dashboard...";
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 800);
    }).catch(() => {
      statusEl.textContent = "Could not save score. Please try again.";
      submitBtn.disabled = false;
    });
  }

  startBtn.addEventListener("click", () => {
    if (phase !== "ready") return;
    startBtn.disabled = true;
    startStudy();
  });

  submitBtn.addEventListener("click", submitRecall);

  answerField.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitRecall();
    }
  });

  inputWrap.style.display = "none";
  showWords(true);
})();
