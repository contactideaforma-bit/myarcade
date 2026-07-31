/* Séquence — Simon memory game for My Arcade
 * IIFE registering with window.ARCADE.register
 */
(function () {
  "use strict";

  window.ARCADE.register({
    id: "simon",
    title: "Séquence",
    emoji: "🎵",
    mount: function (board, api) {
      var C = api.colors;

      // pad definitions: color + tone frequency
      var PADS = [
        { key: 0, color: C.coral, freq: 330 },
        { key: 1, color: C.turq, freq: 415 },
        { key: 2, color: C.sun, freq: 494 },
        { key: 3, color: C.grape, freq: 587 }
      ];

      var pads = [];         // DOM records { el }
      var seq = [];          // sequence of pad indices
      var inputIdx = 0;      // player's progress in reproducing
      var level = 0;         // current level (= seq length)
      var best = api.getBest("simon") || 0;
      var newRecord = false; // un vrai record battu pendant cette partie
      var relaxMode = false; // mode Relax : 1 réécoute de la séquence par partie
      var replayUsed = false;
      var acceptingInput = false;
      var timers = [];
      var overlayEl = null;
      var levelBanner = null;
      var relaxBtn = null;
      var replayBtn = null;

      function addTimeout(fn, ms) {
        var id = setTimeout(function () {
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
      }

      function updateStatus() {
        api.setStatus(
          "Niveau <b>" + level + "</b> · Record <b>" + best + "</b>"
        );
      }

      function setBanner(text) {
        if (!levelBanner) return;
        levelBanner.textContent = text;
        levelBanner.style.opacity = text ? "1" : "0";
      }

      // ---- UI ----
      function buildBoard() {
        board.innerHTML = "";
        board.style.display = "flex";
        board.style.flexDirection = "column";
        board.style.alignItems = "center";
        board.style.justifyContent = "center";
        board.style.gap = "14px";
        board.style.position = "relative";
        overlayEl = null;
        pads = [];

        // bandeau « Niveau N » entre les manches
        levelBanner = document.createElement("div");
        levelBanner.style.minHeight = "32px";
        levelBanner.style.fontSize = "clamp(18px, 6vw, 26px)";
        levelBanner.style.fontWeight = "bold";
        levelBanner.style.color = C.ink;
        levelBanner.style.opacity = "0";
        levelBanner.style.transition = "opacity 180ms ease";
        levelBanner.style.textAlign = "center";
        board.appendChild(levelBanner);

        var grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(2, 1fr)";
        grid.style.gridTemplateRows = "repeat(2, 1fr)";
        grid.style.gap = "16px";
        grid.style.width = "86%";
        grid.style.maxWidth = "330px";
        grid.style.aspectRatio = "1 / 1";
        grid.style.touchAction = "manipulation";

        for (var i = 0; i < PADS.length; i++) {
          (function (idx) {
            var pad = document.createElement("div");
            pad.style.width = "100%";
            pad.style.aspectRatio = "1 / 1";
            pad.style.background = PADS[idx].color;
            pad.style.border = "3px solid " + C.ink;
            pad.style.borderRadius = "18px";
            pad.style.boxShadow = "3px 3px 0 " + C.ink;
            pad.style.cursor = "pointer";
            pad.style.userSelect = "none";
            pad.style.opacity = "0.55";
            pad.style.transition = "opacity 90ms ease-out, transform 90ms ease-out";

            var rec = { el: pad };
            pads.push(rec);

            pad.addEventListener("pointerdown", function (e) {
              e.preventDefault();
              onPadPress(idx);
            });

            grid.appendChild(pad);
          })(i);
        }

        board.appendChild(grid);

        // petits contrôles : mode Relax + réécoute (1x par partie)
        var row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "10px";
        row.style.alignItems = "center";
        row.style.justifyContent = "center";
        row.style.minHeight = "44px";

        relaxBtn = document.createElement("button");
        styleSmallButton(relaxBtn, "#e8e2d4");
        relaxBtn.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          relaxMode = !relaxMode;
          refreshControls();
        });

        replayBtn = document.createElement("button");
        styleSmallButton(replayBtn, C.sky);
        replayBtn.textContent = "🔁 Réécouter";
        replayBtn.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          onReplay();
        });

        row.appendChild(relaxBtn);
        row.appendChild(replayBtn);
        board.appendChild(row);
        refreshControls();
      }

      function refreshControls() {
        if (!relaxBtn) return;
        relaxBtn.textContent = "😌 Relax : " + (relaxMode ? "ON" : "OFF");
        relaxBtn.style.background = relaxMode ? C.lime : "#e8e2d4";
        var canReplay = relaxMode && !replayUsed;
        replayBtn.style.visibility = canReplay ? "visible" : "hidden";
        replayBtn.style.opacity = acceptingInput ? "1" : "0.5";
      }

      function lightPad(idx, ms) {
        var rec = pads[idx];
        rec.el.style.opacity = "1";
        rec.el.style.transform = "scale(1.04)";
        api.beep(PADS[idx].freq, ms / 1000, "sine", 0.2);
        addTimeout(function () {
          rec.el.style.opacity = "0.55";
          rec.el.style.transform = "scale(1)";
        }, ms);
      }

      // ---- gameplay ----
      function nextRound() {
        acceptingInput = false;
        inputIdx = 0;
        seq.push(api.rand(PADS.length));
        level = seq.length;
        updateStatus();
        setBanner("Niveau " + level + " · regarde…");
        refreshControls();
        playSequence();
      }

      function playSequence() {
        var i = 0;
        // tempo speeds up as the level climbs (more memory tension)
        var step2 = Math.max(0, level - 1); // 0 at level 1
        var lightMs = Math.max(230, 500 - step2 * 28); // 500 -> 230
        var gapMs = Math.max(90, 250 - step2 * 18);    // 250 -> 90
        function step() {
          if (i >= seq.length) {
            // done, hand control to player
            acceptingInput = true;
            setBanner("Niveau " + level + " · à toi !");
            refreshControls();
            return;
          }
          lightPad(seq[i], lightMs);
          i++;
          addTimeout(step, lightMs + gapMs);
        }
        // small lead-in delay
        addTimeout(step, 500);
      }

      // mode Relax : réécoute la séquence une fois par partie
      function onReplay() {
        if (!relaxMode || replayUsed || !acceptingInput || !seq.length) return;
        replayUsed = true;
        acceptingInput = false;
        inputIdx = 0;
        refreshControls();
        setBanner("Niveau " + level + " · réécoute…");
        playSequence();
      }

      function saveBest(v) {
        if (v > best) {
          var r = api.setBest("simon", v);
          best = r.best;
          if (r.isNew) newRecord = true;
        }
      }

      function onPadPress(idx) {
        if (!acceptingInput) return;
        // visual + audio feedback
        lightPad(idx, 220);

        if (idx === seq[inputIdx]) {
          inputIdx++;
          if (inputIdx >= seq.length) {
            // completed this round correctly → le niveau L est validé
            acceptingInput = false;
            saveBest(level);
            updateStatus();
            api.soundGood();
            addTimeout(nextRound, 700);
          }
        } else {
          // wrong — le joueur n'a validé que le niveau précédent
          acceptingInput = false;
          api.soundBad();
          saveBest(Math.max(0, level - 1));
          updateStatus();
          addTimeout(showOverlay, 350);
        }
      }

      function showOverlay() {
        var achieved = Math.max(0, level - 1);

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
        title.textContent = "❌ Raté !";
        title.style.fontSize = "clamp(22px, 8vw, 34px)";
        title.style.fontWeight = "bold";
        title.style.color = C.ink;

        var res = document.createElement("div");
        res.innerHTML = "Niveau atteint <b>" + achieved + "</b> · Record <b>" + best + "</b>";
        res.style.fontSize = "clamp(16px, 5vw, 22px)";
        res.style.color = C.ink;

        overlayEl.appendChild(title);
        overlayEl.appendChild(res);

        if (newRecord && achieved > 0) {
          var rec = document.createElement("div");
          rec.textContent = "🎉 Nouveau record !";
          rec.style.fontSize = "clamp(16px, 5vw, 22px)";
          rec.style.fontWeight = "bold";
          rec.style.color = C.coral;
          overlayEl.appendChild(rec);
          api.confetti();
        }

        var btn = document.createElement("button");
        btn.textContent = "Rejouer";
        styleButton(btn, C.sun);
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

      function styleSmallButton(btn, bg) {
        btn.style.fontFamily = "inherit";
        btn.style.fontSize = "clamp(12px, 3.6vw, 15px)";
        btn.style.fontWeight = "bold";
        btn.style.color = C.ink;
        btn.style.background = bg;
        btn.style.border = "2px solid " + C.ink;
        btn.style.borderRadius = "12px";
        btn.style.boxShadow = "2px 2px 0 " + C.ink;
        btn.style.padding = "7px 12px";
        btn.style.cursor = "pointer";
        btn.style.touchAction = "manipulation";
      }

      function startGame() {
        clearAllTimers();
        seq = [];
        inputIdx = 0;
        level = 0;
        newRecord = false;
        replayUsed = false; // 1 réécoute par partie
        acceptingInput = false;
        buildBoard();
        updateStatus();
        addTimeout(nextRound, 600);
      }

      // ---- cleanup ----
      api.onExit(function () {
        acceptingInput = false;
        clearAllTimers();
      });

      // ---- go ----
      startGame();
    }
  });
})();
