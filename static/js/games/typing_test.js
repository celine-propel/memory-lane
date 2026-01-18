let targetText = ""; // Will be fetched from backend
const display = document.getElementById("text-display");
const input = document.getElementById("typing-input");
const overlay = document.getElementById("start-overlay");

let startTime, timer;
let mistakes = 0;
let isStarted = false;
let isFinished = false;
let lastCorrectChars = 0;
let lastTypedLength = 0;

// Fetch random text from LLM backend
async function fetchTargetText() {
  try {
    const response = await fetch("/api/typing-text");
    const data = await response.json();
    targetText = data.text;
    setupDisplay();
  } catch (error) {
    console.error("Failed to fetch text:", error);
    // Fallback text
    targetText =
      "Neuroplasticity is the ability of the brain to form and reorganize synaptic connections, especially in response to learning or experience or following injury.";
    setupDisplay();
  }
}

// Setup the display with character spans
function setupDisplay() {
  display.innerHTML = targetText
    .split("")
    .map((char) => `<span class="char">${char}</span>`)
    .join("");
}

// Start the test when user types
function startTest() {
  overlay.style.opacity = "0";
  setTimeout(() => (overlay.style.display = "none"), 500);
  input.focus();
  startTime = new Date();
  isStarted = true;
}

// Main input event listener
input.addEventListener("input", () => {
  if (isFinished) return;
  if (!isStarted) startTest();

  const charSpans = display.querySelectorAll(".char");
  const inputValue = input.value.split("");

  // Track mistakes for accuracy calculation
  let correctChars = 0;

  charSpans.forEach((span, index) => {
    const char = inputValue[index];
    if (char == null) {
      // Untyped character
      span.classList.remove("char-correct", "char-incorrect", "char-current");
      if (index === inputValue.length) span.classList.add("char-current");
    } else if (char === span.innerText) {
      // Correct character
      span.classList.add("char-correct");
      span.classList.remove("char-incorrect", "char-current");
      correctChars++;
    } else {
      // Incorrect character
      span.classList.add("char-incorrect");
      span.classList.remove("char-correct", "char-current");
    }
  });

  lastCorrectChars = correctChars;
  lastTypedLength = inputValue.length;

  // Update Metrics
  updateMetrics(lastTypedLength, lastCorrectChars);

  // Check Completion - user must match entire target text
  if (inputValue.length >= targetText.length) {
    finishTest();
  }
});

// Update WPM and accuracy metrics
function updateMetrics(typedLength, correctChars) {
  const timeElapsed = (new Date() - startTime) / 60000; // in minutes

  // Calculate WPM (words per minute, based on 5 chars = 1 word)
  const wpm = Math.round(typedLength / 5 / timeElapsed) || 0;

  // Calculate accuracy percentage
  const accuracy =
    typedLength > 0 ? Math.round((correctChars / typedLength) * 100) : 100;

  // Update display
  document.getElementById("wpm").innerText = wpm;
  document.getElementById("accuracy").innerText = accuracy + "%";

  // Update progress bar
  const progress = (typedLength / targetText.length) * 100;
  document.getElementById("progress-bar").style.width =
    Math.min(progress, 100) + "%";
}

// Finish the test and save score
async function finishTest() {
  if (isFinished) return;
  isFinished = true;
  input.disabled = true;
  const finalWpm = parseInt(document.getElementById("wpm").innerText);
  const finalAccuracy = parseInt(document.getElementById("accuracy").innerText);

  // Calculate combined score (WPM adjusted by accuracy)
  const adjustedScore = Math.round(finalWpm * (finalAccuracy / 100));

  // Save the score to backend with details
  await saveTypingScore("typing", "Attention", adjustedScore, {
    wpm: finalWpm,
    accuracy: finalAccuracy,
    adjustedScore: adjustedScore,
  });

  window.location.href = "/dashboard";
}

// Save typing score to backend
async function saveTypingScore(game, domain, score, details = {}) {
  try {
    const response = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: game,
        domain: domain,
        value: score,
        details: details,
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error("Failed to save score");
    }
  } catch (error) {
    console.error("Error saving score:", error);
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  fetchTargetText();
});

document.addEventListener("keydown", () => {
  if (!isStarted) startTest();
});
