(() => {
  const stageEl = document.getElementById("orientationStage");
  const metaEl = document.getElementById("orientationMeta");
  const setupEl = document.getElementById("orientationSetup");
  const beginBtn = document.getElementById("orientationBegin");
  const statusEl = document.getElementById("orientationStatus");
  const questionEl = document.getElementById("orientationQuestion");
  const promptEl = document.getElementById("orientationPrompt");
  const answerEl = document.getElementById("orientationAnswer");
  const submitBtn = document.getElementById("orientationSubmit");

  const cityEl = document.getElementById("orientationCity");
  const stateEl = document.getElementById("orientationState");
  const placeEl = document.getElementById("orientationPlace");

  if (!stageEl) return;

  const now = new Date();
  const expected = {
    date: String(now.getDate()),
    month: now.toLocaleString("en-US", { month: "long" }).toLowerCase(),
    year: String(now.getFullYear()),
    day: now.toLocaleString("en-US", { weekday: "long" }).toLowerCase(),
    city: "",
    state: "",
    place: ""
  };

  const questions = [
    { key: "date", label: "What is the date today?" },
    { key: "month", label: "What month is it?" },
    { key: "year", label: "What year is it?" },
    { key: "day", label: "What day of the week is it?" },
    { key: "place", label: "Where are you right now?" },
    { key: "city", label: "What city are we in?" },
    { key: "state", label: "What state are we in?" }
  ];

  let index = 0;
  let score = 0;
  let timings = [];
  let questionStart = 0;

  function normalize(text) {
    return text.trim().toLowerCase();
  }

  function startQuestions() {
    expected.city = normalize(cityEl.value);
    expected.state = normalize(stateEl.value);
    expected.place = normalize(placeEl.value);

    if (!expected.city || !expected.state || !expected.place) {
      statusEl.textContent = "Please fill out city, state, and place to continue.";
      return;
    }

    setupEl.style.display = "none";
    questionEl.style.display = "grid";
    questionEl.setAttribute("aria-hidden", "false");
    stageEl.textContent = "Answer";
    statusEl.textContent = "Answer each prompt and press submit.";
    showQuestion();
  }

  function showQuestion() {
    if (index >= questions.length) {
      finish();
      return;
    }
    const current = questions[index];
    promptEl.textContent = current.label;
    answerEl.value = "";
    answerEl.focus();
    questionStart = performance.now();
  }

  function checkAnswer() {
    const current = questions[index];
    const answer = normalize(answerEl.value);
    const elapsed = Math.round(performance.now() - questionStart);
    timings.push({ key: current.key, ms: elapsed });

    if (!answer) {
      index += 1;
      showQuestion();
      return;
    }

    if (current.key === "month") {
      if (answer === expected.month) score += 1;
    } else if (current.key === "day") {
      if (answer === expected.day) score += 1;
    } else if (current.key === "date") {
      if (answer === expected.date) score += 1;
    } else if (current.key === "year") {
      if (answer === expected.year) score += 1;
    } else {
      const expectedValue = expected[current.key];
      if (expectedValue && answer === expectedValue) score += 1;
    }

    index += 1;
    showQuestion();
  }

  function finish() {
    stageEl.textContent = "Done";
    questionEl.style.display = "none";
    metaEl.textContent = `Score: ${score} / ${questions.length}`;
    statusEl.textContent = "Saving to your dashboard...";

    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "orientation",
        domain: "Orientation",
        value: score,
        timings
      })
    }).then(() => {
      statusEl.textContent = "Saved. Redirecting to dashboard...";
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 800);
    }).catch(() => {
      statusEl.textContent = "Could not save score. Please try again.";
      setupEl.style.display = "grid";
      questionEl.style.display = "none";
    });
  }

  beginBtn.addEventListener("click", startQuestions);
  submitBtn.addEventListener("click", checkAnswer);

  answerEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkAnswer();
    }
  });
})();
