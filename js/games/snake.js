(function () {
  "use strict";
  if (!window.ARCADE || !window.ARCADE.register) return;

  window.ARCADE.register({
    id: "snake",
    title: "Serpent",
    emoji: "🐍",
    mount: function (board, api) {
      // ---- Dimensions & canvas ----
      var dpr = window.devicePixelRatio || 1;
      var W, H;

      var canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.touchAction = "none";
      board.appendChild(canvas);
      var ctx = canvas.getContext("2d");

      var C = api.colors;

      // ---- Grille ----
      var nbCols = 18;
      var cell, gridW, gridH, offX, offY;

      function sizeCanvas() {
        W = api.W || board.clientWidth || 360;
        H = api.H || board.clientHeight || 560;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cell = Math.max(8, Math.floor(W / nbCols));
        gridW = Math.floor(W / cell);
        gridH = Math.floor(H / cell);
        offX = Math.floor((W - gridW * cell) / 2);
        offY = Math.floor((H - gridH * cell) / 2);
      }
      sizeCanvas();

      // ---- Etat ----
      var snake, dir, dirQueue, food, special, score, best, alive, growPending;
      var stepMs, acc, lastT, rafId, replayBtn, shakeT, endInfo;

      best = api.getBest("snake") || 0;

      function reset() {
        var cx = Math.floor(gridW / 2);
        var cy = Math.floor(gridH / 2);
        snake = [
          { x: cx, y: cy },
          { x: cx - 1, y: cy },
          { x: cx - 2, y: cy }
        ];
        dir = { x: 1, y: 0 };
        dirQueue = [];
        score = 0;
        growPending = 0;
        alive = true;
        stepMs = 110;
        acc = 0;
        special = null;
        shakeT = 0;
        endInfo = null;
        placeFood();
        removeReplay();
        updateStatus();
        startLoop();
      }

      function freeCells(extraBusy) {
        var free = [];
        for (var x = 0; x < gridW; x++) {
          for (var y = 0; y < gridH; y++) {
            var occupied = false;
            for (var i = 0; i < snake.length; i++) {
              if (snake[i].x === x && snake[i].y === y) { occupied = true; break; }
            }
            if (!occupied && extraBusy) {
              for (var j = 0; j < extraBusy.length; j++) {
                if (extraBusy[j] && extraBusy[j].x === x && extraBusy[j].y === y) { occupied = true; break; }
              }
            }
            if (!occupied) free.push({ x: x, y: y });
          }
        }
        return free;
      }

      function placeFood() {
        var free = freeCells([special]);
        if (free.length === 0) { food = null; return; }
        food = free[api.rand(free.length)];
      }

      // Fruit spécial temporaire : ×3 points, disparaît après 5 s
      function maybeSpawnSpecial() {
        if (special || score === 0 || score % 4 !== 0) return;
        var free = freeCells([food]);
        if (free.length === 0) return;
        var c = free[api.rand(free.length)];
        special = { x: c.x, y: c.y, ttl: 5000 };
      }

      function updateStatus() {
        api.setStatus(
          "Score <b>" + score + "</b> &nbsp;·&nbsp; Best <b>" + best + "</b>"
        );
      }

      // ---- Vitesse : accélère avec la longueur ----
      function computeSpeed() {
        var extra = snake.length - 3;
        stepMs = Math.max(55, 110 - extra * 5);
      }

      // ---- Direction : petite file (2) pour ne pas perdre un swipe rapide ----
      function setDir(nx, ny) {
        if (!alive) return;
        var last = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
        // interdit demi-tour instantané et doublons
        if (nx === -last.x && ny === -last.y) return;
        if (nx === last.x && ny === last.y) return;
        if (dirQueue.length < 2) dirQueue.push({ x: nx, y: ny });
      }

      // ---- Swipe ----
      var downX = 0, downY = 0, downOK = false;
      function onPointerDown(e) {
        downX = e.clientX;
        downY = e.clientY;
        downOK = true;
      }
      function onPointerUp(e) {
        if (!downOK) return;
        downOK = false;
        var dx = e.clientX - downX;
        var dy = e.clientY - downY;
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          setDir(dx > 0 ? 1 : -1, 0);
        } else {
          setDir(0, dy > 0 ? 1 : -1);
        }
      }
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointerup", onPointerUp);

      // ---- Clavier ----
      function onKey(e) {
        var k = e.key;
        if (k === "ArrowUp") { setDir(0, -1); e.preventDefault(); }
        else if (k === "ArrowDown") { setDir(0, 1); e.preventDefault(); }
        else if (k === "ArrowLeft") { setDir(-1, 0); e.preventDefault(); }
        else if (k === "ArrowRight") { setDir(1, 0); e.preventDefault(); }
      }
      window.addEventListener("keydown", onKey);

      // ---- Resize / rotation (débouncé) ----
      var resizeTimer = null;
      function onResize() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyResize, 150);
      }
      function applyResize() {
        resizeTimer = null;
        sizeCanvas();
        // on ramène serpent et fruits dans la nouvelle grille
        for (var i = 0; i < snake.length; i++) {
          snake[i].x = Math.max(0, Math.min(gridW - 1, snake[i].x));
          snake[i].y = Math.max(0, Math.min(gridH - 1, snake[i].y));
        }
        if (food && (food.x >= gridW || food.y >= gridH)) placeFood();
        if (special && (special.x >= gridW || special.y >= gridH)) special = null;
        if (!alive) draw(); // ré-affiche l'écran de fin statique
      }
      window.addEventListener("resize", onResize);

      // ---- Logique ----
      function step() {
        if (dirQueue.length) dir = dirQueue.shift();
        var head = snake[0];
        var nx = head.x + dir.x;
        var ny = head.y + dir.y;

        // mur
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) {
          return die();
        }
        // soi-même (la queue va bouger sauf si on grandit)
        var checkLen = snake.length - (growPending > 0 ? 0 : 1);
        for (var i = 0; i < checkLen; i++) {
          if (snake[i].x === nx && snake[i].y === ny) {
            return die();
          }
        }

        snake.unshift({ x: nx, y: ny });

        if (food && nx === food.x && ny === food.y) {
          score += 1;
          growPending += 1;
          computeSpeed();
          api.soundGood();
          placeFood();
          maybeSpawnSpecial();
          updateStatus();
        } else if (special && nx === special.x && ny === special.y) {
          score += 3; // fruit spécial ×3
          growPending += 1;
          special = null;
          computeSpeed();
          api.soundWin();
          updateStatus();
        }

        if (growPending > 0) {
          growPending -= 1;
        } else {
          snake.pop();
        }
      }

      function die() {
        alive = false;
        shakeT = 380; // petit screen-shake avant l'écran de fin
        api.soundBad();
        api.vibrate([40, 60, 40]);
        var res = api.setBest("snake", score);
        best = res.best;
        endInfo = { isNew: res.isNew };
        if (res.isNew) api.confetti();
        updateStatus();
        makeReplay();
      }

      // ---- Rendu ----
      function drawRoundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        // fond
        ctx.fillStyle = "#fffdf7";
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        if (shakeT > 0) {
          var amp = Math.min(7, shakeT / 45);
          ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
        }

        // aire de jeu contour
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        ctx.strokeRect(offX + 1.5, offY + 1.5, gridW * cell - 3, gridH * cell - 3);

        // nourriture (pomme)
        if (food) {
          var fx = offX + food.x * cell + cell / 2;
          var fy = offY + food.y * cell + cell / 2;
          var fr = cell * 0.34;
          ctx.beginPath();
          ctx.arc(fx, fy, fr, 0, Math.PI * 2);
          ctx.fillStyle = C.coral;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
          // petite feuille
          ctx.beginPath();
          ctx.arc(fx + fr * 0.5, fy - fr, fr * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = C.lime;
          ctx.fill();
          ctx.stroke();
        }

        // fruit spécial : étoile dorée qui clignote (plus vite à la fin)
        if (special) {
          var blinkPeriod = special.ttl < 1500 ? 130 : 260;
          if (Math.floor(special.ttl / blinkPeriod) % 2 === 0) {
            var sx = offX + special.x * cell + cell / 2;
            var sy = offY + special.y * cell + cell / 2;
            var sr = cell * 0.4;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fillStyle = C.sun;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = C.tang;
            ctx.stroke();
            ctx.fillStyle = C.tang;
            ctx.font = "bold " + Math.floor(cell * 0.55) + "px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("★", sx, sy + 1);
            ctx.textBaseline = "alphabetic";
          }
        }

        // serpent
        for (var i = snake.length - 1; i >= 0; i--) {
          var s = snake[i];
          var px = offX + s.x * cell;
          var py = offY + s.y * cell;
          var pad = Math.max(1, cell * 0.08);
          drawRoundRect(px + pad, py + pad, cell - pad * 2, cell - pad * 2, cell * 0.28);
          ctx.fillStyle = i === 0 ? "#5fa832" : C.lime;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
          // yeux sur la tête
          if (i === 0) {
            var cxp = px + cell / 2;
            var cyp = py + cell / 2;
            var ex = dir.x * cell * 0.16;
            var ey = dir.y * cell * 0.16;
            var ox = dir.x === 0 ? cell * 0.16 : 0;
            var oy = dir.y === 0 ? cell * 0.16 : 0;
            ctx.fillStyle = C.ink;
            ctx.beginPath();
            ctx.arc(cxp + ex + ox, cyp + ey + oy, cell * 0.07, 0, Math.PI * 2);
            ctx.arc(cxp + ex - ox, cyp + ey - oy, cell * 0.07, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        // panneau de fin, intégré au rendu (persiste car le rAF est stoppé)
        if (!alive && shakeT <= 0 && endInfo) {
          ctx.fillStyle = "#fff8ecdd";
          ctx.fillRect(0, 0, W, H);
          ctx.textAlign = "center";
          ctx.fillStyle = C.ink;
          ctx.font = "bold 36px system-ui, sans-serif";
          ctx.fillText("Perdu", W / 2, H / 2 - 70);
          ctx.font = "bold 28px system-ui, sans-serif";
          ctx.fillText("Score " + score, W / 2, H / 2 - 26);
          if (endInfo.isNew) {
            ctx.fillStyle = C.coral;
            ctx.font = "bold 22px system-ui, sans-serif";
            ctx.fillText("Nouveau record !", W / 2, H / 2 + 8);
          } else {
            ctx.font = "bold 22px system-ui, sans-serif";
            ctx.fillText("Record " + best, W / 2, H / 2 + 8);
          }
        }
      }

      function makeReplay() {
        removeReplay();
        replayBtn = document.createElement("button");
        replayBtn.textContent = "Rejouer";
        replayBtn.style.position = "absolute";
        replayBtn.style.left = "50%";
        replayBtn.style.top = "calc(50% + 40px)";
        replayBtn.style.transform = "translate(-50%,0)";
        replayBtn.style.padding = "12px 26px";
        replayBtn.style.font = "bold 18px system-ui, sans-serif";
        replayBtn.style.color = C.paper;
        replayBtn.style.background = C.turq;
        replayBtn.style.border = "3px solid " + C.ink;
        replayBtn.style.borderRadius = "14px";
        replayBtn.style.cursor = "pointer";
        replayBtn.style.zIndex = "10";
        if (getComputedStyle(board).position === "static") {
          board.style.position = "relative";
        }
        replayBtn.addEventListener("click", function () {
          reset();
        });
        board.appendChild(replayBtn);
      }

      function removeReplay() {
        if (replayBtn && replayBtn.parentNode) {
          replayBtn.parentNode.removeChild(replayBtn);
        }
        replayBtn = null;
      }

      // ---- Boucle ----
      function loop(t) {
        rafId = requestAnimationFrame(loop);
        if (!lastT) lastT = t;
        var dt = t - lastT;
        lastT = t;
        if (dt > 100) dt = 100;
        if (alive) {
          acc += dt;
          while (acc >= stepMs) {
            acc -= stepMs;
            step();
            if (!alive) break;
          }
          if (special) {
            special.ttl -= dt;
            if (special.ttl <= 0) { special = null; api.beep(220, 0.05, "sine", 0.15); }
          }
        } else if (shakeT > 0) {
          shakeT -= dt;
        }
        draw();
        // mort + fin du shake → écran statique, on stoppe le rAF (batterie)
        if (!alive && shakeT <= 0) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      }

      function startLoop() {
        if (rafId) return;
        lastT = 0;
        rafId = requestAnimationFrame(loop);
      }

      // ---- Exit / cleanup ----
      api.onExit(function () {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = null;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("keydown", onKey);
        removeReplay();
      });

      reset();
    }
  });
})();
