/* Taupes — whack-a-mole for My Arcade
 * IIFE registering with window.ARCADE.register
 */
(function () {
  "use strict";

  window.ARCADE.register({
    id: "whack",
    title: "Taupes",
    emoji: "🔨",
    mount: function (board, api) {
      var C = api.colors;

      // ---- state ----
      var GAME_TIME = 30;    // seconds
      var FRENZY_AT = 3;     // frénésie finale : les 3 dernières secondes
      var timeLeft = GAME_TIME;
      var score = 0;
      var best = api.getBest("whack") || 0;

      var holes = [];        // { el, mole, up, isBomb, hideTimer }
      var timers = [];       // setTimeout ids to clear
      var tickId = null;     // setInterval for countdown
      var popId = null;      // setTimeout for next pop
      var running = false;
      var overlayEl = null;

      // ---- helpers ----
      function addTimeout(fn, ms) {
        var id = setTimeout(function () {
          // remove from list
          var i = timers.indexOf(id);
          if (i >= 0) timers.splice(i, 1);
          fn();
        }, ms);
        timers.push(id);
        return id;
      }

      function clearAllTimers() {
        for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
        timers = [];
        if (tickId !== null) { clearInterval(tickId); tickId = null; }
        if (popId !== null) { clearTimeout(popId); popId = null; }
      }

      function updateStatus() {
        var frenzy = running && timeLeft <= FRENZY_AT ? "⚡ " : "";
        api.setStatus(
          frenzy + "Score <b>" + score + "</b> · Temps <b>" + timeLeft + "s</b> · Record <b>" + best + "</b>"
        );
      }

      // ---- build UI ----
      function buildBoard() {
        board.innerHTML = "";
        board.style.display = "flex";
        board.style.alignItems = "center";
        board.style.justifyContent = "center";
        board.style.position = "relative";
        overlayEl = null;
        holes = [];

        var grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(3, 1fr)";
        grid.style.gridTemplateRows = "repeat(3, 1fr)";
        grid.style.gap = "14px";
        grid.style.width = "88%";
        grid.style.maxWidth = "340px";
        grid.style.aspectRatio = "1 / 1";
        grid.style.touchAction = "manipulation";

        for (var i = 0; i < 9; i++) {
          (function (idx) {
            var hole = document.createElement("div");
            hole.style.position = "relative";
            hole.style.width = "100%";
            hole.style.aspectRatio = "1 / 1";
            hole.style.borderRadius = "50%";
            hole.style.background = "#a9743b";
            hole.style.border = "3px solid " + C.ink;
            hole.style.boxShadow = "3px 3px 0 " + C.ink + ", inset 0 8px 0 #00000022";
            hole.style.overflow = "hidden";
            hole.style.display = "flex";
            hole.style.alignItems = "flex-end";
            hole.style.justifyContent = "center";
            hole.style.cursor = "pointer";
            hole.style.userSelect = "none";

            var mole = document.createElement("div");
            mole.textContent = "🐹";
            mole.style.fontSize = "clamp(24px, 12vw, 52px)";
            mole.style.lineHeight = "1";
            mole.style.transform = "translateY(120%)";
            mole.style.transition = "transform 120ms ease-out";
            mole.style.pointerEvents = "none";
            hole.appendChild(mole);

            var rec = { el: hole, mole: mole, up: false, isBomb: false, hideTimer: null };
            holes.push(rec);

            hole.addEventListener("pointerdown", function (e) {
              e.preventDefault();
              onHit(rec);
            });

            grid.appendChild(hole);
          })(i);
        }

        board.appendChild(grid);
      }

      // ---- gameplay ----
      function showMole(rec, visibleMs, isBomb) {
        rec.up = true;
        rec.isBomb = !!isBomb;
        rec.mole.textContent = isBomb ? "💣" : "🐹";
        rec.mole.style.transform = "translateY(0%)";
        rec.hideTimer = addTimeout(function () {
          rec.hideTimer = null;
          hideMole(rec);
        }, visibleMs);
      }

      function hideMole(rec) {
        rec.up = false;
        rec.mole.style.transform = "translateY(120%)";
      }

      function onHit(rec) {
        if (!running || !rec.up) return;
        rec.up = false;
        // le timer de disparition ne doit pas écraser l'animation du hit
        if (rec.hideTimer !== null) { clearTimeout(rec.hideTimer); rec.hideTimer = null; }

        if (rec.isBomb) {
          // 💣 fausse taupe : à ne pas taper !
          score = Math.max(0, score - 3);
          api.soundBad();
          rec.mole.textContent = "💥";
          rec.mole.style.transform = "translateY(0%) scale(1.2)";
          addTimeout(function () {
            rec.mole.style.transform = "translateY(120%)";
          }, 180);
        } else {
          score += 1;
          api.soundGood();
          // pop animation
          rec.mole.style.transform = "translateY(120%) scale(0.7)";
          addTimeout(function () {
            rec.mole.style.transform = "translateY(120%)";
          }, 130);
        }
        updateStatus();
      }

      function popOneMole() {
        // pick a hole that's currently down
        var down = [];
        for (var i = 0; i < holes.length; i++) {
          if (!holes[i].up) down.push(holes[i]);
        }
        if (!down.length) return;
        var elapsed = GAME_TIME - timeLeft;
        var frac = elapsed / GAME_TIME; // 0..1
        var rec = down[api.rand(down.length)];
        // visible window shrinks with time: 650..950 -> 420..620
        var vMin = 650 - 230 * frac;
        var vSpan = 300 - 130 * frac;
        var visible = Math.round(vMin) + api.rand(Math.max(1, Math.round(vSpan)) + 1);
        if (timeLeft <= FRENZY_AT) visible = 350 + api.rand(160); // frénésie : ultra court
        // la 💣 apparaît de plus en plus vers la fin
        var bombChance = 0.05 + 0.3 * frac; // 5% -> 35%
        var isBomb = Math.random() < bombChance;
        showMole(rec, visible, isBomb);
      }

      function scheduleNextPop() {
        // difficulty: faster from the start, ramps harder over the 30s
        var elapsed = GAME_TIME - timeLeft; // 0..30
        var frac = elapsed / GAME_TIME;     // 0..1
        var ramp = frac * frac;             // sharper acceleration
        var minGap = 520 - 340 * ramp;      // 520 -> 180
        var maxGap = 900 - 560 * ramp;      // 900 -> 340
        var gap = minGap + Math.random() * (maxGap - minGap);
        if (timeLeft <= FRENZY_AT) gap = 120 + Math.random() * 130; // frénésie finale

        popId = setTimeout(function () {
          popId = null;
          if (!running) return;
          popOneMole();
          // in the last third, sometimes send TWO moles at once
          if (frac > 0.66 && Math.random() < (frac - 0.66) * 1.6) {
            popOneMole();
          }
          // frénésie : une taupe de plus à chaque fois
          if (timeLeft <= FRENZY_AT) popOneMole();
          scheduleNextPop();
        }, gap);
      }

      function endGame() {
        running = false;
        clearAllTimers();
        for (var i = 0; i < holes.length; i++) { holes[i].hideTimer = null; hideMole(holes[i]); }

        var r = api.setBest("whack", score);
        best = r.best;
        var isNew = r.isNew && score > 0;
        updateStatus();
        api.soundWin();
        if (isNew) api.confetti();
        showOverlay(isNew);
      }

      function showOverlay(isNew) {
        overlayEl = document.createElement("div");
        overlayEl.style.position = "absolute";
        overlayEl.style.inset = "0";
        overlayEl.style.background = "#fff8ecdd";
        overlayEl.style.display = "flex";
        overlayEl.style.flexDirection = "column";
        overlayEl.style.alignItems = "center";
        overlayEl.style.justifyContent = "center";
        overlayEl.style.gap = "16px";
        overlayEl.style.padding = "20px";
        overlayEl.style.textAlign = "center";

        var title = document.createElement("div");
        title.textContent = "⏰ Temps écoulé !";
        title.style.fontSize = "clamp(22px, 8vw, 34px)";
        title.style.fontWeight = "bold";
        title.style.color = C.ink;

        var res = document.createElement("div");
        res.innerHTML = "Score <b>" + score + "</b> · Record <b>" + best + "</b>";
        res.style.fontSize = "clamp(16px, 5vw, 22px)";
        res.style.color = C.ink;

        overlayEl.appendChild(title);
        overlayEl.appendChild(res);

        if (isNew) {
          var rec = document.createElement("div");
          rec.textContent = "🎉 Nouveau record !";
          rec.style.fontSize = "clamp(16px, 5vw, 22px)";
          rec.style.fontWeight = "bold";
          rec.style.color = C.coral;
          overlayEl.appendChild(rec);
        }

        var btn = document.createElement("button");
        btn.textContent = "Rejouer";
        styleButton(btn, C.turq);
        btn.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          startGame();
        });

        overlayEl.appendChild(btn);
        board.appendChild(overlayEl);
      }

      function styleButton(btn, bg) {
        btn.style.fontFamily = "inherit";
        btn.style.fontSize = "clamp(16px, 5vw, 20px)";
        btn.style.fontWeight = "bold";
        btn.style.color = C.ink;
        btn.style.background = bg;
        btn.style.border = "3px solid " + C.ink;
        btn.style.borderRadius = "14px";
        btn.style.boxShadow = "3px 3px 0 " + C.ink;
        btn.style.padding = "12px 26px";
        btn.style.cursor = "pointer";
        btn.style.touchAction = "manipulation";
      }

      function startGame() {
        clearAllTimers();
        score = 0;
        timeLeft = GAME_TIME;
        running = true;
        buildBoard();
        updateStatus(); // affiche le record dès le départ

        tickId = setInterval(function () {
          timeLeft -= 1;
          if (timeLeft <= 0) {
            timeLeft = 0;
            updateStatus();
            endGame();
          } else {
            // décompte sonore des 3 dernières secondes (frénésie finale)
            if (timeLeft <= FRENZY_AT) {
              api.beep(660 + (FRENZY_AT - timeLeft) * 140, 0.09, "square", 0.18);
            }
            updateStatus();
          }
        }, 1000);

        scheduleNextPop();
      }

      // ---- cleanup ----
      api.onExit(function () {
        running = false;
        clearAllTimers();
      });

      // ---- go ----
      startGame();
    }
  });
})();
