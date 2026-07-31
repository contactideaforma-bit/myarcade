(function () {
  "use strict";

  window.ARCADE.register({
    id: "g2048",
    title: "2048",
    emoji: "🔢",
    mount(board, api) {
      const C = api.colors;

      // ---- state ----
      const N = 4;
      const ANIM_MS = 130; // durée de glissement des tuiles
      let grid = [];       // N x N de tuiles {v, r, c, el, merged} ou null
      let score = 0;
      let bestStored = api.getBest("g2048") || 0;
      let won = false;     // 2048 atteint au moins une fois
      let goal = 2048;     // objectif courant (4096 après 2048, etc.)
      let dead = false;
      let locked = false;  // vrai pendant l'animation d'un coup
      const timers = [];
      let undoSnap = null; // 1 coup d'annulation

      // ---- color per value ----
      const valColors = {
        2: C.paper, 4: C.sun, 8: C.tang, 16: C.coral, 32: C.bubble,
        64: C.grape, 128: C.sky, 256: C.turq, 512: C.lime,
        1024: C.sun, 2048: C.coral, 4096: C.grape
      };
      function tileBg(v) { return valColors[v] || C.grape; }
      function tileInk(v) { return v <= 4 ? C.ink : "#fff8ec"; }

      // ---- layout ----
      const W = board.clientWidth || api.W || 360;
      const H = board.clientHeight || api.H || 560;
      const size = Math.min(W - 24, H - 90, 380);
      const pad = 10;
      const cell = Math.floor((size - pad * (N + 1)) / N);
      const boardPx = pad * (N + 1) + cell * N;

      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:relative;display:flex;flex-direction:column;gap:12px;" +
        "align-items:center;justify-content:center;width:100%;height:100%;";
      board.appendChild(wrap);

      // barre de contrôle : bouton annuler
      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;gap:10px;align-items:center;";
      wrap.appendChild(controls);

      const undoBtn = document.createElement("button");
      undoBtn.textContent = "↩ annuler";
      undoBtn.style.cssText =
        "font:inherit;font-size:16px;font-weight:800;color:" + C.ink + ";" +
        "padding:8px 16px;background:" + C.bubble + ";" +
        "border:3px solid " + C.ink + ";border-radius:12px;" +
        "box-shadow:3px 3px 0 " + C.ink + ";";
      controls.appendChild(undoBtn);

      function setUndoEnabled(on) {
        undoBtn.disabled = !on;
        undoBtn.style.opacity = on ? "1" : "0.45";
        undoBtn.style.cursor = on ? "pointer" : "default";
      }
      undoBtn.addEventListener("click", doUndo);

      const gridEl = document.createElement("div");
      gridEl.style.cssText =
        "position:relative;width:" + boardPx + "px;height:" + boardPx + "px;" +
        "background:" + C.turq + ";border:3px solid " + C.ink + ";" +
        "box-shadow:3px 3px 0 " + C.ink + ";border-radius:18px;" +
        "touch-action:none;user-select:none;";
      wrap.appendChild(gridEl);

      // background cells
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const bgc = document.createElement("div");
          bgc.style.cssText =
            "position:absolute;width:" + cell + "px;height:" + cell + "px;" +
            "left:" + (pad + c * (cell + pad)) + "px;top:" + (pad + r * (cell + pad)) + "px;" +
            "background:#ffffff55;border-radius:12px;";
          gridEl.appendChild(bgc);
        }
      }

      const tileLayer = document.createElement("div");
      tileLayer.style.cssText = "position:absolute;inset:0;";
      gridEl.appendChild(tileLayer);

      // overlay for end panel
      let overlay = null;

      function cssPos(r, c) {
        return {
          left: pad + c * (cell + pad),
          top: pad + r * (cell + pad)
        };
      }

      // Crée l'élément DOM d'une tuile (avec transition left/top pour les
      // vraies translations — le coeur du plaisir du 2048).
      function tileDom(v, r, c, pop) {
        const p = cssPos(r, c);
        const t = document.createElement("div");
        const fs = v < 100 ? 30 : v < 1000 ? 24 : 20;
        t.textContent = v;
        t.style.cssText =
          "position:absolute;width:" + cell + "px;height:" + cell + "px;" +
          "left:" + p.left + "px;top:" + p.top + "px;" +
          "display:flex;align-items:center;justify-content:center;" +
          "background:" + tileBg(v) + ";color:" + tileInk(v) + ";" +
          "font-weight:700;font-size:" + fs + "px;" +
          "border:3px solid " + C.ink + ";border-radius:12px;" +
          "box-shadow:2px 2px 0 " + C.ink + ";" +
          "transition:left " + ANIM_MS + "ms ease,top " + ANIM_MS + "ms ease;" +
          (pop ? "animation:g2048pop .14s ease;" : "");
        tileLayer.appendChild(t);
        return t;
      }

      function newTile(v, r, c, pop) {
        return { v: v, r: r, c: c, merged: false, el: tileDom(v, r, c, pop) };
      }

      function slideTo(t) {
        const p = cssPos(t.r, t.c);
        t.el.style.left = p.left + "px";
        t.el.style.top = p.top + "px";
      }

      function valueAt(r, c) {
        const t = grid[r][c];
        return t ? t.v : 0;
      }

      function snapshotValues() {
        const out = [];
        for (let r = 0; r < N; r++) {
          const row = [];
          for (let c = 0; c < N; c++) row.push(valueAt(r, c));
          out.push(row);
        }
        return out;
      }

      // Reconstruit tout depuis une grille de valeurs (undo, restart)
      function buildFromVals(vals) {
        timers.forEach(function (t) { clearTimeout(t); });
        timers.length = 0;
        tileLayer.innerHTML = "";
        grid = emptyGrid();
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++)
            if (vals[r][c]) grid[r][c] = newTile(vals[r][c], r, c, false);
        locked = false;
      }

      function updateStatus() {
        const b = Math.max(bestStored, score);
        api.setStatus(
          "Score <b>" + score + "</b> · Best <b>" + b + "</b>" +
          (won ? " · 🎯 " + goal : "")
        );
      }

      // ---- game logic ----
      function emptyGrid() {
        const g = [];
        for (let r = 0; r < N; r++) g.push([null, null, null, null]);
        return g;
      }

      function addRandom(pop) {
        const empties = [];
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++)
            if (!grid[r][c]) empties.push([r, c]);
        if (!empties.length) return;
        const spot = empties[api.rand(empties.length)];
        const v = api.rand(10) === 0 ? 4 : 2;
        grid[spot[0]][spot[1]] = newTile(v, spot[0], spot[1], pop !== false);
      }

      // cases d'une ligne, ordonnées depuis le bord de destination
      function lineCells(dir, i) {
        const cells = [];
        for (let k = 0; k < N; k++) {
          if (dir === "left") cells.push([i, k]);
          else if (dir === "right") cells.push([i, N - 1 - k]);
          else if (dir === "up") cells.push([k, i]);
          else cells.push([N - 1 - k, i]);
        }
        return cells;
      }

      function maxVal() {
        let m = 0;
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++)
            if (valueAt(r, c) > m) m = valueAt(r, c);
        return m;
      }

      function isDead() {
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++) {
            const v = valueAt(r, c);
            if (!v) return false;
            if (c + 1 < N && v === valueAt(r, c + 1)) return false;
            if (r + 1 < N && v === valueAt(r + 1, c)) return false;
          }
        return true;
      }

      function move(dir) {
        if (dead || locked) return;

        const preVals = snapshotValues();
        const preScore = score;
        const preWon = won;
        const preGoal = goal;

        // reset des marqueurs de fusion
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++)
            if (grid[r][c]) grid[r][c].merged = false;

        const newGrid = emptyGrid();
        const merges = []; // {keep, drop}
        let moved = false;
        let gainedTotal = 0;

        for (let i = 0; i < N; i++) {
          const cells = lineCells(dir, i);
          const tiles = [];
          cells.forEach(function (rc) {
            const t = grid[rc[0]][rc[1]];
            if (t) tiles.push(t);
          });

          let slot = 0;
          let prev = null;
          tiles.forEach(function (t) {
            if (prev && prev.v === t.v && !prev.merged) {
              // fusion : t glisse sur la case de prev
              prev.merged = true;
              prev.v = t.v * 2; // données à jour immédiatement
              gainedTotal += prev.v;
              t.r = prev.r;
              t.c = prev.c;
              merges.push({ keep: prev, drop: t });
              moved = true;
            } else {
              const rc = cells[slot];
              if (t.r !== rc[0] || t.c !== rc[1]) moved = true;
              t.r = rc[0];
              t.c = rc[1];
              newGrid[rc[0]][rc[1]] = t;
              prev = t;
              slot++;
            }
          });
        }

        if (!moved) return;

        // sauvegarde pour « ↩ annuler » (1 coup)
        undoSnap = { vals: preVals, score: preScore, won: preWon, goal: preGoal };
        setUndoEnabled(true);

        grid = newGrid;
        locked = true;

        // animation : toutes les tuiles glissent vers leur nouvelle case
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++)
            if (grid[r][c]) slideTo(grid[r][c]);
        merges.forEach(function (m) { slideTo(m.drop); });

        if (gainedTotal > 0) {
          score += gainedTotal;
          api.beep(520, 0.05, "sine", 0.25);
        }

        addRandom(true);

        // fin d'animation : matérialise les fusions (pop) et libère l'entrée
        const tm = setTimeout(function () {
          merges.forEach(function (m) {
            if (m.keep.el && m.keep.el.parentNode) m.keep.el.parentNode.removeChild(m.keep.el);
            if (m.drop.el && m.drop.el.parentNode) m.drop.el.parentNode.removeChild(m.drop.el);
            m.keep.el = tileDom(m.keep.v, m.keep.r, m.keep.c, true);
          });
          locked = false;
        }, ANIM_MS + 10);
        timers.push(tm);

        updateStatus();

        // objectif atteint (2048, puis 4096, 8192…) : on continue !
        if (maxVal() >= goal) {
          won = true;
          api.win();
          showBanner(goal + " ! 🎉 Objectif : " + goal * 2 + " 🎯");
          goal *= 2;
          updateStatus();
        }

        if (isDead()) {
          dead = true;
          api.soundBad();
          finishGame();
        }
      }

      function doUndo() {
        if (!undoSnap || dead || locked) return;
        score = undoSnap.score;
        won = undoSnap.won;
        goal = undoSnap.goal;
        buildFromVals(undoSnap.vals);
        undoSnap = null;
        setUndoEnabled(false);
        api.beep(300, 0.05, "sine", 0.2);
        updateStatus();
      }

      // transient banner
      function showBanner(txt) {
        const b = document.createElement("div");
        b.textContent = txt;
        b.style.cssText =
          "position:absolute;top:8px;left:50%;transform:translateX(-50%);" +
          "background:" + C.lime + ";color:" + C.ink + ";font-weight:700;" +
          "padding:8px 16px;border:3px solid " + C.ink + ";border-radius:14px;" +
          "box-shadow:3px 3px 0 " + C.ink + ";z-index:5;white-space:nowrap;";
        wrap.appendChild(b);
        const tm = setTimeout(function () {
          if (b.parentNode) b.parentNode.removeChild(b);
        }, 1800);
        timers.push(tm);
      }

      function finishGame() {
        // nouvelle signature : { best, isNew } — on fête un vrai record
        const res = api.setBest("g2048", score);
        bestStored = res.best;
        if (res.isNew) api.confetti();
        updateStatus();
        showEnd(res);
      }

      function showEnd(res) {
        overlay = document.createElement("div");
        overlay.style.cssText =
          "position:absolute;inset:0;background:#fff8ecdd;" +
          "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
          "gap:16px;z-index:10;border-radius:18px;";
        const msg = document.createElement("div");
        msg.innerHTML = "Perdu · score <b>" + score + "</b>";
        msg.style.cssText =
          "font-size:26px;font-weight:700;color:" + C.ink + ";text-align:center;";
        overlay.appendChild(msg);
        if (res && res.isNew) {
          const rec = document.createElement("div");
          rec.textContent = "🎉 Nouveau record !";
          rec.style.cssText = "font-size:18px;font-weight:700;color:" + C.ink + ";";
          overlay.appendChild(rec);
        }
        const btn = makeButton("Rejouer");
        btn.addEventListener("click", restart);
        overlay.appendChild(btn);
        wrap.appendChild(overlay);
      }

      function makeButton(label) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.cssText =
          "font:inherit;font-size:20px;font-weight:700;cursor:pointer;" +
          "padding:12px 28px;background:" + C.sun + ";color:" + C.ink + ";" +
          "border:3px solid " + C.ink + ";border-radius:16px;" +
          "box-shadow:3px 3px 0 " + C.ink + ";";
        return btn;
      }

      function restart() {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
        // on n'oublie pas un éventuel record de la partie abandonnée
        if (score > 0) {
          const res = api.setBest("g2048", score);
          bestStored = res.best;
        }
        startGame();
      }

      function startGame() {
        score = 0;
        won = false;
        goal = 2048;
        dead = false;
        undoSnap = null;
        setUndoEnabled(false);
        buildFromVals(emptyGrid().map(function (row) {
          return row.map(function () { return 0; });
        }));
        addRandom(true);
        addRandom(true);
        updateStatus();
      }

      // ---- input: keyboard ----
      function onKey(e) {
        let dir = null;
        if (e.key === "ArrowLeft") dir = "left";
        else if (e.key === "ArrowRight") dir = "right";
        else if (e.key === "ArrowUp") dir = "up";
        else if (e.key === "ArrowDown") dir = "down";
        if (dir) { e.preventDefault(); move(dir); }
      }
      window.addEventListener("keydown", onKey);

      // ---- input: swipe (pointer) ----
      let sx = 0, sy = 0, tracking = false;
      function onDown(e) {
        tracking = true;
        sx = e.clientX;
        sy = e.clientY;
        // capture : un drag relâché hors de la grille (desktop) reste suivi
        try { gridEl.setPointerCapture(e.pointerId); } catch (err) {}
      }
      function onUp(e) {
        if (!tracking) return;
        tracking = false;
        try { gridEl.releasePointerCapture(e.pointerId); } catch (err) {}
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        const TH = 24;
        if (adx < TH && ady < TH) return;
        if (adx > ady) move(dx > 0 ? "right" : "left");
        else move(dy > 0 ? "down" : "up");
      }
      gridEl.addEventListener("pointerdown", onDown);
      gridEl.addEventListener("pointerup", onUp);
      gridEl.addEventListener("pointercancel", function () { tracking = false; });

      // pop animation keyframes (scoped-ish)
      const styleEl = document.createElement("style");
      styleEl.textContent =
        "@keyframes g2048pop{0%{transform:scale(.6)}100%{transform:scale(1)}}";
      board.appendChild(styleEl);

      // ---- cleanup ----
      api.onExit(function () {
        window.removeEventListener("keydown", onKey);
        timers.forEach(function (t) { clearTimeout(t); });
        // sauvegarde silencieuse du score en cours comme record éventuel
        try { if (score > 0) api.setBest("g2048", score); } catch (e) {}
      });

      startGame();
    }
  });
})();
