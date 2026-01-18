(() => {
  let WORDS = [];
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
  const inputsEl = document.getElementById("recallInputs");
  const submitBtn = document.getElementById("recallSubmit");

  if (!stageEl) return;

  let phase = "ready";
  let studyCountdown = null;
  let delayCountdown = null;
  let recallStart = 0;

  // Fetch random words on page load
  fetch("/api/recall-words")
    .then((res) => res.json())
    .then((data) => {
      WORDS = data.words;
      renderWords();
      if (phase === "study") {
        showWords(true);
      }
    })
    .catch((err) => {
      console.error("Failed to load words:", err);
      // Fallback words
      WORDS = ["face", "velvet", "church", "daisy", "red"];
      renderWords();
    });

  function renderWords() {
    if (wordsEl) {
      wordsEl.innerHTML = "";
      WORDS.forEach((word) => {
        const wordDiv = document.createElement("div");
        wordDiv.className =
          "text-center font-black tracking-[0.2em] py-3 rounded-2xl bg-white/5 text-white";
        wordDiv.textContent = word.toUpperCase();
        wordsEl.appendChild(wordDiv);
      });
    }
    renderInputs();
  }

  function renderInputs() {
    if (!inputsEl) return;
    inputsEl.innerHTML = "";
    WORDS.forEach((_, index) => {
      const input = document.createElement("input");
      input.type = "text";
      input.className =
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-400";
      input.placeholder = `Word ${index + 1}`;
      input.dataset.index = String(index);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitRecall();
        }
      });
      inputsEl.appendChild(input);
    });
  }

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
    if (wordsEl && !wordsEl.children.length) {
      renderWords();
    }
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
    const firstInput = inputsEl?.querySelector("input");
    if (firstInput) {
      inputsEl.querySelectorAll("input").forEach((el) => {
        el.value = "";
      });
      firstInput.focus();
    }
    recallStart = performance.now();
  }

  function computeScore() {
    const tokens = Array.from(inputsEl?.querySelectorAll("input") || [])
      .map((input) => input.value.toLowerCase().trim())
      .filter(Boolean);
    const unique = new Set(tokens);
    let correct = 0;
    WORDS.forEach((word) => {
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
        details: {
          SATURN_SCORE_RECALL_FIVEWORDS: score,
          SATURN_TIME_RECALL_FIVEWORDS_ms: elapsed
        }
      }),
    })
      .then(() => {
        statusEl.textContent = "Saved. Redirecting to dashboard...";
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 800);
      })
      .catch(() => {
        statusEl.textContent = "Could not save score. Please try again.";
        submitBtn.disabled = false;
      });
  }

  startBtn.addEventListener("click", () => {
    if (phase !== "ready") return;
    startBtn.disabled = true;
    startBtn.classList.add("opacity-50", "cursor-not-allowed");
    startStudy();
  });

  submitBtn.addEventListener("click", submitRecall);

  inputWrap.style.display = "none";
  showWords(false);
})();
