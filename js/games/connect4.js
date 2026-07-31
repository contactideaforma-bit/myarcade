(function () {
  "use strict";
  if (!window.ARCADE) return;

  window.ARCADE.register({
    id: "connect4",
    title: "Puissance 4",
    emoji: "🔴",
    mount: function (board, api) {
      var COLS = 7, ROWS = 6;
      var EMPTY = 0, HUMAN = 1, AI = 2;
      var C = api.colors;

      // ---- niveaux d'IA (profondeur de recherche) ----
      var LEVELS = [
        { label: "😊 Facile", depth: 1 },
        { label: "🙂 Moyen", depth: 3 },
        { label: "🤖 Fort", depth: 5 }
      ];
      var level = 1; // démarre en Moyen

      // ---- state ----
      var grid;            // grid[r][c], row 0 = top
      var busy;            // true when AI is thinking or game over
      var over;            // game finished
      var timers = [];     // active timeouts to clear on exit/replay
      var listeners = [];  // [target, type, fn]
      var wins = 0, losses = 0, draws = 0;

      // ---- tally persisté (best effort) ----
      var TALLY_KEY = "arc_c4_tally";
      try {
        var t0 = JSON.parse(localStorage.getItem(TALLY_KEY) || "null");
        if (t0) { wins = +t0.w || 0; losses = +t0.l || 0; draws = +t0.d || 0; }
      } catch (e) {}
      function saveTally() {
        try {
          localStorage.setItem(TALLY_KEY, JSON.stringify({ w: wins, l: losses, d: draws }));
        } catch (e) {}
      }

      // ---- root wrapper ----
      var wrap = document.createElement("div");
      wrap.style.cssText =
        "position:relative;width:100%;height:100%;display:flex;" +
        "align-items:center;justify-content:center;box-sizing:border-box;";
      board.appendChild(wrap);

      var panelEl = null;  // end-of-game overlay
      var cells = [];      // DOM disc elements cells[r][c]
      var headEls = [];    // column head buttons
      var levelBtns = [];
      var cellSize = 0;    // taille d'une case (pour l'animation de chute)
      var hoverCol = -1;   // colonne visée (surbrillance)

      function on(target, type, fn) {
        target.addEventListener(type, fn);
        listeners.push([target, type, fn]);
      }
      function later(fn, ms) {
        var t = setTimeout(function () {
          // remove from list
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

      // ---- board construction ----
      function build() {
        wrap.innerHTML = "";
        panelEl = null;
        cells = [];
        headEls = [];
        levelBtns = [];
        hoverCol = -1;

        var W = board.clientWidth || api.W || 360;
        var H = board.clientHeight || api.H || 560;

        // available area (leave margins)
        var availW = Math.min(W - 20, 360);
        var availH = H - 70; // place pour la rangée de niveaux
        // cell size so 7 cols x 6 rows fit
        var cell = Math.floor(Math.min(availW / COLS, availH / (ROWS + 1)));
        if (cell < 24) cell = 24;
        cellSize = cell;
        var pad = Math.max(4, Math.floor(cell * 0.12));
        var disc = cell - pad * 2;

        var container = document.createElement("div");
        container.style.cssText =
          "display:flex;flex-direction:column;align-items:center;gap:" +
          Math.floor(cell * 0.18) + "px;";
        wrap.appendChild(container);

        // ---- sélecteur de niveau ----
        var lvlRow = document.createElement("div");
        lvlRow.style.cssText = "display:flex;gap:8px;margin-bottom:2px;";
        container.appendChild(lvlRow);
        for (var li = 0; li < LEVELS.length; li++) {
          (function (idx) {
            var lb = document.createElement("div");
            lb.textContent = LEVELS[idx].label;
            lb.style.cssText =
              "cursor:pointer;border:3px solid " + C.ink +
              ";border-radius:12px;padding:6px 10px;font-size:13px;" +
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

        // ---- column head buttons ----
        var head = document.createElement("div");
        head.style.cssText =
          "display:flex;gap:" + pad + "px;padding:0 " +
          Math.floor(cell * 0.28) + "px;";
        container.appendChild(head);

        for (var c = 0; c < COLS; c++) {
          (function (col) {
            var b = document.createElement("div");
            b.textContent = "⬇";
            b.style.cssText =
              "width:" + cell + "px;height:" + Math.floor(cell * 0.7) +
              "px;display:flex;align-items:center;justify-content:center;" +
              "font-size:" + Math.floor(cell * 0.42) + "px;cursor:pointer;" +
              "background:" + C.sun + ";border:3px solid " + C.ink +
              ";border-radius:10px;box-shadow:3px 3px 0 " + C.ink +
              ";box-sizing:border-box;user-select:none;color:" + C.ink + ";";
            on(b, "pointerdown", function (e) {
              e.preventDefault();
              setHover(col);
              playHuman(col);
            });
            on(b, "pointerenter", function () { setHover(col); });
            on(b, "pointerleave", function () { clearHover(col); });
            headEls[col] = b;
            head.appendChild(b);
          })(c);
        }

        // ---- the blue board ----
        var plate = document.createElement("div");
        plate.style.cssText =
          "display:grid;grid-template-columns:repeat(" + COLS + "," + cell +
          "px);grid-template-rows:repeat(" + ROWS + "," + cell + "px);gap:0;" +
          "background:" + C.sky + ";border:3px solid " + C.ink +
          ";border-radius:16px;box-shadow:3px 3px 0 " + C.ink +
          ";padding:" + pad + "px;box-sizing:content-box;overflow:hidden;";
        container.appendChild(plate);

        for (var r = 0; r < ROWS; r++) {
          cells[r] = [];
          for (var cc = 0; cc < COLS; cc++) {
            (function (row, coln) {
              var slot = document.createElement("div");
              slot.style.cssText =
                "width:" + cell + "px;height:" + cell +
                "px;display:flex;align-items:center;justify-content:center;" +
                "box-sizing:border-box;cursor:pointer;";
              var d = document.createElement("div");
              d.style.cssText =
                "width:" + disc + "px;height:" + disc +
                "px;border-radius:50%;background:" + C.paper +
                ";border:3px solid " + C.ink + ";box-sizing:border-box;" +
                "transition:transform .08s;";
              slot.appendChild(d);
              cells[row][coln] = d;
              on(slot, "pointerdown", function (e) {
                e.preventDefault();
                setHover(coln);
                playHuman(coln);
              });
              on(slot, "pointerenter", function () { setHover(coln); });
              on(slot, "pointerleave", function () { clearHover(coln); });
              plate.appendChild(slot);
            })(r, cc);
          }
        }
      }

      // ---- surbrillance de la colonne visée ----
      function refreshHover() {
        var active = hoverCol >= 0 && !over && !busy;
        for (var c = 0; c < COLS; c++) {
          if (headEls[c]) {
            headEls[c].style.background = (active && c === hoverCol) ? C.tang : C.sun;
          }
        }
        for (var r = 0; r < ROWS; r++) {
          for (var c2 = 0; c2 < COLS; c2++) {
            if (grid && grid[r][c2] === EMPTY && cells[r] && cells[r][c2]) {
              cells[r][c2].style.background =
                (active && c2 === hoverCol) ? "#ffeab0" : C.paper;
            }
          }
        }
      }
      function setHover(col) {
        if (hoverCol === col) return;
        hoverCol = col;
        refreshHover();
      }
      function clearHover(col) {
        if (hoverCol !== col) return;
        hoverCol = -1;
        refreshHover();
      }

      // ---- animation de chute du jeton ----
      function animateDrop(r, c) {
        var d = cells[r] && cells[r][c];
        if (!d) return;
        var dist = (r + 1) * cellSize;
        d.style.transition = "none";
        d.style.transform = "translateY(-" + dist + "px)";
        // force reflow pour que la position de départ soit prise en compte
        void d.offsetWidth;
        d.style.transition = "transform .2s cubic-bezier(.45,0,1,1)";
        d.style.transform = "translateY(0)";
      }

      function paint(highlight) {
        var hl = highlight || [];
        for (var r = 0; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) {
            var v = grid[r][c];
            var d = cells[r][c];
            d.style.background = v === HUMAN ? C.coral : v === AI ? C.sun : C.paper;
            var isHl = false;
            for (var k = 0; k < hl.length; k++) {
              if (hl[k][0] === r && hl[k][1] === c) { isHl = true; break; }
            }
            if (isHl) {
              d.style.borderColor = C.grape;
              d.style.borderWidth = "4px";
              d.style.transform = "scale(1.12)";
              d.style.boxShadow = "0 0 0 3px " + C.grape;
            } else {
              d.style.borderColor = C.ink;
              d.style.borderWidth = "3px";
              d.style.transform = "scale(1)";
              d.style.boxShadow = "none";
            }
          }
        }
        refreshHover();
      }

      // ---- logic helpers ----
      function newGrid() {
        var g = [];
        for (var r = 0; r < ROWS; r++) {
          g[r] = [];
          for (var c = 0; c < COLS; c++) g[r][c] = EMPTY;
        }
        return g;
      }
      function dropRow(g, col) {
        for (var r = ROWS - 1; r >= 0; r--) {
          if (g[r][col] === EMPTY) return r;
        }
        return -1;
      }
      function validCols(g) {
        var out = [];
        for (var c = 0; c < COLS; c++) if (g[0][c] === EMPTY) out.push(c);
        return out;
      }
      function isFull(g) {
        return validCols(g).length === 0;
      }
      // returns winning cells array (4) for player if last move at r,c completes a line
      function winLineAt(g, r, c) {
        var p = g[r][c];
        if (p === EMPTY) return null;
        var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (var d = 0; d < dirs.length; d++) {
          var dr = dirs[d][0], dc = dirs[d][1];
          var line = [[r, c]];
          var rr, ccc;
          // forward
          rr = r + dr; ccc = c + dc;
          while (rr >= 0 && rr < ROWS && ccc >= 0 && ccc < COLS && g[rr][ccc] === p) {
            line.push([rr, ccc]); rr += dr; ccc += dc;
          }
          // backward
          rr = r - dr; ccc = c - dc;
          while (rr >= 0 && rr < ROWS && ccc >= 0 && ccc < COLS && g[rr][ccc] === p) {
            line.unshift([rr, ccc]); rr -= dr; ccc -= dc;
          }
          if (line.length >= 4) return line.slice(0, 4);
        }
        return null;
      }
      // would dropping player in col win? returns win line or null
      function winsWith(g, col, player) {
        var r = dropRow(g, col);
        if (r < 0) return null;
        g[r][col] = player;
        var line = winLineAt(g, r, col);
        g[r][col] = EMPTY;
        return line;
      }

      // ---- AI: alpha-beta minimax ----
      var CENTER = (COLS - 1) / 2;
      var WIN_SCORE = 1000000;
      // column search order: centre first (better alpha-beta pruning)
      var COL_ORDER = (function () {
        var arr = [];
        for (var c = 0; c < COLS; c++) arr.push(c);
        arr.sort(function (a, bb) {
          return Math.abs(a - CENTER) - Math.abs(bb - CENTER);
        });
        return arr;
      })();

      // score a 4-cell window from AI's perspective
      function scoreWindow(a, bb, cc, dd) {
        var ai = 0, hu = 0;
        if (a === AI) ai++; else if (a === HUMAN) hu++;
        if (bb === AI) ai++; else if (bb === HUMAN) hu++;
        if (cc === AI) ai++; else if (cc === HUMAN) hu++;
        if (dd === AI) ai++; else if (dd === HUMAN) hu++;
        if (ai > 0 && hu > 0) return 0;           // mixed window, dead
        if (ai === 3) return 100;
        if (ai === 2) return 10;
        if (ai === 1) return 1;
        if (hu === 3) return -120;                 // block threats a touch harder
        if (hu === 2) return -10;
        if (hu === 1) return -1;
        return 0;
      }

      // heuristic evaluation of a non-terminal position (AI perspective)
      function evaluate(g) {
        var score = 0, r, c;
        // centre column control
        for (r = 0; r < ROWS; r++) {
          if (g[r][3] === AI) score += 6;
          else if (g[r][3] === HUMAN) score -= 6;
        }
        // horizontal
        for (r = 0; r < ROWS; r++)
          for (c = 0; c <= COLS - 4; c++)
            score += scoreWindow(g[r][c], g[r][c + 1], g[r][c + 2], g[r][c + 3]);
        // vertical
        for (c = 0; c < COLS; c++)
          for (r = 0; r <= ROWS - 4; r++)
            score += scoreWindow(g[r][c], g[r + 1][c], g[r + 2][c], g[r + 3][c]);
        // diagonal down-right
        for (r = 0; r <= ROWS - 4; r++)
          for (c = 0; c <= COLS - 4; c++)
            score += scoreWindow(g[r][c], g[r + 1][c + 1], g[r + 2][c + 2], g[r + 3][c + 3]);
        // diagonal up-right
        for (r = 3; r < ROWS; r++)
          for (c = 0; c <= COLS - 4; c++)
            score += scoreWindow(g[r][c], g[r - 1][c + 1], g[r - 2][c + 2], g[r - 3][c + 3]);
        return score;
      }

      // minimax with alpha-beta pruning.
      // lastR/lastC = the move that produced this position (cheap win test).
      function minimax(g, depth, alpha, beta, maximizing, lastR, lastC) {
        // terminal: did the previous move complete a 4?
        if (lastR >= 0 && winLineAt(g, lastR, lastC)) {
          // player who just moved is the opposite of `maximizing`
          if (maximizing) return -WIN_SCORE - depth;   // HUMAN just won
          return WIN_SCORE + depth;                     // AI just won (prefer sooner)
        }
        if (validCols(g).length === 0) return 0;        // draw
        if (depth === 0) return evaluate(g);

        var i, col, r;
        if (maximizing) {
          var mx = -Infinity;
          for (i = 0; i < COL_ORDER.length; i++) {
            col = COL_ORDER[i];
            if (g[0][col] !== EMPTY) continue;
            r = dropRow(g, col);
            g[r][col] = AI;
            var s1 = minimax(g, depth - 1, alpha, beta, false, r, col);
            g[r][col] = EMPTY;
            if (s1 > mx) mx = s1;
            if (mx > alpha) alpha = mx;
            if (alpha >= beta) break;
          }
          return mx;
        } else {
          var mn = Infinity;
          for (i = 0; i < COL_ORDER.length; i++) {
            col = COL_ORDER[i];
            if (g[0][col] !== EMPTY) continue;
            r = dropRow(g, col);
            g[r][col] = HUMAN;
            var s2 = minimax(g, depth - 1, alpha, beta, true, r, col);
            g[r][col] = EMPTY;
            if (s2 < mn) mn = s2;
            if (mn < beta) beta = mn;
            if (alpha >= beta) break;
          }
          return mn;
        }
      }

      function chooseAI() {
        var depth = LEVELS[level].depth;
        var opts = validCols(grid);
        if (opts.length === 0) return -1;
        // 1) immediate winning move
        for (var i = 0; i < opts.length; i++) {
          if (winsWith(grid, opts[i], AI)) return opts[i];
        }
        // 2) block an immediate human win
        for (var j = 0; j < opts.length; j++) {
          if (winsWith(grid, opts[j], HUMAN)) return opts[j];
        }
        // 3) alpha-beta search (also avoids gifting a win next turn)
        var bestScore = -Infinity, best = [];
        for (var k = 0; k < COL_ORDER.length; k++) {
          var col = COL_ORDER[k];
          if (grid[0][col] !== EMPTY) continue;
          var r = dropRow(grid, col);
          grid[r][col] = AI;
          var score = minimax(grid, depth - 1, -Infinity, Infinity, false, r, col);
          grid[r][col] = EMPTY;
          if (score > bestScore) { bestScore = score; best = [col]; }
          else if (score === bestScore) best.push(col);
        }
        if (best.length === 0) return opts[api.rand(opts.length)];
        return best[api.rand(best.length)];
      }

      // ---- moves ----
      function placeToken(col, player) {
        var r = dropRow(grid, col);
        if (r < 0) return -1;
        grid[r][col] = player;
        return r;
      }

      function playHuman(col) {
        if (busy || over) return;
        if (grid[0][col] !== EMPTY) { api.soundBad && api.soundBad(); return; }
        var r = placeToken(col, HUMAN);
        if (r < 0) return;
        api.beep && api.beep(440, 0.06, "square", 0.2);
        paint();
        animateDrop(r, col);
        var line = winLineAt(grid, r, col);
        if (line) {
          busy = true;
          later(function () { endGame("win", line); }, 230);
          return;
        }
        if (isFull(grid)) {
          busy = true;
          later(function () { endGame("draw", null); }, 230);
          return;
        }
        // AI turn
        busy = true;
        updateStatus("Ordi 🟡…");
        later(function () {
          aiTurn();
        }, 450);
      }

      function aiTurn() {
        if (over) return;
        var col = chooseAI();
        if (col < 0) { busy = false; endGame("draw", null); return; }
        var r = placeToken(col, AI);
        api.beep && api.beep(300, 0.07, "sawtooth", 0.2);
        paint();
        animateDrop(r, col);
        var line = winLineAt(grid, r, col);
        if (line) {
          later(function () { endGame("lose", line); }, 230);
          return;
        }
        if (isFull(grid)) {
          later(function () { endGame("draw", null); }, 230);
          return;
        }
        busy = false;
        updateStatus("À toi 🔴");
        refreshHover();
      }

      // ---- end game ----
      function endGame(result, line) {
        over = true;
        busy = true;
        paint(line);

        var title, sub, color;
        if (result === "win") {
          wins++;
          title = "Gagné !";
          sub = "🔴 aligne 4 !";
          color = C.lime;
          api.win && api.win();
          api.confetti && api.confetti();
        } else if (result === "lose") {
          losses++;
          title = "Perdu";
          sub = "🟡 a gagné";
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

      // ---- reset / start ----
      function reset() {
        clearTimers();
        if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
        panelEl = null;
        grid = newGrid();
        busy = false;
        over = false;
        build();
        paint();
        updateStatus("À toi 🔴");
      }

      // ---- exit cleanup ----
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
