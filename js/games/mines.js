(function () {
  "use strict";

  window.ARCADE.register({
    id: "mines",
    title: "Démineur",
    emoji: "💣",
    mount: function (board, api) {
      var C = api.colors;
      var N = 9; // grille 9x9
      var MINES = 15;
      var LONG_PRESS_MS = 450;

      var numColors = {
        1: C.sky,
        2: C.lime,
        3: C.coral,
        4: C.grape,
        5: C.tang,
        6: C.turq,
        7: C.ink,
        8: C.bubble
      };

      var W = board.clientWidth || api.W || 360;
      var H = board.clientHeight || api.H || 560;

      // Etat des cellules
      var mine = [];     // bool
      var revealed = [];
      var flagged = [];
      var adj = [];      // nombre de mines adjacentes
      var placed = false; // mines posées après 1er clic
      var over = false;
      var flagMode = false;
      var flagsCount = 0;

      // Chrono (démarre au 1er coup)
      var startTime = 0;
      var endTime = 0;
      var clockId = 0;

      function elapsedSec() {
        if (!startTime) return 0;
        var end = endTime || Date.now();
        return Math.floor((end - startTime) / 1000);
      }
      function fmtTime(s) {
        var m = Math.floor(s / 60);
        var r = s % 60;
        return m + ":" + (r < 10 ? "0" : "") + r;
      }

      var wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      wrap.style.justifyContent = "center";
      wrap.style.gap = "10px";
      wrap.style.position = "relative";
      wrap.style.width = "100%";
      wrap.style.height = "100%";
      board.appendChild(wrap);

      // Bouton bascule de mode (secours au long-press)
      var modeBtn = document.createElement("button");
      modeBtn.style.padding = "8px 16px";
      modeBtn.style.fontSize = "16px";
      modeBtn.style.fontWeight = "800";
      modeBtn.style.color = C.ink;
      modeBtn.style.border = "3px solid " + C.ink;
      modeBtn.style.borderRadius = "12px";
      modeBtn.style.boxShadow = "3px 3px 0 " + C.ink;
      modeBtn.style.cursor = "pointer";
      modeBtn.style.font = "inherit";
      modeBtn.style.fontWeight = "800";
      wrap.appendChild(modeBtn);

      function refreshModeBtn() {
        if (flagMode) {
          modeBtn.textContent = "Mode: Drapeau 🚩";
          modeBtn.style.background = C.bubble;
        } else {
          modeBtn.textContent = "Mode: Révéler ⛏️";
          modeBtn.style.background = C.turq;
        }
      }
      modeBtn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        flagMode = !flagMode;
        refreshModeBtn();
      });

      // Grille carrée calculée depuis la largeur
      var boardSize = Math.min(W - 20, H - 150);
      if (boardSize < 200) boardSize = 200;
      var gap = 2;
      var cell = Math.floor((boardSize - gap * (N + 1)) / N);
      boardSize = cell * N + gap * (N + 1);

      var grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(" + N + ", " + cell + "px)";
      grid.style.gridTemplateRows = "repeat(" + N + ", " + cell + "px)";
      grid.style.gap = gap + "px";
      grid.style.padding = gap + "px";
      grid.style.background = C.ink;
      grid.style.border = "3px solid " + C.ink;
      grid.style.borderRadius = "14px";
      grid.style.boxShadow = "3px 3px 0 " + C.ink;
      grid.style.boxSizing = "border-box";
      grid.style.touchAction = "none";
      wrap.appendChild(grid);
      grid.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });

      // Petit rappel du geste
      var hint = document.createElement("div");
      hint.textContent = "Tap = révéler · Appui long = 🚩";
      hint.style.fontSize = "13px";
      hint.style.fontWeight = "700";
      hint.style.color = C.ink;
      hint.style.opacity = "0.65";
      wrap.appendChild(hint);

      var cellEls = [];

      function idx(r, c) {
        return r * N + c;
      }

      function neighbors(i) {
        var r = Math.floor(i / N), c = i % N;
        var out = [];
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            var nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < N && nc >= 0 && nc < N) {
              out.push(idx(nr, nc));
            }
          }
        }
        return out;
      }

      function initArrays() {
        mine = [];
        revealed = [];
        flagged = [];
        adj = [];
        for (var i = 0; i < N * N; i++) {
          mine.push(false);
          revealed.push(false);
          flagged.push(false);
          adj.push(0);
        }
      }

      function placeMines(safe) {
        // exclut la case cliquée et ses voisines
        var excluded = {};
        excluded[safe] = true;
        neighbors(safe).forEach(function (n) {
          excluded[n] = true;
        });
        var candidates = [];
        for (var i = 0; i < N * N; i++) {
          if (!excluded[i]) candidates.push(i);
        }
        api.shuffle(candidates);
        for (var k = 0; k < MINES && k < candidates.length; k++) {
          mine[candidates[k]] = true;
        }
        // calcul adjacence
        for (var j = 0; j < N * N; j++) {
          if (mine[j]) continue;
          var cnt = 0;
          neighbors(j).forEach(function (n) {
            if (mine[n]) cnt++;
          });
          adj[j] = cnt;
        }
        placed = true;
        if (!startTime) startTime = Date.now();
      }

      function styleBaseCell(el) {
        el.style.width = cell + "px";
        el.style.height = cell + "px";
        el.style.boxSizing = "border-box";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.fontSize = Math.floor(cell * 0.5) + "px";
        el.style.fontWeight = "900";
        el.style.cursor = "pointer";
        el.style.userSelect = "none";
        el.style.borderRadius = "5px";
      }

      // --- Gestion tap court / appui long -------------------------------
      // Tap court = révéler (ou drapeau si mode drapeau), appui long ~450ms
      // = poser/enlever un drapeau avec une petite vibration. Un déplacement
      // du doigt annule (pour ne pas confondre avec un scroll).
      var lpTimer = null;
      var lpFired = false;
      var pressCell = -1;
      var pressX = 0, pressY = 0;

      function clearLp() {
        if (lpTimer != null) {
          clearTimeout(lpTimer);
          lpTimer = null;
        }
      }

      function cellDown(i, ev) {
        if (ev.button != null && ev.button !== 0) return; // clic droit → contextmenu
        ev.preventDefault();
        if (over) return;
        clearLp();
        pressCell = i;
        lpFired = false;
        pressX = ev.clientX;
        pressY = ev.clientY;
        lpTimer = setTimeout(function () {
          lpTimer = null;
          lpFired = true;
          if (!over) {
            toggleFlag(i);
            api.vibrate(30);
          }
        }, LONG_PRESS_MS);
      }

      function cellMove(ev) {
        if (lpTimer == null) return;
        if (Math.abs(ev.clientX - pressX) > 12 || Math.abs(ev.clientY - pressY) > 12) {
          clearLp();
          pressCell = -1;
        }
      }

      function cellUp(i, ev) {
        ev.preventDefault();
        if (lpTimer != null) {
          clearLp();
          if (!lpFired && pressCell === i && !over) tapCell(i);
        }
        pressCell = -1;
      }

      function cellCancel() {
        clearLp();
        pressCell = -1;
      }

      function makeGrid() {
        grid.innerHTML = "";
        cellEls = [];
        for (var i = 0; i < N * N; i++) {
          var el = document.createElement("div");
          styleBaseCell(el);
          (function (id, e) {
            e.addEventListener("pointerdown", function (ev) { cellDown(id, ev); });
            e.addEventListener("pointermove", cellMove);
            e.addEventListener("pointerup", function (ev) { cellUp(id, ev); });
            e.addEventListener("pointercancel", cellCancel);
            e.addEventListener("pointerleave", cellCancel);
            e.addEventListener("contextmenu", function (ev) {
              // clic droit desktop = drapeau
              ev.preventDefault();
              if (!over) toggleFlag(id);
            });
          })(i, el);
          cellEls.push(el);
          grid.appendChild(el);
        }
      }

      function paintCell(i) {
        var el = cellEls[i];
        if (revealed[i]) {
          if (mine[i]) {
            el.style.background = C.coral;
            el.textContent = "💣";
            el.style.color = C.ink;
          } else {
            el.style.background = C.paper;
            if (adj[i] > 0) {
              el.textContent = String(adj[i]);
              el.style.color = numColors[adj[i]] || C.ink;
            } else {
              el.textContent = "";
            }
          }
        } else if (flagged[i]) {
          el.style.background = C.sun;
          el.textContent = "🚩";
        } else {
          el.style.background = C.grape;
          el.textContent = "";
        }
      }

      function paintAll() {
        for (var i = 0; i < N * N; i++) paintCell(i);
      }

      function floodReveal(start) {
        var stack = [start];
        while (stack.length) {
          var i = stack.pop();
          if (revealed[i] || flagged[i]) continue;
          revealed[i] = true;
          if (adj[i] === 0 && !mine[i]) {
            neighbors(i).forEach(function (n) {
              if (!revealed[n] && !mine[n]) stack.push(n);
            });
          }
        }
      }

      function countNonMineRevealed() {
        var c = 0;
        for (var i = 0; i < N * N; i++) {
          if (revealed[i] && !mine[i]) c++;
        }
        return c;
      }

      function checkWin() {
        return countNonMineRevealed() === N * N - MINES;
      }

      function revealAllMines() {
        for (var i = 0; i < N * N; i++) {
          if (mine[i]) revealed[i] = true;
        }
      }

      function updateStatus() {
        var left = MINES - flagsCount;
        var b = api.hasBest("mines")
          ? " · Best " + fmtTime(api.getBest("mines"))
          : "";
        api.setStatus(
          "💣 restantes: <b>" + left + "</b> · ⏱ " + fmtTime(elapsedSec()) + b
        );
      }

      function toggleFlag(i) {
        if (over || revealed[i]) return;
        flagged[i] = !flagged[i];
        flagsCount += flagged[i] ? 1 : -1;
        paintCell(i);
        updateStatus();
        api.beep(360, 0.04, "square", 0.2);
      }

      function tapCell(i) {
        if (flagMode) {
          toggleFlag(i);
          return;
        }
        revealCell(i);
      }

      function revealCell(i) {
        if (over) return;
        if (flagged[i] || revealed[i]) return;
        if (!placed) placeMines(i);
        if (mine[i]) {
          // défaite
          revealed[i] = true;
          revealAllMines();
          paintAll();
          over = true;
          endTime = Date.now();
          api.soundBad();
          showPanel("Perdu 💥", "Boum !", "");
          return;
        }
        floodReveal(i);
        paintAll();
        api.beep(600, 0.04, "sine", 0.22);
        updateStatus();
        if (checkWin()) {
          over = true;
          endTime = Date.now();
          var secs = elapsedSec();
          // moins de secondes = mieux
          var res = api.setBest("mines", secs, true);
          api.win();
          if (res.isNew) api.confetti();
          showPanel(
            "Gagné !",
            "Champ déminé en " + fmtTime(secs) + " 🎉",
            res.isNew ? "🎉 Nouveau record !" : "Meilleur temps : " + fmtTime(res.best)
          );
          updateStatus();
        }
      }

      var panelEl = null;
      function showPanel(title, sub, extra) {
        if (panelEl) panelEl.remove();
        panelEl = document.createElement("div");
        panelEl.style.position = "absolute";
        panelEl.style.inset = "0";
        panelEl.style.background = "#fff8ecdd";
        panelEl.style.display = "flex";
        panelEl.style.flexDirection = "column";
        panelEl.style.alignItems = "center";
        panelEl.style.justifyContent = "center";
        panelEl.style.gap = "12px";
        panelEl.style.zIndex = "10";
        panelEl.style.borderRadius = "16px";

        var h = document.createElement("div");
        h.textContent = title;
        h.style.fontSize = "34px";
        h.style.fontWeight = "900";
        h.style.color = C.ink;
        panelEl.appendChild(h);

        var s = document.createElement("div");
        s.textContent = sub;
        s.style.fontSize = "20px";
        s.style.fontWeight = "700";
        s.style.color = C.ink;
        panelEl.appendChild(s);

        if (extra) {
          var e = document.createElement("div");
          e.textContent = extra;
          e.style.fontSize = "16px";
          e.style.color = C.ink;
          panelEl.appendChild(e);
        }

        var btn = document.createElement("button");
        btn.textContent = "Rejouer";
        btn.style.marginTop = "8px";
        btn.style.padding = "12px 22px";
        btn.style.fontSize = "18px";
        btn.style.color = C.ink;
        btn.style.background = C.sun;
        btn.style.border = "3px solid " + C.ink;
        btn.style.borderRadius = "12px";
        btn.style.boxShadow = "3px 3px 0 " + C.ink;
        btn.style.cursor = "pointer";
        btn.style.font = "inherit";
        btn.style.fontWeight = "800";
        btn.addEventListener("pointerdown", function (ev) {
          ev.preventDefault();
          startGame();
        });
        panelEl.appendChild(btn);

        wrap.appendChild(panelEl);
      }

      function startGame() {
        if (panelEl) {
          panelEl.remove();
          panelEl = null;
        }
        clearLp();
        pressCell = -1;
        over = false;
        placed = false;
        flagMode = false;
        flagsCount = 0;
        startTime = 0;
        endTime = 0;
        initArrays();
        makeGrid();
        paintAll();
        refreshModeBtn();
        updateStatus();
      }

      startGame();

      // tick du chrono
      clockId = setInterval(function () {
        if (startTime && !over) updateStatus();
      }, 500);

      api.onExit(function () {
        clearInterval(clockId);
        clearLp();
      });
    }
  });
})();
