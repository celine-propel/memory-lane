(() => {
  const stageEl = document.getElementById("orientationStage");
  const metaEl = document.getElementById("orientationMeta");
  const statusEl = document.getElementById("orientationStatus");
  const questionEl = document.getElementById("orientationQuestion");
  const promptEl = document.getElementById("orientationPrompt");
  const answerEl = document.getElementById("orientationAnswer");
  const selectEl = document.getElementById("orientationSelect");
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
  let deviceCorrect = {};
  let deviceTimes = {};
  let timings = [];
  let questionStart = 0;
  let customAnswers = [];
  let practiceLevel = "medium";
  let practiceContext = "mid";

  async function initPractice() {
    if (!window.PRACTICE_MODE) return;
    try {
      const res = await fetch(`/api/practice/difficulty?game=orientation`);
      const data = await res.json();
      if (data.ok) {
        practiceLevel = data.level;
        practiceContext = data.context;
      }
    } catch {}
  }

  function setAnswerMode(useSelect) {
    if (useSelect) {
      selectEl.style.display = "block";
      answerEl.style.display = "none";
    } else {
      selectEl.style.display = "none";
      answerEl.style.display = "block";
    }
  }

  function fillSelectOptions(options) {
    selectEl.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select an option";
    selectEl.appendChild(blank);
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      selectEl.appendChild(option);
    });
  }

  function monthOptions() {
    const months = [];
    for (let i = 0; i < 12; i += 1) {
      const name = new Date(2000, i, 1).toLocaleString("en-US", { month: "long" });
      months.push({ value: name.toLowerCase(), label: name });
    }
    return months;
  }

  function dayOptions() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days.map((d) => ({ value: d.toLowerCase(), label: d }));
  }

  function dateOptions() {
    const opts = [];
    for (let i = 1; i <= 31; i += 1) {
      opts.push({ value: String(i), label: String(i) });
    }
    return opts;
  }

  function yearOptions() {
    const truth = deviceTruth();
    const opts = [];
    for (let y = truth.year - 10; y <= truth.year + 10; y += 1) {
      opts.push({ value: String(y), label: String(y) });
    }
    return opts;
  }

  async function init() {
    stageEl.textContent = "Loading";
    statusEl.textContent = "Preparing prompts...";
    questionEl.style.display = "none";
    await initPractice();
    const level = window.PRACTICE_MODE ? practiceLevel : "medium";
    const res = await fetch(`/api/orientation/prompts?level=${level}`);
    const data = await res.json();
    questions = data.questions || [];

    // If user has zero custom questions, this still works (device-only).
    index = 0;
    deviceScore = 0;
    deviceCorrect = {};
    deviceTimes = {};
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
    selectEl.value = "";
    if (q.type === "device") {
      if (q.key === "month") fillSelectOptions(monthOptions());
      if (q.key === "day") fillSelectOptions(dayOptions());
      if (q.key === "date") fillSelectOptions(dateOptions());
      if (q.key === "year") fillSelectOptions(yearOptions());
      setAnswerMode(true);
      selectEl.focus();
    } else {
      setAnswerMode(false);
      answerEl.focus();
    }
    questionStart = performance.now();
  }

  function checkAnswer() {
    const q = questions[index];
    const raw = q.type === "device" ? selectEl.value : answerEl.value;
    const answer = normalize(raw);
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
      let correct = 0;
      if (q.key === "month" && answer === truth.month) correct = 1;
      if (q.key === "day" && answer === truth.day) correct = 1;
      if (q.key === "year" && digitsOnly(answer) === String(truth.year)) correct = 1;
      if (q.key === "date" && isCorrectDate(answer, truth.date)) correct = 1;
      if (correct) deviceScore += 1;
      deviceCorrect[q.key] = correct;
      deviceTimes[q.key] = elapsed;
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
    const scorePercentage = Math.round((totalScore / totalTotal) * 100);

    metaEl.textContent = `Score: ${scorePercentage}%`;

    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "orientation",
        domain: "Orientation",
        value: totalScore,
        practice_action: window.PRACTICE_MODE ? practiceLevel : null,
        practice_context: window.PRACTICE_MODE ? practiceContext : null,
        details
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