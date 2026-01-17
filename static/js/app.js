async function demoSaveScore(game, domain) {
    // fake score for demo (0–100). Replace with real computed score later.
    const value = Math.round((Math.random() * 40 + 50) * 100) / 100;
  
    await fetch("/api/score", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ game, domain, value })
    });
  
    // send user to dashboard so they see it worked
    window.location.href = "/dashboard";
  }
  
  (function () {
    const btn = document.getElementById("avatarBtn");
    const menu = document.getElementById("profileMenu");
    if (!btn || !menu) return;
  
    function openMenu() {
      menu.classList.add("show");
      menu.setAttribute("aria-hidden", "false");
    }
    function closeMenu() {
      menu.classList.remove("show");
      menu.setAttribute("aria-hidden", "true");
    }
  
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu.classList.contains("show")) closeMenu();
      else openMenu();
    });
  
    // click outside closes
    menu.addEventListener("click", (e) => {
      if (e.target === menu) closeMenu();
    });
  
    // escape closes (desktop)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  })();
  