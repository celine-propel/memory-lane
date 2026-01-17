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
  