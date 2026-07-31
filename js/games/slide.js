(function () {
  "use strict";

  window.ARCADE.register({
    id: "slide",
    title: "Taquin",
    emoji: "🖼️",
    mount: function (board, api) {
      var C = api.colors;
      var N = 4; // grille 4x4
      var TILES = N * N; // 16 (15 + vide)

      // Etat: tableau de 16 valeurs, 0 = case vide.
      var state = [];
      var moves = 0;
      var solved = false;

      // Chrono
      var startTime = 0;   // 0 = pas encore démarré (au 1er coup)
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

      // Dégradé de couleurs : la teinte suit l'ordre 1..15 pour guider
      // la reconstruction (chaud en haut à gauche → froid en bas à droite).
      function tileHue(v) {
        return Math.round(10 + ((v - 1) / 14) * 260);
      }

      // --- Layout ---
      var W = board.clientWidth || api.W || 360;
      var H = board.clientHeight || api.H || 560;

      var wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      wrap.style.justifyContent = "center";
      wrap.style.gap = "14px";
      wrap.style.position = "relative";
      wrap.style.width = "100%";
      wrap.style.height = "100%";
      board.appendChild(wrap);

      var header = document.createElement("div");
      header.style.fontWeight = "800";
      header.style.fontSize = "20px";
      header.style.color = C.ink;
      header.textContent = "Coups: 0 · ⏱ 0:00";
      wrap.appendChild(header);

      // taille du plateau: contraint par largeur et hauteur dispo
      var boardSize = Math.min(W - 24, H - 120);
      if (boardSize < 200) boardSize = 200;
      var gap = 6;
      var cell = Math.floor((boardSize - gap * (N + 1)) / N);
      boardSize = cell * N + gap * (N + 1);

      var grid = document.createElement("div");
      grid.style.position = "relative";
      grid.style.width = boardSize + "px";
      grid.style.height = boardSize + "px";
      grid.style.background = "#00000010";
      grid.style.border = "3px solid " + C.ink;
      grid.style.borderRadius = "16px";
      grid.style.boxShadow = "3px 3px 0 " + C.ink;
      grid.style.boxSizing = "border-box";
      grid.style.touchAction = "manipulation";
      wrap.appendChild(grid);

      // pos -> pixel (col,row)
      function px(pos) {
        var r = Math.floor(pos / N);
        var c = pos % N;
        return {
          x: gap + c * (cell + gap),
          y: gap + r * (cell + gap)
        };
      }

      // Elements de tuiles (un par valeur 1..15)
      var tileEls = {}; // value -> element

      function makeTiles() {
        grid.innerHTML = "";
        tileEls = {};
        for (var v = 1; v <= 15; v++) {
          var t = document.createElement("div");
          t.style.position = "absolute";
          t.style.width = cell + "px";
          t.style.height = cell + "px";
          t.style.boxSizing = "border-box";
          t.style.display = "flex";
          t.style.alignItems = "center";
          t.style.justifyContent = "center";
          t.style.fontSize = Math.floor(cell * 0.42) + "px";
          t.style.fontWeight = "900";
          t.style.color = C.ink;
          t.style.border = "3px solid " + C.ink;
          t.style.borderRadius = "12px";
          t.style.boxShadow = "3px 3px 0 " + C.ink;
          t.style.cursor = "pointer";
          t.style.userSelect = "none";
          t.style.transition = "left 0.12s ease, top 0.12s ease";
          var hue = tileHue(v);
          t.style.background =
            "linear-gradient(135deg, hsl(" + hue + ",85%,74%), hsl(" + hue + ",80%,60%))";
          t.textContent = String(v);
          (function (val, el) {
            el.addEventListener("pointerdown", function (e) {
              e.preventDefault();
              onTap(val);
            });
          })(v, t);
          tileEls[v] = t;
          grid.appendChild(t);
        }
      }

      function render() {
        for (var pos = 0; pos < TILES; pos++) {
          var v = state[pos];
          if (v === 0) continue;
          var p = px(pos);
          var el = tileEls[v];
          el.style.left = p.x + "px";
          el.style.top = p.y + "px";
        }
        header.textContent = "Coups: " + moves + " · ⏱ " + fmtTime(elapsedSec());
      }

      function emptyPos() {
        return state.indexOf(0);
      }

      function neighborsOf(pos) {
        var r = Math.floor(pos / N), c = pos % N;
        var list = [];
        if (r > 0) list.push(pos - N);
        if (r < N - 1) list.push(pos + N);
        if (c > 0) list.push(pos - 1);
        if (c < N - 1) list.push(pos + 1);
        return list;
      }

      function checkSolved() {
        for (var i = 0; i < 15; i++) {
          if (state[i] !== i + 1) return false;
        }
        return state[15] === 0;
      }

      function idx(r, c) { return r * N + c; }

      // Tap sur une tuile : si elle partage la rangée ou la colonne du trou,
      // toutes les tuiles entre elle et le trou glissent d'une case (standard
      // du 15-puzzle, bien plus confortable au doigt).
      function onTap(val) {
        if (solved) return;
        var pos = state.indexOf(val);
        var ep = emptyPos();
        var r = Math.floor(pos / N), c = pos % N;
        var er = Math.floor(ep / N), ec = ep % N;

        if (r === er) {
          var stepC = c < ec ? 1 : -1; // direction tuile -> trou
          for (var cc = ec; cc !== c; cc -= stepC) {
            state[idx(r, cc)] = state[idx(r, cc - stepC)];
          }
          state[pos] = 0;
        } else if (c === ec) {
          var stepR = r < er ? 1 : -1;
          for (var rr = er; rr !== r; rr -= stepR) {
            state[idx(rr, c)] = state[idx(rr - stepR, c)];
          }
          state[pos] = 0;
        } else {
          return; // ni même rangée ni même colonne
        }

        moves++;
        if (!startTime) startTime = Date.now();
        api.beep(520, 0.05, "sine", 0.25);
        render();
        updateStatus();
        if (checkSolved()) {
          solved = true;
          finishWin();
        }
      }

      function finishWin() {
        endTime = Date.now();
        api.win();
        var res = api.setBest("slide", moves, true);
        if (res.isNew) api.confetti();
        showPanel(
          "Résolu !",
          moves + " coups · ⏱ " + fmtTime(elapsedSec()),
          res.isNew ? "🎉 Nouveau record !" : "Meilleur : " + res.best + " coups"
        );
        updateStatus();
      }

      function updateStatus() {
        var b = api.hasBest("slide")
          ? " · Best <b>" + api.getBest("slide") + "</b>"
          : "";
        api.setStatus(
          "Coups: <b>" + moves + "</b> · ⏱ " + fmtTime(elapsedSec()) + b
        );
      }

      // --- Mélange solvable: mouvements légaux depuis l'état résolu ---
      function shuffleSolvable() {
        state = [];
        for (var i = 1; i <= 15; i++) state.push(i);
        state.push(0);
        var last = -1;
        for (var k = 0; k < 200; k++) {
          var ep = emptyPos();
          var nb = neighborsOf(ep).filter(function (p) {
            return p !== last;
          });
          var pick = nb[api.rand(nb.length)];
          state[ep] = state[pick];
          state[pick] = 0;
          last = ep;
        }
        // éviter un plateau déjà résolu
        if (checkSolved()) {
          shuffleSolvable();
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
        h.style.fontSize = "32px";
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
        btn.style.fontWeight = "800";
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
        solved = false;
        moves = 0;
        startTime = 0;
        endTime = 0;
        shuffleSolvable();
        render();
        updateStatus();
      }

      makeTiles();
      startGame();

      // tick du chrono (header + statut)
      clockId = setInterval(function () {
        if (solved || !startTime) return;
        header.textContent = "Coups: " + moves + " · ⏱ " + fmtTime(elapsedSec());
        updateStatus();
      }, 500);

      api.onExit(function () {
        clearInterval(clockId);
      });
    }
  });
})();
