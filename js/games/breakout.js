(function () {
  "use strict";
  if (!window.ARCADE || !window.ARCADE.register) return;

  window.ARCADE.register({
    id: "breakout",
    title: "Casse-briques",
    emoji: "🧱",
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

      // ---- Paramètres ----
      var COLS = 6;
      var ROWS = 7;
      var MAX_LEVEL = 5;
      var brickColors = [C.coral, C.tang, C.sun, C.lime, C.turq, C.sky, C.grape, C.bubble];
      var margin = 12;
      var brickGap = 6;
      var brickTop = 60;
      var brickH = 22;
      var brickW;

      var basePadW;
      var padH = 16;
      var padY;

      function sizeCanvas() {
        W = api.W || board.clientWidth || 360;
        H = api.H || board.clientHeight || 560;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        brickW = (W - margin * 2 - brickGap * (COLS - 1)) / COLS;
        basePadW = Math.max(70, W * 0.24);
        padY = H - 46;
      }
      sizeCanvas();

      // ---- Etat ----
      var bricks, pad, balls, score, lives, best, state, rafId, replayBtn;
      var level, combo, comboFlash, levelFlash, wideTicks, powerups, endInfo;
      var totalBricks = 0;
      var leftDown = false, rightDown = false;

      best = api.getBest("breakout") || 0;

      // Assombrit une couleur hex (#rrggbb) — briques à 2 coups
      function shade(hex, f) {
        var n = parseInt(hex.slice(1), 16);
        var r = Math.round(((n >> 16) & 255) * f);
        var g = Math.round(((n >> 8) & 255) * f);
        var b = Math.round((n & 255) * f);
        return "rgb(" + r + "," + g + "," + b + ")";
      }

      // Motif du niveau : 0 = pas de brique, 1 = normale, 2 = deux coups
      function levelPattern(lvl, r, c) {
        var m = (lvl - 1) % 5;
        var mid = (COLS - 1) / 2;
        if (m === 0) return 1;                                             // mur plein
        if (m === 1) return ((r + c) % 2 === 0) ? (r === 0 ? 2 : 1) : 0;   // damier
        if (m === 2) return (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) ? 2 : 1; // cadre renforcé
        if (m === 3) return (Math.abs(c - mid) <= r + 0.5) ? (r < 2 ? 2 : 1) : 0; // pyramide
        return r < 2 ? 2 : 1;                                              // plein, haut renforcé
      }

      function buildLevel() {
        bricks = [];
        for (var r = 0; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) {
            var hp = levelPattern(level, r, c);
            if (!hp) continue;
            bricks.push({
              r: r, c: c, hp: hp,
              color: brickColors[(r + level) % brickColors.length]
            });
          }
        }
        totalBricks = bricks.length;
        layoutBricks();
      }

      // (Re)calcule la géométrie des briques — utilisé aussi au resize
      function layoutBricks() {
        for (var i = 0; i < bricks.length; i++) {
          var b = bricks[i];
          b.x = margin + b.c * (brickW + brickGap);
          b.y = brickTop + b.r * (brickH + brickGap);
          b.w = brickW;
          b.h = brickH;
        }
      }

      function reset() {
        level = 1;
        score = 0;
        lives = 3;
        combo = 0;
        comboFlash = 0;
        levelFlash = 90;
        wideTicks = 0;
        powerups = [];
        endInfo = null;
        buildLevel();
        pad = { x: (W - basePadW) / 2, w: basePadW, y: padY, h: padH };
        state = "play";
        balls = [];
        launchBall();
        removeReplay();
        updateStatus();
        startLoop();
      }

      function currentSpeed() {
        var base = Math.max(4.2, H * 0.0092);
        var destroyed = totalBricks - aliveCount();
        // la balle accélère avec les briques détruites et les niveaux
        return Math.min(9.5, base + destroyed * 0.06 + (level - 1) * 0.35);
      }

      function aliveCount() {
        var n = 0;
        for (var i = 0; i < bricks.length; i++) {
          if (bricks[i].hp > 0) n++;
        }
        return n;
      }

      function launchBall() {
        var speed = currentSpeed();
        var ang = (Math.random() * 0.5 - 0.25) - Math.PI / 2; // vers le haut
        balls.push({
          x: pad.x + pad.w / 2,
          y: pad.y - 12,
          r: Math.max(6, W * 0.02),
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          speed: speed
        });
      }

      function updateStatus() {
        var hearts = "";
        for (var i = 0; i < lives; i++) hearts += "❤️";
        api.setStatus(
          "Score <b>" + score + "</b> &nbsp;·&nbsp; Niv. <b>" + level + "</b> &nbsp;·&nbsp; " +
          (hearts || "—") + " &nbsp;·&nbsp; Best <b>" + best + "</b>"
        );
      }

      // ---- Contrôles ----
      function movePadTo(clientX) {
        var rect = canvas.getBoundingClientRect();
        var target = (clientX - rect.left) - pad.w / 2;
        pad.x = Math.max(0, Math.min(W - pad.w, target));
      }
      function onPointerMove(e) {
        if (state !== "play") return;
        movePadTo(e.clientX);
      }
      function onPointerDown(e) {
        if (state !== "play") return;
        movePadTo(e.clientX);
      }
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerdown", onPointerDown);

      function onKeyDown(e) {
        if (e.key === "ArrowLeft") { leftDown = true; e.preventDefault(); }
        else if (e.key === "ArrowRight") { rightDown = true; e.preventDefault(); }
      }
      function onKeyUp(e) {
        if (e.key === "ArrowLeft") leftDown = false;
        else if (e.key === "ArrowRight") rightDown = false;
      }
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      // ---- Resize / rotation (débouncé) ----
      var resizeTimer = null;
      function onResize() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyResize, 150);
      }
      function applyResize() {
        resizeTimer = null;
        var oldW = W || 1;
        sizeCanvas();
        layoutBricks();
        // raquette : nouvelle largeur de base, position proportionnelle
        pad.w = wideTicks > 0 ? Math.min(W * 0.5, basePadW * 1.6) : basePadW;
        pad.y = padY;
        pad.h = padH;
        pad.x = Math.max(0, Math.min(W - pad.w, pad.x * (W / oldW)));
        // balles & power-ups : on garde tout dans l'aire de jeu
        for (var i = 0; i < balls.length; i++) {
          var bl = balls[i];
          bl.x = Math.max(bl.r, Math.min(W - bl.r, bl.x * (W / oldW)));
          bl.y = Math.min(bl.y, pad.y - bl.r - 2);
        }
        for (var j = 0; j < powerups.length; j++) {
          powerups[j].x = Math.max(12, Math.min(W - 12, powerups[j].x * (W / oldW)));
        }
        if (state !== "play") draw(); // ré-affiche l'écran de fin statique
      }
      window.addEventListener("resize", onResize);

      // ---- Power-ups ----
      function maybeDrop(b) {
        if (Math.random() >= 0.14) return;
        powerups.push({
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          vy: 2.4,
          type: Math.random() < 0.5 ? "wide" : "multi"
        });
      }

      function applyPowerup(p) {
        api.soundGood();
        if (p.type === "wide") {
          wideTicks = 600; // ~10 s à 60 fps
          var cx = pad.x + pad.w / 2;
          pad.w = Math.min(W * 0.5, basePadW * 1.6);
          pad.x = Math.max(0, Math.min(W - pad.w, cx - pad.w / 2));
        } else {
          // multi-balle : duplique une balle existante (max 4)
          var src = balls[0];
          if (!src) return;
          for (var k = 0; k < 2 && balls.length < 4; k++) {
            var ang = Math.atan2(src.vy, src.vx) + (k === 0 ? 0.5 : -0.5);
            balls.push({
              x: src.x, y: src.y, r: src.r, speed: src.speed,
              vx: Math.cos(ang) * src.speed,
              vy: Math.sin(ang) * src.speed
            });
          }
        }
      }

      // ---- Logique ----
      function update() {
        if (state !== "play") return;

        // clavier raquette
        var padSpeed = 7;
        if (leftDown) pad.x = Math.max(0, pad.x - padSpeed);
        if (rightDown) pad.x = Math.min(W - pad.w, pad.x + padSpeed);

        // raquette large : compte à rebours
        if (wideTicks > 0) {
          wideTicks--;
          if (wideTicks === 0) {
            var cx = pad.x + pad.w / 2;
            pad.w = basePadW;
            pad.x = Math.max(0, Math.min(W - pad.w, cx - pad.w / 2));
          }
        }
        if (comboFlash > 0) comboFlash--;
        if (levelFlash > 0) levelFlash--;

        // power-ups qui tombent
        for (var pi = powerups.length - 1; pi >= 0; pi--) {
          var p = powerups[pi];
          p.y += p.vy;
          if (p.y > H + 20) { powerups.splice(pi, 1); continue; }
          if (p.y + 10 > pad.y && p.y - 10 < pad.y + pad.h &&
              p.x > pad.x - 8 && p.x < pad.x + pad.w + 8) {
            powerups.splice(pi, 1);
            applyPowerup(p);
          }
        }

        for (var bi = balls.length - 1; bi >= 0; bi--) {
          var ball = balls[bi];
          ball.x += ball.vx;
          ball.y += ball.vy;

          // murs
          if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
          if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
          if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

          // raquette (dessus ET flancs)
          if (
            ball.y + ball.r > pad.y &&
            ball.y - ball.r < pad.y + pad.h &&
            ball.x + ball.r > pad.x &&
            ball.x - ball.r < pad.x + pad.w
          ) {
            if (ball.vy > 0 && ball.y < pad.y + pad.h / 2) {
              // rebond par le dessus, angle selon le point d'impact
              var hit = (ball.x - (pad.x + pad.w / 2)) / (pad.w / 2); // -1..1
              hit = Math.max(-1, Math.min(1, hit));
              var maxAng = Math.PI * 0.42;
              var ang = hit * maxAng - Math.PI / 2;
              ball.vx = Math.cos(ang) * ball.speed;
              ball.vy = Math.sin(ang) * ball.speed;
              ball.y = pad.y - ball.r - 1;
            } else {
              // flanc : la balle est repoussée horizontalement
              if (ball.x < pad.x + pad.w / 2) {
                ball.vx = -Math.abs(ball.vx);
                ball.x = pad.x - ball.r - 1;
              } else {
                ball.vx = Math.abs(ball.vx);
                ball.x = pad.x + pad.w + ball.r + 1;
              }
            }
            combo = 0; // le combo retombe dès qu'on touche la raquette
          }

          // briques
          for (var i = 0; i < bricks.length; i++) {
            var b = bricks[i];
            if (b.hp <= 0) continue;
            if (
              ball.x + ball.r > b.x &&
              ball.x - ball.r < b.x + b.w &&
              ball.y + ball.r > b.y &&
              ball.y - ball.r < b.y + b.h
            ) {
              b.hp--;
              if (b.hp > 0) {
                score += 1;
                api.beep(440, 0.05, "square", 0.2);
              } else {
                combo += 1;
                score += combo; // points ×combo
                if (combo >= 2) comboFlash = 60;
                api.beep(660, 0.05, "square", 0.2);
                maybeDrop(b);
              }
              // choix du rebond selon le côté touché
              var overlapL = ball.x + ball.r - b.x;
              var overlapR = b.x + b.w - (ball.x - ball.r);
              var overlapT = ball.y + ball.r - b.y;
              var overlapB = b.y + b.h - (ball.y - ball.r);
              var minOv = Math.min(overlapL, overlapR, overlapT, overlapB);
              if (minOv === overlapT || minOv === overlapB) {
                ball.vy = -ball.vy;
              } else {
                ball.vx = -ball.vx;
              }
              // accélération progressive
              var mag = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
              ball.speed = currentSpeed();
              ball.vx = (ball.vx / mag) * ball.speed;
              ball.vy = (ball.vy / mag) * ball.speed;
              updateStatus();
              if (allCleared()) return nextLevel();
              break;
            }
          }

          // balle tombée
          if (ball.y - ball.r > H) {
            balls.splice(bi, 1);
          }
        }

        // plus aucune balle → une vie en moins
        if (balls.length === 0) {
          lives -= 1;
          combo = 0;
          updateStatus();
          if (lives <= 0) {
            return endGame(false);
          } else {
            api.soundBad();
            pad.x = (W - pad.w) / 2;
            launchBall();
          }
        }
      }

      function allCleared() {
        for (var i = 0; i < bricks.length; i++) {
          if (bricks[i].hp > 0) return false;
        }
        return true;
      }

      function nextLevel() {
        if (level >= MAX_LEVEL) return endGame(true);
        level++;
        levelFlash = 90;
        wideTicks = 0;
        powerups = [];
        buildLevel();
        pad.w = basePadW;
        pad.x = (W - pad.w) / 2;
        balls = [];
        launchBall();
        api.soundGood();
        updateStatus();
      }

      function endGame(won) {
        state = won ? "won" : "lost";
        var res = api.setBest("breakout", score);
        best = res.best;
        endInfo = { title: won ? "Gagné !" : "Perdu", isNew: res.isNew };
        if (won) {
          api.win();
        } else {
          api.soundBad();
          if (res.isNew) api.confetti();
        }
        updateStatus();
        makeReplay();
        // la boucle rAF s'arrête d'elle-même (état ≠ "play") après un
        // dernier draw() qui inclut le panneau de fin.
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
        ctx.fillStyle = "#fffdf7";
        ctx.fillRect(0, 0, W, H);

        // briques (2 coups = teinte plus foncée)
        for (var i = 0; i < bricks.length; i++) {
          var b = bricks[i];
          if (b.hp <= 0) continue;
          drawRoundRect(b.x, b.y, b.w, b.h, 5);
          ctx.fillStyle = b.hp >= 2 ? shade(b.color, 0.62) : b.color;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
        }

        // power-ups
        for (var pi = 0; pi < powerups.length; pi++) {
          var p = powerups[pi];
          ctx.beginPath();
          ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
          ctx.fillStyle = p.type === "wide" ? C.sky : C.tang;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
          ctx.fillStyle = C.ink;
          ctx.font = "bold 12px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.type === "wide" ? "↔" : "+", p.x, p.y + 1);
          ctx.textBaseline = "alphabetic";
        }

        // raquette
        drawRoundRect(pad.x, pad.y, pad.w, pad.h, 8);
        ctx.fillStyle = wideTicks > 0 ? C.sky : C.grape;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = C.ink;
        ctx.stroke();

        // balles
        for (var bi = 0; bi < balls.length; bi++) {
          var ball = balls[bi];
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
          ctx.fillStyle = C.sun;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
        }

        ctx.textAlign = "center";

        // annonce de niveau
        if (levelFlash > 0 && state === "play") {
          ctx.globalAlpha = Math.min(1, levelFlash / 30);
          ctx.fillStyle = C.grape;
          ctx.font = "bold 30px system-ui, sans-serif";
          ctx.fillText("Niveau " + level, W / 2, H * 0.45);
          ctx.globalAlpha = 1;
        }

        // combo en gros
        if (comboFlash > 0 && combo >= 2 && state === "play") {
          ctx.globalAlpha = Math.min(1, comboFlash / 25);
          ctx.fillStyle = C.coral;
          ctx.font = "bold 44px system-ui, sans-serif";
          ctx.fillText("COMBO ×" + combo, W / 2, H * 0.58);
          ctx.globalAlpha = 1;
        }

        // panneau de fin, intégré au rendu (persiste car le rAF est stoppé)
        if (state !== "play" && endInfo) {
          ctx.fillStyle = "#fff8ecdd";
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = C.ink;
          ctx.font = "bold 36px system-ui, sans-serif";
          ctx.fillText(endInfo.title, W / 2, H / 2 - 70);
          ctx.font = "bold 26px system-ui, sans-serif";
          ctx.fillText("Score " + score, W / 2, H / 2 - 26);
          if (endInfo.isNew) {
            ctx.fillStyle = C.coral;
            ctx.font = "bold 22px system-ui, sans-serif";
            ctx.fillText("Nouveau record !", W / 2, H / 2 + 8);
          } else {
            ctx.fillStyle = C.ink;
            ctx.font = "20px system-ui, sans-serif";
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

      // ---- Boucle (accumulateur, pas fixe 60fps) ----
      var lastT = 0;
      var stepMs = 1000 / 60;
      var acc = 0;
      function loop(t) {
        rafId = requestAnimationFrame(loop);
        if (!lastT) lastT = t;
        var dt = t - lastT;
        lastT = t;
        if (dt > 100) dt = 100;
        acc += dt;
        while (acc >= stepMs) {
          acc -= stepMs;
          update();
          if (state !== "play") break;
        }
        draw();
        // écran statique → on stoppe le rAF (batterie)
        if (state !== "play") {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      }

      function startLoop() {
        if (rafId) return;
        lastT = 0;
        acc = 0;
        rafId = requestAnimationFrame(loop);
      }

      // ---- Exit / cleanup ----
      api.onExit(function () {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = null;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        removeReplay();
      });

      reset();
    }
  });
})();
