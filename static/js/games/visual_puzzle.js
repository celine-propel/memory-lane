(() => {
    // ===== Config =====
    const GRID = 3;                 // 3x3
    const DISPLAY_MS = 3500;        // preview time
    const MAX_TIME_MS = 60000;      // optional cap (auto-submits at 60s). Set null to disable.
  
    // 6 pieces, all used
    const PIECES = [
      { id: "p1", shape: "circle",   color: "#60a5fa" },
      { id: "p2", shape: "square",   color: "#34d399" },
      { id: "p3", shape: "triangle", color: "#f87171" },
      { id: "p4", shape: "diamond",  color: "#a78bfa" },
      { id: "p5", shape: "hex",      color: "#fbbf24" },
      { id: "p6", shape: "ring",     color: "#fb7185" }
    ];
  
    // ===== DOM =====
    const boardEl = document.getElementById("vpBoard");
    const trayEl = document.getElementById("vpTray");
    const startBtn = document.getElementById("vpStart");
    const submitBtn = document.getElementById("vpSubmit");
    const progressEl = document.getElementById("vpProgress");
    const metaEl = document.getElementById("vpMeta");
    const statusEl = document.getElementById("vpStatus");
    if (!boardEl || !trayEl || !startBtn || !submitBtn) return;
  
    // ===== State =====
    let running = false;
    let locked = false; // locked during preview and after finish
    let moves = 0;
    let mistakes = 0;   // CURRENT incorrect placements (not cumulative)
    let startTime = 0;
    let timeoutId = null;
  
    // placement: slotIndex -> pieceId (or null)
    const placed = Array(GRID * GRID).fill(null);
  
    // Target chosen per run (length 9, nulls allowed)
    let TARGET = null;
  
    // ===== Helpers =====
    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  
    function setStatus(msg) {
      statusEl.textContent = msg;
    }
  
    function setProgress(msg) {
      progressEl.textContent = msg;
    }
  
    // Mistakes = how many currently placed pieces are in the wrong slot.
    function recomputeMistakes() {
      if (!TARGET) {
        mistakes = 0;
        return;
      }
      let m = 0;
      for (let i = 0; i < placed.length; i++) {
        if (!placed[i]) continue;
        if (TARGET[i] !== placed[i]) m += 1;
      }
      mistakes = m;
    }
  
    function setMeta() {
      recomputeMistakes();
      metaEl.textContent = `Moves: ${moves}`;
    }
  
    function clearUI() {
      boardEl.innerHTML = "";
      trayEl.innerHTML = "";
    }
  
    function injectShapeCSSOnce() {
      if (document.getElementById("vpShapeStyles")) return;
      const style = document.createElement("style");
      style.id = "vpShapeStyles";
      style.textContent = `
        .vp-shape { width: 44px; height: 44px; }
        .vp-shape.circle { border-radius: 999px; }
        .vp-shape.square { border-radius: 10px; }
        .vp-shape.triangle {
          width: 0; height: 0; background: transparent !important;
          border-left: 22px solid transparent;
          border-right: 22px solid transparent;
          border-bottom: 44px solid currentColor;
        }
        .vp-shape.diamond { transform: rotate(45deg); border-radius: 10px; }
        .vp-shape.hex {
          clip-path: polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%);
          border-radius: 6px;
        }
        .vp-shape.ring {
          border-radius: 999px;
          background: transparent !important;
          border: 10px solid currentColor;
        }
      `;
      document.head.appendChild(style);
    }
  
    function applyShapeColorFix(pieceEl, piece) {
      // triangle + ring use currentColor; others use background
      if (piece.shape === "triangle" || piece.shape === "ring") {
        pieceEl.style.color = piece.color;
      } else {
        pieceEl.style.color = "";
      }
    }
  
    function resetPlacement() {
      for (let i = 0; i < placed.length; i++) placed[i] = null;
    }
  
    // Generate a random target: choose 6 of 9 slots, place the 6 pieces randomly.
    function generateTarget() {
      const slots = Array.from({ length: GRID * GRID }, (_, i) => i);
      const chosenSlots = shuffle(slots).slice(0, PIECES.length); // 6 slots
      const pieceIds = shuffle(PIECES.map(p => p.id));
  
      const t = Array(GRID * GRID).fill(null);
      for (let i = 0; i < chosenSlots.length; i++) {
        t[chosenSlots[i]] = pieceIds[i];
      }
      return t;
    }
  
    function removePieceFromAllSlots(pieceId) {
      for (let i = 0; i < placed.length; i++) {
        if (placed[i] === pieceId) placed[i] = null;
      }
    }
  
    function makeSlot(slotIndex) {
      const slot = document.createElement("div");
      slot.className =
        "vp-slot relative rounded-xl bg-white/5 border border-white/10 " +
        "aspect-square flex items-center justify-center overflow-hidden";
      slot.dataset.slot = String(slotIndex);
  
      slot.addEventListener("dragover", (e) => {
        if (!running || locked) return;
        e.preventDefault();
        slot.classList.add("ring-2", "ring-indigo-400/60");
      });
  
      slot.addEventListener("dragleave", () => {
        slot.classList.remove("ring-2", "ring-indigo-400/60");
      });
  
      slot.addEventListener("drop", (e) => {
        if (!running || locked) return;
        e.preventDefault();
        slot.classList.remove("ring-2", "ring-indigo-400/60");
  
        const pieceId = e.dataTransfer.getData("text/plain");
        if (!pieceId) return;
  
        const pieceEl = document.querySelector(`[data-piece="${pieceId}"]`);
        if (!pieceEl) return;
  
        // If this slot already has a piece, send it back to tray.
        const existingPieceId = placed[slotIndex];
        if (existingPieceId) {
          placed[slotIndex] = null;
          const existingEl = document.querySelector(`[data-piece="${existingPieceId}"]`);
          if (existingEl) trayEl.appendChild(existingEl);
        }
  
        // Remove dragged piece from wherever it currently is (another slot or tray)
        removePieceFromAllSlots(pieceId);
  
        // Place it here
        placed[slotIndex] = pieceId;
        slot.appendChild(pieceEl);
  
        moves += 1;
        setMeta(); // recomputes mistakes based on current board state
      });
  
      return slot;
    }
  
    function makePiece(piece) {
      const wrap = document.createElement("div");
      wrap.className =
        "vp-piece w-[72px] h-[72px] rounded-xl bg-white/5 border border-white/10 " +
        "flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm";
      wrap.draggable = true;
      wrap.dataset.piece = piece.id;
  
      wrap.addEventListener("dragstart", (e) => {
        if (!running || locked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/plain", piece.id);
        e.dataTransfer.effectAllowed = "move";
      });
  
      const inner = document.createElement("div");
      inner.className = `vp-shape ${piece.shape}`;
      inner.style.background = piece.color;
  
      wrap.appendChild(inner);
      applyShapeColorFix(wrap, piece);
      return wrap;
    }
  
    function renderPreviewSolved() {
      // Move each target piece into its correct slot for preview
      for (let i = 0; i < TARGET.length; i++) {
        const want = TARGET[i];
        const slot = boardEl.querySelector(`[data-slot="${i}"]`);
        if (!slot) continue;
  
        slot.innerHTML = "";
        if (!want) continue;
  
        const pieceEl = document.querySelector(`[data-piece="${want}"]`);
        if (pieceEl) slot.appendChild(pieceEl);
      }
    }
  
    function resetToTray() {
      resetPlacement();
      const allPieceEls = Array.from(document.querySelectorAll(".vp-piece"));
      allPieceEls.forEach(el => trayEl.appendChild(el));
      setMeta();
    }
  
    function computeAccuracy() {
      const targetSlots = TARGET.filter(Boolean).length;
      let correct = 0;
      for (let i = 0; i < TARGET.length; i++) {
        if (!TARGET[i]) continue;
        if (placed[i] === TARGET[i]) correct += 1;
      }
      const accuracy = targetSlots ? (correct / targetSlots) : 0;
      return { accuracy, correct, targetSlots };
    }
  
    function finish() {
      if (!running) return;
  
      running = false;
      locked = true;
      submitBtn.disabled = true;
  
      if (timeoutId) clearTimeout(timeoutId);
  
      const elapsed = Math.round(performance.now() - startTime);
      recomputeMistakes();
      const { accuracy, correct, targetSlots } = computeAccuracy();
  
      // Score 0..3 based mostly on accuracy
      let score = 0;
      if (accuracy >= 0.90) score = 3;
      else if (accuracy >= 0.65) score = 2;
      else if (accuracy >= 0.35) score = 1;
  
      // Optional: discourage random placements
      if (mistakes >= 5 && score > 0) score -= 1;
  
      // Optional: very slow penalty
      if (elapsed > 55000 && score > 0) score -= 1;
  
      setProgress(`Score: ${score} / 3`);
      setStatus(`You placed ${correct}/${targetSlots} correctly. Saving...`);
  
      fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "visual_puzzle",
          domain: "Visuospatial",
          value: score,
          elapsed_ms: elapsed,
          moves,
          mistakes_current: mistakes,
          accuracy,
          correct,
          target_slots: targetSlots
        })
      }).then(() => {
        setStatus("Saved. Redirecting to dashboard...");
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 800);
      }).catch(() => {
        setStatus("Could not save score. Please try again.");
        startBtn.disabled = false;
        locked = false;
      });
    }
  
    function start() {
      if (running) return;
  
      injectShapeCSSOnce();
      clearUI();
      resetPlacement();
  
      // Build slots
      for (let i = 0; i < GRID * GRID; i++) {
        boardEl.appendChild(makeSlot(i));
      }
  
      // Build pieces into tray (shuffled)
      const pieceOrder = shuffle(PIECES);
      pieceOrder.forEach(p => trayEl.appendChild(makePiece(p)));
  
      // New random target each run
      TARGET = generateTarget();
  
      // Reset metrics
      moves = 0;
      mistakes = 0;
      setMeta();
  
      startBtn.disabled = true;
      submitBtn.disabled = true;
  
      locked = true;
      running = true;
  
      setProgress("Memorize");
      setStatus("Memorize the puzzle layout…");
  
      // Preview solved pattern
      renderPreviewSolved();
  
      // After preview, clear board and start play
      setTimeout(() => {
        resetToTray();
        locked = false;
        submitBtn.disabled = false;
  
        setProgress("Build");
        setStatus("Rebuild the puzzle. Press Submit when you are done.");
  
        startTime = performance.now();
  
        if (MAX_TIME_MS && Number.isFinite(MAX_TIME_MS)) {
          timeoutId = setTimeout(() => {
            finish();
          }, MAX_TIME_MS);
        }
      }, DISPLAY_MS);
    }
  
    // Tray can accept drops to “unplace” pieces
    trayEl.addEventListener("dragover", (e) => {
      if (!running || locked) return;
      e.preventDefault();
    });
  
    trayEl.addEventListener("drop", (e) => {
      if (!running || locked) return;
      e.preventDefault();
  
      const pieceId = e.dataTransfer.getData("text/plain");
      if (!pieceId) return;
  
      const pieceEl = document.querySelector(`[data-piece="${pieceId}"]`);
      if (!pieceEl) return;
  
      removePieceFromAllSlots(pieceId);
      trayEl.appendChild(pieceEl);
  
      moves += 1;
      setMeta(); // mistakes update (often decreases if they removed wrong piece)
    });
  
    startBtn.addEventListener("click", start);
    submitBtn.addEventListener("click", () => {
      if (!running || locked) return;
      finish();
    });
  
    setProgress("Ready");
  })();
  