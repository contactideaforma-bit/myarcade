(function () {
  "use strict";
  if (!window.ARCADE) return;

  window.ARCADE.register({
    id: "tictactoe",
    title: "Morpion",
    emoji: "❎",
    mount: function (board, api) {
      var EMPTY = 0, HUMAN = 1, AI = 2;
      var C = api.colors;

      // ---- niveaux d'IA ----
      var LEVELS = [
        { label: "😊 Facile" },   // ~50% de coups aléatoires
        { label: "🙂 Moyen" },    // minimax profondeur 2
        { label: "🤖 Parfait" }   // minimax complet
      ];
      var level = 1; // démarre en Moyen

      var b;            // board array length 9
      var busy;         // AI thinking / game over
      var over;
      var timers = [];
      var listeners = [];
      var wins = 0, losses = 0, draws = 0;
      var nextHumanFirst = true; // qui commence : alterne à chaque manche

      // ---- tally persisté (best effort) ----
      var TALLY_KEY = "arc_ttt_tally";
      try {
        var t0 = JSON.parse(localStorage.getItem(TALLY_KEY) || "null");
        if (t0) { wins = +t0.w || 0; losses = +t0.l || 0; draws = +t0.d || 0; }
      } catch (e) {}
      function saveTally() {
        try {
          localStorage.setItem(TALLY_KEY, JSON.stringify({ w: wins, l: losses, d: draws }));
        } catch (e) {}
      }

      var wrap = document.createElement("div");
      wrap.style.cssText =
        "position:relative;width:100%;height:100%;display:flex;" +
        "align-items:center;justify-content:center;box-sizing:border-box;";
      board.appendChild(wrap);

      var panelEl = null;
      var cellEls = [];
      var levelBtns = [];

      var LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];

      function on(target, type, fn) {
        target.addEventListener(type, fn);
        listeners.push([target, type, fn]);
      }
      function later(fn, ms) {
        var t = setTimeout(function () {
          var i = timers.indexOf(t);
          if (i >= 0) timers.splice(i, 1);
          fn();
        }, ms);
        timers.push(t);
        return t;
      }
      function clearTimers() {
        for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
        timers = [];
      }

      function updateStatus(extra) {
        var stat = "Score " + wins + "-" + losses + "-" + draws;
        api.setStatus((extra ? extra + " · " : "") + stat);
      }

      function paintLevelBtns() {
        for (var i = 0; i < levelBtns.length; i++) {
          var sel = i === level;
          levelBtns[i].style.background = sel ? C.sun : C.paper;
          levelBtns[i].style.boxShadow = sel ? "2px 2px 0 " + C.ink : "none";
          levelBtns[i].style.opacity = sel ? "1" : "0.75";
        }
      }

      function build() {
        wrap.innerHTML = "";
        panelEl = null;
        cellEls = [];
        levelBtns = [];

        var W = board.clientWidth || api.W || 360;
        var H = board.clientHeight || api.H || 560;
        var side = Math.min(W - 30, H - 90, 340);
        var gap = Math.floor(side * 0.04);
        var cell = Math.floor((side - gap * 2) / 3);

        var col = document.createElement("div");
        col.style.cssText =
          "display:flex;flex-direction:column;align-items:center;gap:14px;";
        wrap.appendChild(col);

        // ---- sélecteur de niveau ----
        var lvlRow = document.createElement("div");
        lvlRow.style.cssText = "display:flex;gap:8px;";
        col.appendChild(lvlRow);
        for (var li = 0; li < LEVELS.length; li++) {
          (function (idx) {
            var lb = document.createElement("div");
            lb.textContent = LEVELS[idx].label;
            lb.style.cssText =
              "cursor:pointer;border:3px solid " + C.ink +
              ";border-radius:12px;padding:7px 10px;font-size:14px;" +
              "font-weight:800;color:" + C.ink + ";user-select:none;" +
              "background:" + C.paper + ";";
            on(lb, "pointerdown", function (e) {
              e.preventDefault();
              if (level === idx) return;
              level = idx;
              paintLevelBtns();
              api.beep && api.beep(600, 0.05, "sine", 0.15);
            });
            levelBtns.push(lb);
            lvlRow.appendChild(lb);
          })(li);
        }
        paintLevelBtns();

        var plate = document.createElement("div");
        plate.style.cssText =
          "display:grid;grid-template-columns:repeat(3," + cell +
          "px);grid-template-rows:repeat(3," + cell + "px);gap:" + gap +
          "px;background:" + C.turq + ";border:3px solid " + C.ink +
          ";border-radius:18px;box-shadow:3px 3px 0 " + C.ink +
          ";padding:" + gap + "px;box-sizing:content-box;";
        col.appendChild(plate);

        for (var i = 0; i < 9; i++) {
          (function (idx) {
            var cEl = document.createElement("div");
            cEl.style.cssText =
              "width:" + cell + "px;height:" + cell +
              "px;display:flex;align-items:center;justify-content:center;" +
              "font-size:" + Math.floor(cell * 0.6) + "px;font-weight:800;" +
              "background:" + C.paper + ";border:3px solid " + C.ink +
              ";border-radius:12px;box-sizing:border-box;cursor:pointer;" +
              "user-select:none;line-height:1;";
            on(cEl, "pointerdown", function (e) {
              e.preventDefault();
              playHuman(idx);
            });
            cellEls[idx] = cEl;
            plate.appendChild(cEl);
          })(i);
        }
      }

      function paint(highlight) {
        var hl = highlight || [];
        for (var i = 0; i < 9; i++) {
          var el = cellEls[i];
          el.textContent = b[i] === HUMAN ? "❌" : b[i] === AI ? "⭕" : "";
          var isHl = hl.indexOf(i) >= 0;
          if (isHl) {
            el.style.background = C.sun;
            el.style.borderColor = C.grape;
            el.style.borderWidth = "4px";
          } else {
            el.style.background = C.paper;
            el.style.borderColor = C.ink;
            el.style.borderWidth = "3px";
          }
        }
      }

      function winnerLine(arr) {
        for (var i = 0; i < LINES.length; i++) {
          var L = LINES[i];
          if (arr[L[0]] !== EMPTY && arr[L[0]] === arr[L[1]] && arr[L[1]] === arr[L[2]]) {
            return { player: arr[L[0]], line: L };
          }
        }
        return null;
      }
      function isFull(arr) {
        for (var i = 0; i < 9; i++) if (arr[i] === EMPTY) return false;
        return true;
      }

      // minimax: AI maximizes. score +10 (AI win) - depth, -10 (human win) + depth
      // maxDepth limite la vision (niveau Moyen) ; au-delà → évaluation neutre.
      function minimax(arr, turn, depth, maxDepth) {
        var w = winnerLine(arr);
        if (w) {
          return w.player === AI ? 10 - depth : depth - 10;
        }
        if (isFull(arr)) return 0;
        if (depth >= maxDepth) return 0;

        var best;
        if (turn === AI) {
          best = -Infinity;
          for (var i = 0; i < 9; i++) {
            if (arr[i] === EMPTY) {
              arr[i] = AI;
              var s = minimax(arr, HUMAN, depth + 1, maxDepth);
              arr[i] = EMPTY;
              if (s > best) best = s;
            }
          }
        } else {
          best = Infinity;
          for (var j = 0; j < 9; j++) {
            if (arr[j] === EMPTY) {
              arr[j] = HUMAN;
              var s2 = minimax(arr, AI, depth + 1, maxDepth);
              arr[j] = EMPTY;
              if (s2 < best) best = s2;
            }
          }
        }
        return best;
      }

      function bestMove(maxDepth) {
        var bestScore = -Infinity, moves = [];
        for (var i = 0; i < 9; i++) {
          if (b[i] === EMPTY) {
            b[i] = AI;
            var s = minimax(b, HUMAN, 1, maxDepth);
            b[i] = EMPTY;
            if (s > bestScore) { bestScore = s; moves = [i]; }
            else if (s === bestScore) moves.push(i);
          }
        }
        if (moves.length === 0) return -1;
        return moves[api.rand(moves.length)];
      }

      function chooseAI() {
        var empt = [];
        for (var i = 0; i < 9; i++) if (b[i] === EMPTY) empt.push(i);
        if (empt.length === 0) return -1;
        if (level === 0 && Math.random() < 0.5) {
          return empt[api.rand(empt.length)]; // Facile : coup aléatoire ~50%
        }
        var maxDepth = level === 1 ? 2 : 99; // Moyen : profondeur 2, Parfait : complet
        return bestMove(maxDepth);
      }

      function playHuman(idx) {
        if (busy || over) return;
        if (b[idx] !== EMPTY) { api.soundBad && api.soundBad(); return; }
        b[idx] = HUMAN;
        api.beep && api.beep(500, 0.06, "square", 0.2);
        paint();
        if (checkEnd()) return;
        busy = true;
        updateStatus("Ordi ⭕…");
        later(function () { aiTurn(); }, 350);
      }

      function aiTurn() {
        if (over) return;
        var idx = chooseAI();
        if (idx < 0) { busy = false; endGame("draw", null); return; }
        b[idx] = AI;
        api.beep && api.beep(320, 0.07, "sawtooth", 0.2);
        paint();
        if (checkEnd()) return;
        busy = false;
        updateStatus("À toi ❌");
      }

      // returns true if game ended
      function checkEnd() {
        var w = winnerLine(b);
        if (w) {
          endGame(w.player === HUMAN ? "win" : "lose", w.line);
          return true;
        }
        if (isFull(b)) {
          endGame("draw", null);
          return true;
        }
        return false;
      }

      function endGame(result, line) {
        over = true;
        busy = true;
        paint(line);

        var title, sub, color;
        if (result === "win") {
          wins++;
          title = "Tu gagnes !";
          sub = "❌ aligne 3";
          color = C.lime;
          api.soundWin && api.soundWin();
          api.confetti && api.confetti();
        } else if (result === "lose") {
          losses++;
          title = "L'ordi gagne";
          sub = "⭕ aligne 3";
          color = C.coral;
          api.soundBad && api.soundBad();
        } else {
          draws++;
          title = "Match nul";
          sub = "Grille pleine";
          color = C.sun;
        }
        saveTally();
        updateStatus(title);
        showPanel(title, sub, color);
      }

      function showPanel(title, sub, color) {
        var p = document.createElement("div");
        p.style.cssText =
          "position:absolute;inset:0;background:#fff8ecdd;display:flex;" +
          "flex-direction:column;align-items:center;justify-content:center;" +
          "gap:16px;text-align:center;z-index:5;";
        var card = document.createElement("div");
        card.style.cssText =
          "background:" + color + ";border:3px solid " + C.ink +
          ";border-radius:18px;box-shadow:3px 3px 0 " + C.ink +
          ";padding:22px 30px;display:flex;flex-direction:column;" +
          "align-items:center;gap:6px;";
        var h = document.createElement("div");
        h.textContent = title;
        h.style.cssText = "font-size:30px;font-weight:800;color:" + C.ink + ";";
        var s = document.createElement("div");
        s.textContent = sub;
        s.style.cssText = "font-size:16px;color:" + C.ink + ";";
        card.appendChild(h);
        card.appendChild(s);

        var btn = document.createElement("div");
        btn.textContent = "Rejouer";
        btn.style.cssText =
          "cursor:pointer;background:" + C.turq + ";border:3px solid " + C.ink +
          ";border-radius:14px;box-shadow:3px 3px 0 " + C.ink +
          ";padding:12px 26px;font-size:20px;font-weight:800;color:" + C.ink +
          ";user-select:none;";
        on(btn, "pointerdown", function (e) {
          e.preventDefault();
          reset();
        });

        p.appendChild(card);
        p.appendChild(btn);
        wrap.appendChild(p);
        panelEl = p;
      }

      function reset() {
        clearTimers();
        if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
        panelEl = null;
        b = [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
        busy = false;
        over = false;
        build();
        paint();
        var humanFirst = nextHumanFirst;
        nextHumanFirst = !nextHumanFirst; // alterne qui commence
        if (humanFirst) {
          updateStatus("À toi ❌");
        } else {
          busy = true;
          updateStatus("Ordi ⭕ commence…");
          later(function () { aiTurn(); }, 500);
        }
      }

      api.onExit(function () {
        clearTimers();
        for (var i = 0; i < listeners.length; i++) {
          listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2]);
        }
        listeners = [];
        wrap.innerHTML = "";
      });

      reset();
    }
  });
})();
