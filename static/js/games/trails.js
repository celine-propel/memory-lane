(() => {
    let PAIRS = 8;              // 8 pairs => 16 nodes (1..8 and A..H)
    const NODE_SIZE = 52;         // px diameter
    const BOARD_PADDING = 18;     // keep away from edges
    const MIN_DIST = 62;          // min distance between node centers
    const MAX_TIME_MS = 60000;    // auto-finish after 60s
  
    const boardEl = document.getElementById("trBoard");
    const svgEl = document.getElementById("trLines");
    const startBtn = document.getElementById("trStart");
    const progressEl = document.getElementById("trProgress");
    const metaEl = document.getElementById("trMeta");
    const statusEl = document.getElementById("trStatus");
    if (!boardEl || !svgEl || !startBtn) return;
  
    let running = false;
    let errors = 0;
    let startTime = 0;
    let timeoutId = null;
    let practiceLevel = "medium";
    let practiceContext = "mid";
  
    // Order: 1, A, 2, B, 3, C ...
    let sequence = [];
    let seqIndex = 0; // next expected index in sequence
  
    // timing between correct taps
    let stepTimes = [];
    let lastCorrectTime = 0;
  
    // store node positions for line drawing
    const posById = new Map(); // id -> {x,y} center in px
  
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
        seq.push(letters[i - 1]); // A, B, C...
      }
      return seq;
    }
  
    function clearBoard() {
      boardEl.innerHTML = "";
      svgEl.innerHTML = "";
      posById.clear();
    }
  
    function randBetween(a, b) {
      return a + Math.random() * (b - a);
    }
  
    function dist(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx*dx + dy*dy);
    }
  
    function placeNodesRandomly(ids) {
      // naive rejection sampling: good enough for 16 nodes
      const rect = boardEl.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
  
      const points = [];
      for (const id of ids) {
        let tries = 0;
        let p = null;
        while (tries < 500) {
          const x = randBetween(BOARD_PADDING + NODE_SIZE/2, W - BOARD_PADDING - NODE_SIZE/2);
          const y = randBetween(BOARD_PADDING + NODE_SIZE/2, H - BOARD_PADDING - NODE_SIZE/2);
          const candidate = { x, y };
  
          let ok = true;
          for (const q of points) {
            if (dist(candidate, q) < MIN_DIST) { ok = false; break; }
          }
          if (ok) { p = candidate; break; }
          tries += 1;
        }
        if (!p) {
          // fallback: allow closer if crowded
          p = {
            x: randBetween(BOARD_PADDING + NODE_SIZE/2, W - BOARD_PADDING - NODE_SIZE/2),
            y: randBetween(BOARD_PADDING + NODE_SIZE/2, H - BOARD_PADDING - NODE_SIZE/2)
          };
        }
        points.push(p);
        posById.set(id, p);
      }
    }
  
    function drawLine(fromId, toId) {
      const a = posById.get(fromId);
      const b = posById.get(toId);
      if (!a || !b) return;
  
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);
      line.setAttribute("stroke", "rgba(199,210,254,0.85)"); // indigo-ish
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      svgEl.appendChild(line);
    }
  
    function nodeClass(base = "") {
      return (
        "absolute flex items-center justify-center rounded-full " +
        "font-black text-sm select-none shadow-md transition " +
        "border border-white/10 bg-white/10 text-white " +
        base
      );
    }
  
    function setNextHint() {
      const expected = sequence[seqIndex];
      // clear old hint
      boardEl.querySelectorAll(".tr-hint").forEach(el => el.classList.remove("tr-hint", "ring-2", "ring-indigo-300/70"));
      const el = boardEl.querySelector(`[data-id="${expected}"]`);
      if (el) el.classList.add("tr-hint", "ring-2", "ring-indigo-300/70");
    }
  
    function flashWrong(el) {
      el.classList.add("bg-red-500/40");
      setTimeout(() => el.classList.remove("bg-red-500/40"), 250);
    }
  
    function lockCorrect(el) {
      el.classList.add("bg-emerald-500/40");
      el.classList.add("border-emerald-300/40");
      el.dataset.locked = "true";
    }
  
    function renderNodes() {
      clearBoard();
  
      // IDs are the unique labels: "1".."N" and "A".. etc
      const ids = sequence.slice(); // all nodes in sequence
      // place all nodes
      placeNodesRandomly(ids);
  
      // create DOM nodes
      for (const id of ids) {
        const p = posById.get(id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.id = id;
        btn.dataset.locked = "false";
        btn.className = nodeClass("");
        btn.style.width = `${NODE_SIZE}px`;
        btn.style.height = `${NODE_SIZE}px`;
        btn.style.left = `${p.x - NODE_SIZE/2}px`;
        btn.style.top = `${p.y - NODE_SIZE/2}px`;
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
        setStatus(`Wrong. Next is ${expected}.`);
        return;
      }
  
      // correct
      const now = performance.now();
      if (seqIndex === 0) {
        // time-to-first-correct
        stepTimes = [];
        lastCorrectTime = now;
      } else {
        stepTimes.push(now - lastCorrectTime);
        lastCorrectTime = now;
  
        // draw line from previous correct to this one
        drawLine(sequence[seqIndex - 1], id);
      }
  
      lockCorrect(el);
      seqIndex += 1;
  
      setProgress(`Step ${seqIndex} / ${sequence.length}`);
      setStatus("Good. Keep going.");
      setNextHint();
  
      if (seqIndex >= sequence.length) {
        // completed — you can auto-finish OR wait for submit
        setStatus("Done! Press Submit to save.");
        submitBtn.disabled = false;
        running = false; // optional: freeze after completion
      }
    }
  
    function finish() {
      submitBtn.disabled = true;
  
      const elapsed = Math.round(performance.now() - startTime);
      const completed = seqIndex; // number of correct taps
      const totalSteps = sequence.length;
  
      const meanStep = stepTimes.length
        ? Math.round(stepTimes.reduce((a, b) => a + b, 0) / stepTimes.length)
        : 0;
  
      // Simple 0..3 score (tune later)
      // More weight on completion + errors + speed
      let score = 0;
      const completionRate = totalSteps ? (completed / totalSteps) : 0;
  
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
          step_ms: stepTimes
        })
      }).then(() => {
        setStatus("Saved. Redirecting to dashboard...");
        setTimeout(() => (window.location.href = "/dashboard"), 800);
      })
      .catch(() => {
        setStatus("Could not save score. Please try again.");
        startBtn.disabled = false;
        startBtn.classList.remove("opacity-50", "cursor-not-allowed");
      });
    }
  
    function start() {
      if (running) return;
  
      errors = 0;
      seqIndex = 0;
      sequence = buildSequence();
      setMeta();
  
      renderNodes();
      setNextHint();
  
      startBtn.disabled = true;
      submitBtn.disabled = false;
  
      running = true;
      setProgress(`Step 0 / ${sequence.length}`);
      setStatus("Tap 1 to begin.");
  
      startTime = performance.now();
    }
  
    startBtn.addEventListener("click", start);
    submitBtn.addEventListener("click", () => {
      // allow submit even if not fully complete (good for scoring)
      if (startTime === 0) return;
      running = false;
      finish();
    });
  
    setProgress("Ready");
  })();
  