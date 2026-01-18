(() => {
  const stageEl = document.getElementById("orientationStage");
  const metaEl = document.getElementById("orientationMeta");
  const statusEl = document.getElementById("orientationStatus");
  const questionEl = document.getElementById("orientationQuestion");
  const promptEl = document.getElementById("orientationPrompt");
  const answerEl = document.getElementById("orientationAnswer");
  const submitBtn = document.getElementById("orientationSubmit");

  if (!stageEl) return;

  function normalize(text) {
    return String(text || "").trim().toLowerCase();
  }
  function digitsOnly(text) {
    return normalize(text).replace(/[^\d]/g, "");
  }
  function deviceTruth() {
    const now = new Date(); // device local time (exact day)
    return {
      year: now.getFullYear(),
      date: now.getDate(),
      month: now.toLocaleString("en-US", { month: "long" }).toLowerCase(),
      day: now.toLocaleString("en-US", { weekday: "long" }).toLowerCase(),
    };
  }
  function isCorrectDate(answer, expectedNumber) {
    const d = digitsOnly(answer);
    return d ? Number(d) === expectedNumber : false;
  }

  let questions = [];
  let index = 0;
  let deviceScore = 0;
  let timings = [];
  let questionStart = 0;
  let customAnswers = [];

  async function init() {
    stageEl.textContent = "Loading";
    statusEl.textContent = "Preparing prompts...";
    questionEl.style.display = "none";

    const res = await fetch("/api/orientation/prompts");
    const data = await res.json();
    questions = data.questions || [];

    // If user has zero custom questions, this still works (device-only).
    index = 0;
    deviceScore = 0;
    timings = [];
    customAnswers = [];

    stageEl.textContent = "Answer";
    questionEl.style.display = "grid";
    statusEl.textContent = "Answer each prompt and press submit.";
    showQuestion();
  }

  function showQuestion() {
    if (index >= questions.length) {
      finish();
      return;
    }
    const q = questions[index];
    promptEl.textContent = q.label;
    answerEl.value = "";
    answerEl.focus();
    questionStart = performance.now();
  }

  function checkAnswer() {
    const q = questions[index];
    const answer = normalize(answerEl.value);
    const elapsed = Math.round(performance.now() - questionStart);
    timings.push({ key: q.key, ms: elapsed });

    if (!answer) {
      index += 1;
      showQuestion();
      return;
    }

    if (q.type === "device") {
      // recompute device truth each question (handles midnight rollover)
      const truth = deviceTruth();
      if (q.key === "month" && answer === truth.month) deviceScore += 1;
      if (q.key === "day" && answer === truth.day) deviceScore += 1;
      if (q.key === "year" && digitsOnly(answer) === String(truth.year)) deviceScore += 1;
      if (q.key === "date" && isCorrectDate(answer, truth.date)) deviceScore += 1;
    } else {
      customAnswers.push({ key: q.key, answer });
    }

    index += 1;
    showQuestion();
  }

  async function finish() {
    stageEl.textContent = "Done";
    questionEl.style.display = "none";
    statusEl.textContent = "Grading and saving...";

    // grade custom answers server-side
    let customScore = 0;
    let customTotal = 0;

    try {
      const res = await fetch("/api/orientation/grade_custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: customAnswers }),
      });
      const data = await res.json();
      customScore = data.customScore || 0;
      customTotal = data.customTotal || 0;
    } catch {}

    const deviceTotal = questions.filter(q => q.type === "device").length;
    const totalScore = deviceScore + customScore;
    const totalTotal = deviceTotal + customTotal;

    metaEl.textContent = `Score: ${totalScore} / ${totalTotal}`;

    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "orientation",
        domain: "Orientation",
        value: totalScore,
        details: {
          max: totalTotal,
          deviceScore,
          customScore,
          timings
        }
      }),
    })
      .then(() => {
        statusEl.textContent = "Saved. Redirecting to dashboard...";
        setTimeout(() => (window.location.href = "/dashboard"), 800);
      })
      .catch(() => {
        statusEl.textContent = "Could not save score. Please try again.";
      });
  }

  submitBtn.addEventListener("click", checkAnswer);
  answerEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkAnswer();
    }
  });

  init();
})();
