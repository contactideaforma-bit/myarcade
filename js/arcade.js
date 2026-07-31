/* =========================================================
   My Arcade — HÔTE de mini-jeux
   Chaque jeu s'enregistre via ARCADE.register({...}) puis est
   lancé par une tuile du hub (data-game="id"). L'hôte gère un
   overlay plein écran, le bouton retour et le nettoyage.
   ========================================================= */
(function () {
  const registry = {};
  let exitFns = [];
  let current = null;
  let openSeq = 0; // jeton anti double-montage (double-tap sur une tuile)

  const el = (id) => document.getElementById(id);

  // Sons/effets réutilisés depuis game.js (fonctions globales)
  const safe = (fn) => (...a) => { try { return fn && fn(...a); } catch (e) {} };

  function makeApi() {
    const board = el("arBoard");
    return {
      board,
      // Dimensions utiles (le plateau occupe toute la zone dispo)
      get W() { return board.clientWidth; },
      get H() { return board.clientHeight; },
      setStatus: (html) => { const s = el("arStatus"); if (s) s.innerHTML = html; },
      onExit: (fn) => { if (typeof fn === "function") exitFns.push(fn); },
      // audio + haptique (hérités de game.js). Les sons "discrets" déclenchent
      // aussi une petite vibration → tous les jeux vibrent aux bons moments
      // sans code supplémentaire. api.vibrate(pattern) pour les cas précis.
      beep: safe(window.beep),
      vibrate: (p) => safe(window.vibrate)(p),
      soundGood: (...a) => { safe(window.soundGood)(...a); safe(window.vibrate)(12); },
      soundBad: (...a) => { safe(window.soundBad)(...a); safe(window.vibrate)([25, 40, 25]); },
      soundWin: (...a) => { safe(window.soundWin)(...a); safe(window.vibrate)([10, 30, 10, 30, 25]); },
      confetti: safe(window.launchConfetti),
      win: () => { safe(window.soundWin)(); safe(window.launchConfetti)(); safe(window.vibrate)([10, 30, 10, 30, 25]); },
      rand: (n) => Math.floor(Math.random() * n),
      shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
      // palette doodle (pour styles inline cohérents)
      colors: {
        ink: "#2b2440", paper: "#fff8ec",
        coral: "#ff6b6b", turq: "#3ec9c0", sun: "#ffd23e", grape: "#9b7ede",
        lime: "#8ed05a", bubble: "#ff9ec8", sky: "#57b6ef", tang: "#ff9f43",
      },
      // meilleur score par jeu (localStorage, best effort)
      getBest: (id) => { try { return +localStorage.getItem("arc_best_" + id) || 0; } catch (e) { return 0; } },
      // true si un record existe déjà (getBest retourne 0 dans les deux cas)
      hasBest: (id) => { try { return localStorage.getItem("arc_best_" + id) != null; } catch (e) { return false; } },
      // lower=true → « moins = mieux » (taquin, memory…). Retourne { best, isNew }.
      setBest: (id, v, lower) => {
        try {
          const raw = localStorage.getItem("arc_best_" + id);
          const b = raw == null ? null : (+raw || 0);
          const isNew = b == null || (lower ? v < b : v > b);
          if (isNew) localStorage.setItem("arc_best_" + id, String(v));
          return { best: isNew ? v : b, isNew };
        } catch (e) { return { best: v, isNew: false }; }
      },
    };
  }

  const ARCADE = {
    register(g) { if (g && g.id) registry[g.id] = g; },
    list() { return Object.keys(registry); },
    open(id) {
      const g = registry[id];
      if (!g) { console.warn("Jeu inconnu:", id); return; }
      // on ferme proprement un jeu déjà ouvert
      ARCADE._cleanup();
      el("home").hidden = true;
      const host = el("arcade");
      host.hidden = false;
      el("arTitle").textContent = (g.emoji ? g.emoji + " " : "") + g.title;
      el("arStatus").innerHTML = "";
      const board = el("arBoard");
      board.innerHTML = "";
      exitFns = [];
      current = g;
      // rAF pour que le plateau ait ses dimensions avant le montage.
      // Le jeton openSeq garantit qu'un seul montage survit (double-tap,
      // fermeture avant le rAF, réouverture rapide…).
      const myOpen = ++openSeq;
      requestAnimationFrame(() => {
        if (myOpen !== openSeq || current !== g) return;
        try { g.mount(board, makeApi()); }
        catch (e) { console.error("Erreur au montage de " + id, e); board.innerHTML = "<p style='padding:20px;font-family:Fredoka,sans-serif'>Oups, ce jeu n'a pas pu démarrer.</p>"; }
      });
    },
    _cleanup() {
      openSeq++; // annule tout montage encore en attente dans un rAF
      exitFns.forEach((fn) => { try { fn(); } catch (e) {} });
      exitFns = [];
      const board = el("arBoard"); if (board) board.innerHTML = "";
      current = null;
    },
    close() {
      ARCADE._cleanup();
      const host = el("arcade"); if (host) host.hidden = true;
      el("home").hidden = false;
    },
  };
  window.ARCADE = ARCADE;

  document.addEventListener("DOMContentLoaded", () => {
    const back = el("arBack");
    if (back) back.addEventListener("click", () => ARCADE.close());
    // Câble les tuiles de jeu du hub (data-game) — les 4 tuiles data-mode
    // restent gérées par game.js (moteur de tri).
    document.querySelectorAll(".tile[data-game]").forEach((t) => {
      t.addEventListener("click", () => ARCADE.open(t.dataset.game));
    });
  });
})();
