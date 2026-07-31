(function () {
  "use strict";

  window.ARCADE.register({
    id: "pop",
    title: "Pop",
    emoji: "🫧",
    mount(board, api) {
      const C = api.colors;

      // palette pastel pour les bulles
      const HUES = [C.coral, C.turq, C.sun, C.grape, C.lime, C.bubble, C.sky, C.tang];

      // ---- dimensions ----
      const W = board.clientWidth || api.W || 360;
      const H = board.clientHeight || api.H || 560;

      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:relative;width:" + W + "px;height:" + H + "px;overflow:hidden;" +
        "background:" + C.paper + ";touch-action:none;user-select:none;";
      board.appendChild(wrap);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cv = document.createElement("canvas");
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      cv.style.cssText = "position:absolute;inset:0;width:" + W + "px;height:" + H + "px;";
      wrap.appendChild(cv);
      const ctx = cv.getContext("2d");
      ctx.scale(dpr, dpr);

      // ---- état ----
      const GAME_TIME = 60;      // mode chrono par défaut
      let mode = "timed";        // "timed" (60 s) | "zen" (sans chrono)
      let playing = false;       // partie en cours (le rAF, lui, vit tant que le jeu est monté)
      let running = true;        // faux après api.onExit
      let bubbles = [];          // {x,y,r,color,kind,state,t,scale,drift,phase}
      let rafId = 0;
      let timers = [];
      let fillInterval = 0;
      let tickInterval = 0;
      let score = 0;             // mode chrono
      let pops = 0;              // compteur zen
      let goldsSpawned = 0;
      let timeLeft = GAME_TIME;
      let best = api.getBest("pop") || 0;
      let last = 0;
      let overlayEl = null;
      let modeBtn = null;

      const R = Math.max(26, Math.floor(W * 0.09));         // rayon de base
      const TARGET = Math.max(9, Math.floor((W * H) / (R * R * 11))); // remplissage

      function addTimeout(fn, ms) {
        const id = setTimeout(function () {
          const i = timers.indexOf(id);
          if (i >= 0) timers.splice(i, 1);
          fn();
        }, ms);
        timers.push(id);
        return id;
      }

      function clearGameTimers() {
        timers.forEach(function (t) { clearTimeout(t); });
        timers = [];
        if (tickInterval) { clearInterval(tickInterval); tickInterval = 0; }
      }

      function updateStatus() {
        if (mode === "zen") {
          api.setStatus("😌 zen · pop <b>" + pops + "</b>");
        } else {
          const b = best ? " · Record <b>" + best + "</b>" : "";
          api.setStatus("Score <b>" + score + "</b> · Temps <b>" + timeLeft + "s</b>" + b);
        }
      }

      // place une bulle à un endroit peu encombré
      function findSpot(r) {
        const pad = r + 6;
        for (let tries = 0; tries < 20; tries++) {
          const x = pad + Math.random() * (W - pad * 2);
          const y = pad + Math.random() * (H - pad * 2);
          let ok = true;
          for (let i = 0; i < bubbles.length; i++) {
            const o = bubbles[i];
            if (o.state === "pop") continue;
            const dx = o.x - x, dy = o.y - y;
            const min = (o.r + r) * 0.9;
            if (dx * dx + dy * dy < min * min) { ok = false; break; }
          }
          if (ok) return { x: x, y: y };
        }
        return null; // pas trouvé cette fois, on réessaiera plus tard
      }

      // kind: "norm" | "gold" (+5, brillante) | "stone" (🪨, −2)
      function makeBubble(kind) {
        if (!kind) {
          kind = (mode === "timed" && Math.random() < 0.12) ? "stone" : "norm";
        }
        const r = R * (0.8 + Math.random() * 0.5);
        const spot = findSpot(r);
        if (!spot) return false;
        bubbles.push({
          x: spot.x,
          y: spot.y,
          r: r,
          color: kind === "gold" ? C.sun : (kind === "stone" ? "#9a948a" : HUES[api.rand(HUES.length)]),
          kind: kind,
          state: "in",     // in (apparition) | idle | pop
          t: 0,
          scale: 0,
          drift: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2
        });
        return true;
      }

      function fill() {
        let active = 0;
        for (let i = 0; i < bubbles.length; i++) {
          if (bubbles[i].state !== "pop") active++;
        }
        let guard = 0;
        while (active < TARGET && guard < TARGET + 4) {
          if (makeBubble()) active++;
          guard++;
        }
      }

      // 3 bulles dorées rares, réparties au fil des 60 s
      function scheduleGolds() {
        goldsSpawned = 0;
        const slots = [5 + api.rand(12), 22 + api.rand(12), 40 + api.rand(12)]; // secondes
        slots.forEach(function (s) {
          addTimeout(function () { trySpawnGold(6); }, s * 1000);
        });
      }

      function trySpawnGold(retries) {
        if (!playing || mode !== "timed") return;
        if (makeBubble("gold")) { goldsSpawned++; return; }
        if (retries > 0) addTimeout(function () { trySpawnGold(retries - 1); }, 450);
      }

      // ---- interaction ----
      function pointAt(clientX, clientY) {
        const rect = cv.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
      }

      function popSound(kind) {
        if (kind === "gold") {
          api.soundGood();
          api.beep(980, 0.09, "sine", 0.16);
        } else if (kind === "stone") {
          // son sourd
          api.beep(95, 0.14, "sine", 0.3);
          api.beep(70, 0.1, "triangle", 0.2);
          if (api.vibrate) api.vibrate([25, 30, 25]);
        } else {
          // son "pop" doux, hauteur légèrement variable
          api.beep(520 + api.rand(260), 0.07, "sine", 0.18);
          api.beep(300 + api.rand(120), 0.05, "triangle", 0.08);
          if (api.vibrate) api.vibrate(8);
        }
      }

      function onDown(e) {
        if (!playing) return;
        const p = pointAt(e.clientX, e.clientY);
        // top-most (dernière dessinée) d'abord
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          if (b.state === "pop") continue;
          const dx = b.x - p.x, dy = b.y - p.y;
          if (dx * dx + dy * dy <= b.r * b.r) {
            b.state = "pop";
            b.t = 0;
            if (mode === "zen") {
              pops++;
            } else if (b.kind === "gold") {
              score += 5;
            } else if (b.kind === "stone") {
              score = Math.max(0, score - 2);
            } else {
              score += 1;
            }
            updateStatus();
            popSound(mode === "zen" ? "norm" : b.kind);
            // réapparition ailleurs après un court instant
            addTimeout(function () {
              if (running && playing) { makeBubble(); }
            }, 260 + api.rand(220));
            return;
          }
        }
      }

      wrap.addEventListener("pointerdown", onDown);

      // ---- boucle ----
      function frame(ts) {
        if (!running) return;
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.drift += dt;
          if (b.state === "in") {
            b.t += dt / 0.28;
            if (b.t >= 1) { b.t = 1; b.state = "idle"; }
            // petit rebond à l'apparition
            b.scale = easeBack(b.t);
          } else if (b.state === "idle") {
            b.scale = 1;
          } else if (b.state === "pop") {
            b.t += dt / 0.3;
            b.scale = 1 + b.t * 0.5;
            if (b.t >= 1) { bubbles.splice(i, 1); continue; }
          }
        }

        draw();
        rafId = requestAnimationFrame(frame);
      }

      function easeBack(t) {
        const c1 = 1.70158, c3 = c1 + 1;
        const p = t - 1;
        return 1 + c3 * p * p * p + c1 * p * p;
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = C.paper;
        ctx.fillRect(0, 0, W, H);

        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i];
          const wob = Math.sin(b.drift * 1.2 + b.phase) * 2.5;
          const x = b.x + wob;
          const y = b.y + Math.cos(b.drift + b.phase) * 2;
          const r = Math.max(0.1, b.r * b.scale);
          const gold = b.kind === "gold" && mode !== "zen";
          const stone = b.kind === "stone" && mode !== "zen";

          ctx.save();
          if (b.state === "pop") {
            ctx.globalAlpha = Math.max(0, 1 - b.t);
          }

          // corps translucide en dégradé pastel (plus dense pour or/pierre)
          const g = ctx.createRadialGradient(
            x - r * 0.3, y - r * 0.35, r * 0.1,
            x, y, r
          );
          if (gold) {
            g.addColorStop(0, hexA("#ffffff", 0.9));
            g.addColorStop(0.35, hexA(C.sun, 0.85));
            g.addColorStop(1, hexA(C.tang, 0.6));
          } else if (stone) {
            g.addColorStop(0, hexA("#c9c3b8", 0.95));
            g.addColorStop(0.5, hexA("#9a948a", 0.9));
            g.addColorStop(1, hexA("#6f6a61", 0.85));
          } else {
            g.addColorStop(0, hexA("#ffffff", 0.65));
            g.addColorStop(0.35, hexA(b.color, 0.55));
            g.addColorStop(1, hexA(b.color, 0.32));
          }
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();

          // contour doux (encre légère) — doré appuyé pour la bulle brillante
          ctx.lineWidth = gold ? 3 : 2;
          ctx.strokeStyle = gold ? hexA("#d99a00", 0.85) : hexA(C.ink, stone ? 0.45 : 0.25);
          ctx.stroke();

          if (stone) {
            // 🪨 bulle « pierre » à éviter
            ctx.font = Math.round(r * 0.9) + "px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🪨", x, y + r * 0.05);
          } else {
            // reflet blanc
            ctx.fillStyle = hexA("#ffffff", 0.85);
            ctx.beginPath();
            ctx.arc(x - r * 0.34, y - r * 0.36, r * 0.18, 0, Math.PI * 2);
            ctx.fill();
            // petit reflet secondaire
            ctx.fillStyle = hexA("#ffffff", 0.45);
            ctx.beginPath();
            ctx.arc(x + r * 0.28, y + r * 0.30, r * 0.09, 0, Math.PI * 2);
            ctx.fill();
            if (gold) {
              // étincelle qui tourne doucement
              ctx.globalAlpha *= 0.75 + 0.25 * Math.sin(b.drift * 3);
              ctx.font = Math.round(r * 0.6) + "px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("✨", x + r * 0.15, y - r * 0.05);
            }
          }

          ctx.restore();
        }
      }

      // #rrggbb + alpha -> rgba()
      function hexA(hex, a) {
        let h = hex.replace("#", "");
        if (h.length === 3) {
          h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return "rgba(" + r + "," + g + "," + b + "," + a + ")";
      }

      // ---- fin de partie (mode chrono) ----
      function endTimed() {
        playing = false;
        clearGameTimers();
        const r = api.setBest("pop", score);
        const isNew = r.isNew && score > 0;
        best = r.best;
        updateStatus();
        api.soundWin();
        if (isNew) api.confetti();
        showOverlay(isNew);
      }

      function showOverlay(isNew) {
        overlayEl = document.createElement("div");
        overlayEl.style.cssText =
          "position:absolute;inset:0;background:#fff8ecdd;display:flex;flex-direction:column;" +
          "align-items:center;justify-content:center;gap:16px;padding:20px;text-align:center;";

        const title = document.createElement("div");
        title.textContent = "⏱️ Terminé !";
        title.style.cssText = "font-size:clamp(22px,8vw,34px);font-weight:bold;color:" + C.ink + ";";

        const res = document.createElement("div");
        res.innerHTML = "Score <b>" + score + "</b> · Record <b>" + best + "</b>";
        res.style.cssText = "font-size:clamp(16px,5vw,22px);color:" + C.ink + ";";

        overlayEl.appendChild(title);
        overlayEl.appendChild(res);

        if (isNew) {
          const rec = document.createElement("div");
          rec.textContent = "🎉 Nouveau record !";
          rec.style.cssText = "font-size:clamp(16px,5vw,22px);font-weight:bold;color:" + C.coral + ";";
          overlayEl.appendChild(rec);
        }

        const btn = document.createElement("button");
        btn.textContent = "Rejouer";
        styleButton(btn, C.turq, false);
        btn.addEventListener("pointerdown", function (e) {
          e.preventDefault(); e.stopPropagation();
          startGame("timed");
        });

        const zenBtn = document.createElement("button");
        zenBtn.textContent = "😌 Mode zen";
        styleButton(zenBtn, C.bubble, true);
        zenBtn.addEventListener("pointerdown", function (e) {
          e.preventDefault(); e.stopPropagation();
          startGame("zen");
        });

        overlayEl.appendChild(btn);
        overlayEl.appendChild(zenBtn);
        wrap.appendChild(overlayEl);
      }

      function styleButton(btn, bg, small) {
        btn.style.cssText =
          "font-family:inherit;font-weight:bold;color:" + C.ink + ";background:" + bg + ";" +
          "border:" + (small ? 2 : 3) + "px solid " + C.ink + ";border-radius:" + (small ? 12 : 14) + "px;" +
          "box-shadow:" + (small ? "2px 2px" : "3px 3px") + " 0 " + C.ink + ";" +
          "padding:" + (small ? "7px 12px" : "12px 26px") + ";cursor:pointer;touch-action:manipulation;" +
          "font-size:" + (small ? "clamp(12px,3.6vw,15px)" : "clamp(16px,5vw,20px)") + ";";
      }

      // petit bouton en jeu : bascule chrono <-> zen
      modeBtn = document.createElement("button");
      styleButton(modeBtn, "#e8e2d4", true);
      modeBtn.style.position = "absolute";
      modeBtn.style.top = "10px";
      modeBtn.style.right = "10px";
      modeBtn.addEventListener("pointerdown", function (e) {
        e.preventDefault(); e.stopPropagation();
        startGame(mode === "timed" ? "zen" : "timed");
      });
      wrap.appendChild(modeBtn);

      function startGame(m) {
        mode = m;
        if (overlayEl) { overlayEl.remove(); overlayEl = null; }
        clearGameTimers();
        bubbles = [];
        score = 0;
        pops = 0;
        timeLeft = GAME_TIME;
        playing = true;
        best = api.getBest("pop") || 0;
        modeBtn.textContent = mode === "timed" ? "😌 zen" : "⏱️ 60 s";

        if (mode === "timed") {
          tickInterval = setInterval(function () {
            if (!playing) return;
            timeLeft -= 1;
            if (timeLeft <= 0) {
              timeLeft = 0;
              endTimed();
            } else {
              updateStatus();
            }
          }, 1000);
          scheduleGolds();
        }

        updateStatus();
        fill();
      }

      // ---- cleanup ----
      api.onExit(function () {
        running = false;
        playing = false;
        if (rafId) cancelAnimationFrame(rafId);
        clearGameTimers();
        if (fillInterval) clearInterval(fillInterval);
        wrap.removeEventListener("pointerdown", onDown);
      });

      // ---- go ----
      startGame("timed");
      // petit filet de sécurité : garde le plateau rempli
      fillInterval = setInterval(function () { if (running && playing) fill(); }, 1200);
      rafId = requestAnimationFrame(frame);
    }
  });
})();
