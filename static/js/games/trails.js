(() => {
  const PAIRS = 8;
  const NODE_SIZE = 52;
  const BOARD_PADDING = 18;
  const MIN_DIST = 62;

  const boardEl = document.getElementById("trBoard");
  const svgEl = document.getElementById("trLines"); // may be null if you removed it
  const startBtn = document.getElementById("trStart");
  const submitBtn = document.getElementById("trSubmit");
  const progressEl = document.getElementById("trProgress");
  const metaEl = document.getElementById("trMeta");
  const statusEl = document.getElementById("trStatus");
  if (!boardEl || !startBtn || !submitBtn) return;

  let running = false;
  let errors = 0;
  let startTime = 0;

  let sequence = [];
  let seqIndex = 0;

  let stepTimes = [];
  let lastCorrectTime = 0;

  const posById = new Map();

  // Track the most recently correct node element
  let lastCorrectEl = null;

  function setMeta() {
    metaEl.textContent = `Errors: ${errors}`;
  }
  function setProgress(txt) {
    progressEl.textContent = txt;
  }
  function setStatus(txt) {
    statusEl.textContent = txt;
  }

  function buildSequence() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const seq = [];
    for (let i = 1; i <= PAIRS; i++) {
      seq.push(String(i));
      seq.push(letters[i - 1]);
    }
    return seq;
  }

  function clearBoard() {
    boardEl.innerHTML = "";
    if (svgEl) svgEl.innerHTML = "";
    posById.clear();
    lastCorrectEl = null;
  }

  function randBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function dist(a, b) {
    const dx = a.x - b.x,
      dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function placeNodesRandomly(ids) {
    const rect = boardEl.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    const points = [];
    for (const id of ids) {
      let tries = 0;
      let p = null;
      while (tries < 500) {
        const x = randBetween(
          BOARD_PADDING + NODE_SIZE / 2,
          W - BOARD_PADDING - NODE_SIZE / 2
        );
        const y = randBetween(
          BOARD_PADDING + NODE_SIZE / 2,
          H - BOARD_PADDING - NODE_SIZE / 2
        );
        const candidate = { x, y };

        let ok = true;
        for (const q of points) {
          if (dist(candidate, q) < MIN_DIST) {
            ok = false;
            break;
          }
        }
        if (ok) {
          p = candidate;
          break;
        }
        tries += 1;
      }

      if (!p) {
        p = {
          x: randBetween(
            BOARD_PADDING + NODE_SIZE / 2,
            W - BOARD_PADDING - NODE_SIZE / 2
          ),
          y: randBetween(
            BOARD_PADDING + NODE_SIZE / 2,
            H - BOARD_PADDING - NODE_SIZE / 2
          ),
        };
      }

      points.push(p);
      posById.set(id, p);
    }
  }

  function nodeClass(base = "") {
    return (
      "absolute flex items-center justify-center rounded-full " +
      "font-black text-sm select-none shadow-md transition " +
      "border border-white/10 bg-white/10 text-white " +
      base
    );
  }

  function flashWrong(el) {
    el.classList.add("bg-red-500/40");
    setTimeout(() => el.classList.remove("bg-red-500/40"), 250);
  }

  function lockCorrect(el) {
    // mark as correct (green)
    el.classList.add("bg-emerald-500/40", "border-emerald-300/40");
    el.dataset.locked = "true";
  }

  function setLastCorrectHighlight(el) {
    // previous "last correct" should become normal-green (not yellow)
    if (lastCorrectEl) {
      lastCorrectEl.classList.remove("bg-yellow-400/40", "border-yellow-200/50");
      // keep it green (it already is)
    }

    // current becomes yellow "you are here"
    el.classList.add("bg-yellow-400/40", "border-yellow-200/50");
    lastCorrectEl = el;
  }

  function renderNodes() {
    clearBoard();

    const ids = sequence.slice();
    placeNodesRandomly(ids);

    for (const id of ids) {
      const p = posById.get(id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.id = id;
      btn.dataset.locked = "false";
      btn.className = nodeClass("");
      btn.style.width = `${NODE_SIZE}px`;
      btn.style.height = `${NODE_SIZE}px`;
      btn.style.left = `${p.x - NODE_SIZE / 2}px`;
      btn.style.top = `${p.y - NODE_SIZE / 2}px`;
      btn.textContent = id;

      btn.addEventListener("click", () => handleTap(id, btn));
      boardEl.appendChild(btn);
    }
  }

  function handleTap(id, el) {
    if (!running) return;
    if (el.dataset.locked === "true") return;

    const expected = sequence[seqIndex];
    if (id !== expected) {
      errors += 1;
      setMeta();
      flashWrong(el);
      // Don't reveal the next correct answer (no cheating)
      setStatus("Wrong. Try again.");
      return;
    }

    // correct
    const now = performance.now();
    if (seqIndex === 0) {
      stepTimes = [];
      lastCorrectTime = now;
    } else {
      stepTimes.push(now - lastCorrectTime);
      lastCorrectTime = now;
      // no lines
    }

    lockCorrect(el);
    setLastCorrectHighlight(el);

    seqIndex += 1;

    setProgress(`Step ${seqIndex} / ${sequence.length}`);
    setStatus("Good. Keep going.");

    if (seqIndex >= sequence.length) {
      setStatus("Done! Press Submit to save.");
      submitBtn.disabled = false;
      running = false;
    }
  }

  function finish() {
    submitBtn.disabled = true;

    const elapsed = Math.round(performance.now() - startTime);
    const completed = seqIndex;
    const totalSteps = sequence.length;

    const meanStep = stepTimes.length
      ? Math.round(stepTimes.reduce((a, b) => a + b, 0) / stepTimes.length)
      : 0;

    let score = 0;
    const completionRate = totalSteps ? completed / totalSteps : 0;

    if (completionRate >= 0.95 && errors <= 2) score = 3;
    else if (completionRate >= 0.75) score = 2;
    else if (completionRate >= 0.45) score = 1;

    setProgress(`Score: ${score} / 3`);
    setStatus("Saving to your dashboard...");

    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "trails_switch",
        domain: "Executive Function",
        value: score,
        elapsed_ms: elapsed,
        errors,
        completed_steps: completed,
        total_steps: totalSteps,
        mean_step_ms: meanStep,
        step_ms: stepTimes,
      }),
    })
      .then(() => {
        setStatus("Saved. Redirecting to dashboard...");
        setTimeout(() => (window.location.href = "/dashboard"), 800);
      })
      .catch(() => {
        setStatus("Could not save score. Please try again.");
        startBtn.disabled = false;
      });
  }

  function start() {
    if (running) return;

    errors = 0;
    seqIndex = 0;
    sequence = buildSequence();
    setMeta();

    renderNodes();

    startBtn.disabled = true;
    submitBtn.disabled = false;

    running = true;
    setProgress(`Step 0 / ${sequence.length}`);
    setStatus("Tap 1 to begin.");

    startTime = performance.now();
  }

  startBtn.addEventListener("click", start);
  submitBtn.addEventListener("click", () => {
    if (startTime === 0) return;
    running = false;
    finish();
  });

  setProgress("Ready");
})();
