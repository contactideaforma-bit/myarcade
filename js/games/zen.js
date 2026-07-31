(function () {
  "use strict";
  if (!window.ARCADE) return;

  window.ARCADE.register({
    id: "zen",
    title: "Zen",
    emoji: "♾️",
    mount(board, api) {
      const C = api.colors;

      // ---- catégories ----
      // chaque bac a un emoji-étiquette + une liste d'emojis membres + une couleur pastel
      const CATS = [
        {
          key: "fruits",
          label: "🍎",
          color: C.coral,
          items: ["🍎", "🍌", "🍓", "🍇", "🍊", "🍑", "🍉", "🍒", "🥝"]
        },
        {
          key: "animaux",
          label: "🐶",
          color: C.turq,
          items: ["🐶", "🐱", "🐸", "🐰", "🦊", "🐼", "🐨", "🐷", "🐮"]
        },
        {
          key: "nourriture",
          label: "🍕",
          color: C.grape,
          items: ["🍕", "🍔", "🍟", "🌭", "🍩", "🍪", "🧁", "🍫", "🍜"]
        }
      ];

      // index emoji -> catégorie
      const CAT_OF = {};
      CATS.forEach(function (c, ci) {
        c.items.forEach(function (em) { CAT_OF[em] = ci; });
      });

      // ---- dimensions ----
      const W = board.clientWidth || api.W || 360;
      const H = board.clientHeight || api.H || 560;

      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:relative;width:" + W + "px;height:" + H + "px;overflow:hidden;" +
        "background:" + C.paper + ";touch-action:none;user-select:none;";
      board.appendChild(wrap);

      // canvas pour le rendu fluide
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cv = document.createElement("canvas");
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      cv.style.cssText = "position:absolute;inset:0;width:" + W + "px;height:" + H + "px;";
      wrap.appendChild(cv);
      const ctx = cv.getContext("2d");
      ctx.scale(dpr, dpr);

      // ---- géométrie des bacs ----
      const BIN_H = Math.max(70, Math.floor(H * 0.16));
      const BIN_Y = H - BIN_H;
      const BIN_GAP = 10;
      const BIN_W = (W - BIN_GAP * 4) / 3;
      const bins = CATS.map(function (c, i) {
        const x = BIN_GAP + i * (BIN_W + BIN_GAP);
        return { x: x, y: BIN_Y + 6, w: BIN_W, h: BIN_H - 12, cx: x + BIN_W / 2, cy: BIN_Y + BIN_H / 2, cat: c, glow: 0 };
      });

      // ---- état ----
      let items = [];    // emojis qui descendent
      let selected = null; // emoji surligné en attente d'un bac
      let rafId = 0;
      let timers = [];
      let running = true;
      let sorted = 0;
      let streak = 0;    // série de bons tris (fait monter le carillon)
      let best = api.getBest("zen") || 0;
      let last = 0;
      let elapsed = 0;   // durée de session (cycle jour/nuit du fond)

      const FONT = Math.max(30, Math.floor(W * 0.11));

      // setTimeout avec purge automatique des ids expirés
      function later(fn, ms) {
        const t = setTimeout(function () {
          const i = timers.indexOf(t);
          if (i >= 0) timers.splice(i, 1);
          if (!running) return;
          fn();
        }, ms);
        timers.push(t);
        return t;
      }

      function updateStatus() {
        let s = "rangés: <b>" + sorted + "</b>";
        if (streak >= 2) s += " · série <b>" + streak + "</b>";
        if (best) s += " · best <b>" + best + "</b>";
        api.setStatus(s);
      }

      function spawn() {
        const ci = api.rand(CATS.length);
        const list = CATS[ci].items;
        const em = list[api.rand(list.length)];
        const margin = FONT * 0.9;
        const x = margin + Math.random() * (W - margin * 2);
        items.push({
          em: em,
          cat: ci,
          x: x,
          y: -FONT,
          vy: 26 + Math.random() * 10, // px/s, lent
          state: "fall",   // fall | hold | fly | fade
          alpha: 1,
          scale: 1,
          tx: 0, ty: 0,     // cible en vol
          sx: 0, sy: 0,     // départ vol
          t: 0,             // progression vol/fade 0..1
          wob: Math.random() * Math.PI * 2 // léger balancement
        });
      }

      function scheduleSpawn() {
        // spawn régulier et espacé (ambiance calme)
        later(function () {
          spawn();
          scheduleSpawn();
        }, 1400 + Math.random() * 900);
      }

      // ---- sons ----
      // carillon : gamme pentatonique qui monte avec la série
      const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
      function chime(n) {
        const idx = Math.min(Math.max(n - 1, 0), PENTA.length - 1);
        const f = 523.25 * Math.pow(2, PENTA[idx] / 12);
        api.beep(f, 0.14, "sine", 0.18);
        if (n >= 3) {
          // la série ajoute une quinte douce en écho
          later(function () { api.beep(f * 1.5, 0.12, "sine", 0.1); }, 90);
        }
      }
      function bzzt() {
        // petit « bzzt » doux, sans dramatiser
        api.beep(130, 0.08, "square", 0.08);
        later(function () { api.beep(98, 0.1, "square", 0.06); }, 70);
        api.vibrate && api.vibrate(15);
      }

      // ---- interaction ----
      function pointAt(clientX, clientY) {
        const r = cv.getBoundingClientRect();
        return { x: clientX - r.left, y: clientY - r.top };
      }

      function binAt(x) {
        for (let i = 0; i < bins.length; i++) {
          if (x >= bins[i].x - BIN_GAP / 2 && x <= bins[i].x + bins[i].w + BIN_GAP / 2) return i;
        }
        return -1;
      }

      function deselect() {
        if (selected) {
          if (selected.state === "hold") selected.state = "fall";
          selected = null;
        }
      }

      function sendToBin(it, bi) {
        const b = bins[bi];
        it.state = "fly";
        it.sx = it.x; it.sy = it.y;
        it.tx = b.cx; it.ty = b.cy;
        it.t = 0;
      }

      function onDown(e) {
        const p = pointAt(e.clientX, e.clientY);

        // --- tap sur un bac : on y envoie l'emoji surligné ---
        if (p.y >= BIN_Y) {
          const bi = binAt(p.x);
          if (bi >= 0 && selected) {
            const it = selected;
            if (it.cat === bi) {
              // bon bac : il y vole, carillon qui monte avec la série
              selected = null;
              sendToBin(it, bi);
              bins[bi].glow = 1;
            } else {
              // mauvais bac : « bzzt » doux, aucune pénalité,
              // l'emoji retourne simplement flotter
              bzzt();
              streak = 0;
              deselect();
              updateStatus();
            }
          }
          return;
        }

        // --- tap sur un emoji : on le surligne (halo) ---
        let hit = null, hd = 1e9;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.state !== "fall" && it.state !== "hold") continue;
          const dx = it.x - p.x, dy = it.y - p.y;
          const d = dx * dx + dy * dy;
          const rr = (FONT * 0.7) * (FONT * 0.7);
          if (d <= rr && d < hd) { hd = d; hit = it; }
        }
        if (hit) {
          if (hit === selected) { deselect(); return; } // re-tap = relâcher
          deselect();
          selected = hit;
          hit.state = "hold"; // il flotte sur place, entouré d'un halo
          api.beep(740, 0.06, "sine", 0.12);
        } else {
          deselect(); // tap dans le vide = relâcher
        }
      }

      wrap.addEventListener("pointerdown", onDown);

      // ---- boucle ----
      function frame(ts) {
        if (!running) return;
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05; // clamp
        elapsed += dt;

        // update
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.wob += dt;
          if (it.state === "fall") {
            it.y += it.vy * dt;
            if (it.y - FONT * 0.6 > BIN_Y) {
              // atteint le bas sans être trié -> fondu, sans pénalité
              it.state = "fade";
              it.t = 0;
            }
          } else if (it.state === "hold") {
            // suspendu, en attente d'un bac (léger flottement sur place)
            it.scale = 1.06 + 0.05 * Math.sin(it.wob * 2.2);
          } else if (it.state === "fly") {
            it.t += dt / 0.55; // ~0.55s de vol
            if (it.t >= 1) {
              it.t = 1;
              // arrivé dans le bon bac
              sorted++;
              streak++;
              chime(streak);
              const res = api.setBest("zen", sorted);
              if (res && res.best != null) best = res.best;
              updateStatus();
              items.splice(i, 1);
              continue;
            }
            const e = easeInOut(it.t);
            it.x = it.sx + (it.tx - it.sx) * e;
            // arc léger vers le bas
            it.y = it.sy + (it.ty - it.sy) * e;
            it.scale = 1 - 0.35 * it.t;
          } else if (it.state === "fade") {
            it.t += dt / 0.5;
            it.alpha = 1 - it.t;
            it.y += it.vy * dt * 0.4;
            if (it.t >= 1) { items.splice(i, 1); continue; }
          }
        }

        // halo des bacs qui s'estompe
        for (let bIdx = 0; bIdx < bins.length; bIdx++) {
          if (bins[bIdx].glow > 0) bins[bIdx].glow = Math.max(0, bins[bIdx].glow - dt * 1.6);
        }

        draw();
        rafId = requestAnimationFrame(frame);
      }

      function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }

      function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      // fond qui glisse doucement de teinte avec la durée de session
      // (cycle jour/nuit léger : ~6 min pour un tour complet)
      function bgColor() {
        const hue = (42 + elapsed * 1.0) % 360;
        const light = 93 + 2.5 * Math.sin(elapsed / 22);
        return "hsl(" + hue.toFixed(1) + ", 45%, " + light.toFixed(1) + "%)";
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = bgColor();
        ctx.fillRect(0, 0, W, H);

        // bacs
        for (let i = 0; i < bins.length; i++) {
          const b = bins[i];
          ctx.save();
          // ombre douce style doodle
          ctx.fillStyle = C.ink;
          roundRect(b.x + 3, b.y + 4, b.w, b.h, 16);
          ctx.fill();
          ctx.fillStyle = b.cat.color;
          roundRect(b.x, b.y, b.w, b.h, 16);
          ctx.fill();
          // lueur quand un emoji vient d'y être rangé
          if (b.glow > 0) {
            ctx.globalAlpha = b.glow * 0.35;
            ctx.fillStyle = "#ffffff";
            roundRect(b.x, b.y, b.w, b.h, 16);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.lineWidth = selected ? 3.5 : 2.5; // bacs un peu plus marqués quand on tient un emoji
          ctx.strokeStyle = C.ink;
          roundRect(b.x, b.y, b.w, b.h, 16);
          ctx.stroke();
          // étiquette
          ctx.font = Math.floor(b.h * 0.5) + "px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(b.cat.label, b.cx, b.cy);
          ctx.restore();
        }

        // emojis
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          ctx.save();
          ctx.globalAlpha = it.alpha;
          const wobx = it.state === "fall" ? Math.sin(it.wob * 1.4) * 4 : 0;
          // halo autour de l'emoji surligné
          if (it.state === "hold") {
            ctx.save();
            ctx.globalAlpha = 0.45 + 0.15 * Math.sin(it.wob * 3);
            ctx.fillStyle = C.sun;
            ctx.beginPath();
            ctx.arc(it.x, it.y, FONT * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.translate(it.x + wobx, it.y);
          ctx.scale(it.scale, it.scale);
          ctx.font = FONT + "px system-ui, sans-serif";
          ctx.fillText(it.em, 0, 0);
          ctx.restore();
        }
      }

      // ---- cleanup ----
      api.onExit(function () {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        timers.forEach(function (t) { clearTimeout(t); });
        timers = [];
        wrap.removeEventListener("pointerdown", onDown);
      });

      // ---- go ----
      updateStatus();
      // quelques emojis de départ pour un plateau vivant
      spawn();
      later(function () { spawn(); }, 700);
      scheduleSpawn();
      rafId = requestAnimationFrame(frame);
    }
  });
})();
