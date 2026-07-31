/* =========================================================
   Emoji Hole — style "all in hole" (v3)
   Le trou suit ton doigt/curseur, avale tout ce qui est plus
   petit que lui, grossit, et peut alors gober plus gros.
   Chrono dynamique (+temps par palier/bonus), dangers 💣🌵,
   combo d'aspiration, vague finale, objet géant, fin enrichie.
   Responsive (portrait ET paysage), rendu doodle + effets.
   ========================================================= */
(function () {
  const TIERS = [
    { r: 13, val: 1,  emojis: ["🍬","🌰","🔩","🥜","🪙","🍒","🧿","🌸"] },
    { r: 20, val: 3,  emojis: ["🍔","📗","🧴","🪀","🥑","🧀","🍩","🎾"] },
    { r: 30, val: 8,  emojis: ["🎒","🪑","🧳","🖥️","🪴","🛒","🎸","⛑️"] },
    { r: 44, val: 22, emojis: ["🚲","🛵","🛋️","🚪","🗿","⛄"] },
    { r: 62, val: 60, emojis: ["🚗","🏠","🚌","🌳","🐘","🚜"] },
  ];
  // objets bonus : petits mais gros points + temps, brillants → à chasser
  const BONUS = { r: 15, val: 25, emojis: ["⭐","💎","🍭","🎁","💰"] };
  // objets DANGER : les avaler rétrécit le trou et vole du temps → à esquiver
  const DANGER = { r: 17, emojis: ["💣","🌵"] };
  const GIANTS = ["🏰","🛳️"];
  const TIME_START = 35, TIME_CAP = 90;

  window.ARCADE.register({
    id: "hole",
    title: "Emoji Hole",
    emoji: "🕳️",
    mount(board, api) {
      const C = api.colors;
      let dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%"; canvas.style.height = "100%";
      canvas.style.display = "block";
      // fond plus joli : pois légers + dégradé chaud, + vignette (tout en CSS, 0 dessin/image)
      canvas.style.background = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='54'%3E%3Ccircle cx='27' cy='27' r='2.2' fill='%239b7ede' opacity='0.07'/%3E%3C/svg%3E\") repeat, radial-gradient(circle at 50% 34%, #fffef9 0%, #fdeecd 70%, #f7dfb4 100%)";
      canvas.style.boxShadow = "inset 0 0 70px rgba(43,36,64,.14)";
      board.appendChild(canvas);
      const ctx = canvas.getContext("2d");

      // Halos mis en cache (sprites) : évite de recréer un dégradé par objet/image.
      function makeHalo(rgb) {
        const c = document.createElement("canvas"); c.width = c.height = 64;
        const x = c.getContext("2d");
        const g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
        g.addColorStop(0, "rgba(" + rgb + ",.6)"); g.addColorStop(1, "rgba(" + rgb + ",0)");
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        return c;
      }
      const halo = makeHalo("255,255,255");
      const haloRed = makeHalo("255,90,80"); // halo rougeâtre des dangers

      // Sprites d'emoji PRÉ-RENDUS : dessiner un emoji couleur avec fillText à
      // chaque image est très lent (surtout iOS). On le rend UNE fois dans un
      // petit canvas, puis on le recopie (drawImage) — beaucoup plus fluide.
      const SPR = 88, SPR_GIANT = 256;
      const spriteCache = {};
      function sprite(emoji, px) {
        px = px || SPR;
        const key = emoji + "@" + px;
        if (spriteCache[key]) return spriteCache[key];
        const c = document.createElement("canvas"); c.width = c.height = px;
        const cx = c.getContext("2d");
        cx.font = Math.floor(px * 0.8) + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',serif";
        cx.textAlign = "center"; cx.textBaseline = "middle";
        cx.fillText(emoji, px / 2, px / 2 + px * 0.04);
        spriteCache[key] = c;
        return c;
      }
      // pré-chauffe le cache avec tous les emojis possibles
      TIERS.forEach((t) => t.emojis.forEach((e) => sprite(e)));
      BONUS.emojis.forEach((e) => sprite(e));
      DANGER.emojis.forEach((e) => sprite(e));
      GIANTS.forEach((e) => sprite(e, SPR_GIANT));

      let W = 0, H = 0, S = 1;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      function scale() { S = Math.max(0.75, Math.min(2.4, Math.min(W, H) / 560)); }
      function resize() {
        // relit le dpr (changement d'écran / zoom) et réconcilie l'état
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = board.clientWidth; H = board.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scale();
        if (hole) {
          // re-clampe le trou et sa cible dans le nouveau canvas
          hole.r = Math.min(hole.r, maxR());
          hole.x = clamp(hole.x, hole.r, Math.max(hole.r, W - hole.r));
          hole.y = clamp(hole.y, hole.r, Math.max(hole.r, H - hole.r));
          hole.tx = clamp(hole.tx, hole.r, Math.max(hole.r, W - hole.r));
          hole.ty = clamp(hole.ty, hole.r, Math.max(hole.r, H - hole.r));
          // re-clampe les objets sortis des nouvelles limites
          for (const o of objects) {
            o.x = clamp(o.x, o.r, Math.max(o.r, W - o.r));
            o.y = clamp(o.y, o.r, Math.max(o.r, H - o.r));
          }
        }
      }

      let hole, objects, ripples, pops, score, timeLeft, running, shake, hintT;
      let combo, comboT, bestCombo, tiersEaten, elapsed, giantAt, giantSpawned, biggest, waveT, lastStatus, dangerCount;
      resize();

      function placeAway(r) {
        let x, y, tries = 0;
        do {
          x = r + Math.random() * Math.max(1, W - 2 * r);
          y = r + Math.random() * Math.max(1, H - 2 * r);
          tries++;
        } while (tries < 25 && Math.hypot(x - hole.x, y - hole.y) < hole.r + r + 40);
        return { x, y };
      }
      function spawnObj(forceEatable) {
        // ~9% : objet BONUS (petit, brillant, gros points + temps) à chasser
        if (Math.random() < 0.09) {
          const r = BONUS.r * S * (0.9 + Math.random() * 0.2);
          const p = placeAway(r);
          return { x: p.x, y: p.y, r, val: BONUS.val, emoji: BONUS.emojis[(Math.random() * BONUS.emojis.length) | 0], suck: false, bonus: true };
        }
        const cand = TIERS.map((t, i) => ({ t, i }));
        let pool = cand.filter((c) => (forceEatable ? c.t.r * S <= hole.r : true));
        if (!pool.length) pool = cand;
        const weights = pool.map((c) => {
          const ratio = (c.t.r * S) / hole.r;
          if (ratio <= 1.0) return 4;
          if (ratio <= 1.7) return 2;
          return 1;
        });
        let tot = weights.reduce((a, b) => a + b, 0), pick = Math.random() * tot, k = 0;
        while (pick > weights[k]) { pick -= weights[k]; k++; }
        const t = pool[k].t;
        // forcé mangeable → facteur ≤ 1 (sinon l'aléa ×1.15 peut le rendre trop gros)
        const f = forceEatable ? (0.85 + Math.random() * 0.15) : (0.85 + Math.random() * 0.3);
        const r = t.r * S * f;
        const p = placeAway(r);
        return { x: p.x, y: p.y, r, val: t.val, emoji: t.emojis[(Math.random() * t.emojis.length) | 0], suck: false, tier: pool[k].i };
      }
      function spawnDanger() {
        const r = DANGER.r * S * (0.9 + Math.random() * 0.2);
        const p = placeAway(r);
        return { x: p.x, y: p.y, r, val: 0, emoji: DANGER.emojis[(Math.random() * DANGER.emojis.length) | 0], suck: false, danger: true };
      }
      function spawnSmall() { // vague finale : petits objets rapides à gober
        const i = Math.random() < 0.6 ? 0 : 1;
        const t = TIERS[i];
        const r = t.r * S * (0.85 + Math.random() * 0.15);
        const p = placeAway(r);
        return { x: p.x, y: p.y, r, val: t.val, emoji: t.emojis[(Math.random() * t.emojis.length) | 0], suck: false, tier: i };
      }

      const maxR = () => Math.min(W, H) * 0.36;
      function targetCount() {
        return Math.max(16, Math.min(60, Math.round((W * H) / (11000 * S * S))));
      }
      let startR = 26;
      function reset() {
        startR = 26 * S;
        hole = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, r: startR, pulse: 0, ang: 0 };
        objects = []; ripples = []; pops = [];
        const n = targetCount();
        for (let i = 0; i < n; i++) objects.push(spawnObj(i < n * 0.6));
        dangerCount = Math.random() < 0.5 ? 2 : 3;
        for (let i = 0; i < dangerCount; i++) objects.push(spawnDanger());
        score = 0; timeLeft = TIME_START; running = true; shake = 0; hintT = 3;
        combo = 1; comboT = 0; bestCombo = 1; tiersEaten = new Set();
        elapsed = 0; giantAt = 25 + Math.random() * 15; giantSpawned = false;
        biggest = { r: 0, emoji: "" }; waveT = 0; lastStatus = "";
        removePanel(); pushStatus(true);
      }
      const status = () => `⏱️ ${Math.ceil(timeLeft)}s · 🏆 ${score} · ×${combo} · 🕳️×${(hole.r / startR).toFixed(1)}`;
      // throttle : innerHTML seulement quand le texte change (≈ 1×/s + événements)
      function pushStatus(force) {
        const st = status();
        if (force || st !== lastStatus) { lastStatus = st; api.setStatus(st); }
      }

      /* ---------- Contrôle : le trou se place AU-DESSUS du doigt (on ne le cache plus) ---------- */
      function pointAt(e) {
        const rct = canvas.getBoundingClientRect();
        const off = 24;   // petit décalage fixe vers le haut (on voit le trou, sans être perdu)
        hole.tx = Math.max(hole.r, Math.min(W - hole.r, e.clientX - rct.left));
        hole.ty = Math.max(hole.r, Math.min(H - hole.r, e.clientY - rct.top - off));
      }
      // Multi-touch : un seul pointeur "pilote" (le premier posé). Les autres sont
      // ignorés, et setPointerCapture garde le suivi même hors du canvas.
      let activeId = null;
      const onDown = (e) => {
        if (activeId !== null) { e.preventDefault(); return; } // 2e doigt → ignoré
        activeId = e.pointerId;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        pointAt(e); e.preventDefault();
      };
      const onMove = (e) => {
        // souris : suit au survol ; tactile : suit le pointeur capturé uniquement
        if (e.pointerId === activeId || (e.pointerType === "mouse" && activeId === null)) {
          pointAt(e); e.preventDefault();
        }
      };
      const onUp = (e) => {
        if (e.pointerId !== activeId) return; // lever d'un doigt "passager" → rien
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
        activeId = null;
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      const onResize = () => resize();
      window.addEventListener("resize", onResize);

      /* ---------- Fin ---------- */
      let panel = null;
      function removePanel() { if (panel) { panel.remove(); panel = null; } }
      function endGame() {
        running = false;
        const hadBest = api.hasBest("hole");
        const prev = api.getBest("hole");
        const { best, isNew } = api.setBest("hole", score);
        api.soundWin(); if (isNew && score > 0) api.confetti();
        let delta = "";
        if (hadBest) {
          if (isNew) delta = `Record battu de <b>+${score - prev}</b> 🎉`;
          else if (score === best) delta = "Record égalé !";
          else delta = `À <b>${best - score}</b> pts du record`;
        }
        panel = document.createElement("div");
        panel.className = "ar-overlay";
        panel.innerHTML =
          `<h2>Temps écoulé ⏱️</h2>` +
          (isNew && score > 0 ? `<p style="margin:2px 0 8px;font-weight:700;color:${C.coral};font-size:1.15em">✨ Nouveau record ! ✨</p>` : "") +
          `<p style="line-height:1.7">Score : <b>${score}</b> · Record : <b>${best}</b><br>` +
          `Meilleur combo : <b>×${bestCombo}</b> · Plus gros avalé : <span style="font-size:1.4em;vertical-align:middle">${biggest.emoji || "—"}</span>` +
          (delta ? `<br><span style="opacity:.85">${delta}</span>` : "") +
          `</p><button class="ar-btn" id="holeReplay">Rejouer</button>`;
        board.appendChild(panel);
        panel.querySelector("#holeReplay").addEventListener("click", () => reset());
        pushStatus(true);
      }

      function addTime(sec, x, y) {
        timeLeft = Math.min(TIME_CAP, timeLeft + sec);
        pops.push({ x, y, txt: "+" + sec + "s ⏱️", life: 1.2, good: true });
      }
      function eat(o) {
        o.suck = true;
        // combo d'aspiration : < 1,5 s entre deux → ×2…×5, sinon retour ×1
        combo = comboT > 0 ? Math.min(5, combo + 1) : 1;
        comboT = 1.5;
        if (combo > bestCombo) bestCombo = combo;
        const pts = o.val * combo;
        score += pts;
        if (o.r > biggest.r) biggest = { r: o.r, emoji: o.emoji };
        const before = hole.r;
        hole.r = Math.min(maxR(), hole.r + o.val * 0.05 * S + 0.7 * S);
        hole.pulse = 1;
        ripples.push({ x: hole.x, y: hole.y, r: hole.r, a: 0.6 });
        pops.push({ x: o.x, y: o.y, txt: "+" + pts + (combo > 1 ? " ×" + combo : ""), life: 1 });
        if (hole.r - before > 1.2) shake = Math.min(1, shake + 0.5);
        // chrono dynamique : +3 s au premier objet d'un nouveau palier, +2 s par bonus doré
        let t = 0;
        if (o.tier != null && !tiersEaten.has(o.tier)) { tiersEaten.add(o.tier); t += 3; }
        if (o.bonus) t += 2;
        if (t) { addTime(t, o.x, o.y - 20 * S); api.soundGood(); }
        if (o.giant) { api.soundWin(); api.confetti(); shake = 1; }
        api.beep(200 + Math.min(700, o.val * 8), 0.05, "sine", 0.06);
        api.vibrate(o.bonus ? [10, 25, 12] : 9);
      }
      function eatDanger(o) {
        o.suck = true;
        hole.r = Math.max(startR * 0.7, hole.r * 0.85); // rétrécit de 15 %
        timeLeft = Math.max(0, timeLeft - 3);            // vole 3 s
        combo = 1; comboT = 0;                           // casse le combo
        hole.pulse = 1; shake = 1;
        pops.push({ x: o.x, y: o.y, txt: "-3s 💥", life: 1.2, bad: true });
        api.soundBad();
      }

      /* ---------- Boucle ---------- */
      let raf = 0, last = performance.now();
      function frame(ts) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (ts - last) / 1000); last = ts;

        if (running) {
          timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; endGame(); }
          elapsed += dt;
          if (hintT > 0) hintT -= dt;
          if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 1; }
          const k = Math.min(1, dt * 26);   // suivi quasi direct (très réactif)
          hole.x += (hole.tx - hole.x) * k;
          hole.y += (hole.ty - hole.y) * k;
          hole.ang += dt * 0.6;
          hole.pulse *= (1 - dt * 4);
          shake *= (1 - dt * 5);

          // objet GÉANT : 1 par partie, vers 25-40 s — objectif de build du run
          if (!giantSpawned && elapsed >= giantAt) {
            giantSpawned = true;
            const r = Math.min(hole.r * 1.6, maxR() * 0.92);
            const p = placeAway(r);
            objects.push({ x: p.x, y: p.y, r, val: 150, emoji: GIANTS[(Math.random() * GIANTS.length) | 0], suck: false, giant: true });
          }
          // VAGUE FINALE : 10 dernières secondes → pluie de petits objets
          if (timeLeft > 0 && timeLeft <= 10) {
            waveT -= dt;
            if (waveT <= 0 && objects.length < targetCount() + 16) {
              waveT = 0.55;
              objects.push(spawnSmall());
            }
          }

          for (const o of objects) {
            const dx = hole.x - o.x, dy = hole.y - o.y, dist = Math.hypot(dx, dy) || 0.001;
            if (o.suck) { o.x += dx * Math.min(1, dt * 10); o.y += dy * Math.min(1, dt * 10); o.r *= (1 - dt * 6); continue; }
            const eatable = o.r <= hole.r * 1.03;   // marge d'avalage plus généreuse
            const reach = hole.r + o.r;
            if (dist < reach * 2.1 && !o.danger) {  // les dangers ne sont PAS aspirés : l'esquive reste un geste
              const pull = eatable ? (1 - dist / (reach * 2.1)) * 9 : 0.5;
              o.x += dx / dist * pull * dt * 30;
              o.y += dy / dist * pull * dt * 30;
            }
            if (eatable && dist < hole.r * 0.92) { if (o.danger) eatDanger(o); else eat(o); }
          }
          for (let i = objects.length - 1; i >= 0; i--) {
            const o = objects[i];
            if (o.suck && o.r < 4 * S) {
              objects.splice(i, 1);
              if (o.danger) objects.push(spawnDanger());        // garde 2-3 dangers à l'écran
              else if (!o.giant) objects.push(spawnObj(Math.random() < 0.6));
            }
          }
          for (let i = ripples.length - 1; i >= 0; i--) { const rp = ripples[i]; rp.r += dt * 220; rp.a -= dt * 1.4; if (rp.a <= 0) ripples.splice(i, 1); }
          for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt * 1.4; pops[i].y -= dt * 40; if (pops[i].life <= 0) pops.splice(i, 1); }
          pushStatus();
        }
        draw();
      }

      function draw() {
        ctx.save();
        if (shake > 0.02) ctx.translate((Math.random() - 0.5) * 6 * shake, (Math.random() - 0.5) * 6 * shake);
        ctx.clearRect(-8, -8, W + 16, H + 16);

        // objets : halo (sprite) + ombre légère + emoji
        for (const o of objects) {
          const hs = o.r * 2.3;
          ctx.drawImage(o.danger ? haloRed : halo, o.x - hs / 2, o.y - hs / 2, hs, hs);
          // objet BONUS : anneau doré scintillant
          if (o.bonus && !o.suck) {
            ctx.save();
            ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(hole.ang * 3));
            ctx.strokeStyle = "#ffd23e"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.25, 0, 7); ctx.stroke();
            ctx.restore();
          }
          // objet DANGER : anneau rouge pulsant (bien distinct)
          if (o.danger && !o.suck) {
            ctx.save();
            ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(hole.ang * 4));
            ctx.strokeStyle = C.coral; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.3, 0, 7); ctx.stroke();
            ctx.restore();
          }
          // objet GÉANT : anneau pointillé, doré puis VERT quand il devient mangeable
          if (o.giant && !o.suck) {
            ctx.save();
            ctx.globalAlpha = 0.55 + 0.4 * Math.abs(Math.sin(hole.ang * 2.5));
            ctx.strokeStyle = o.r <= hole.r * 1.03 ? C.lime : C.sun; ctx.lineWidth = 4;
            ctx.setLineDash([12, 8]);
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.12, 0, 7); ctx.stroke();
            ctx.restore();
          }
          // ombre douce
          ctx.globalAlpha = 0.13; ctx.fillStyle = "#000";
          ctx.beginPath(); ctx.ellipse(o.x, o.y + o.r * 0.62, o.r * 0.62, o.r * 0.2, 0, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
          const s = o.r * 2.1;
          ctx.drawImage(sprite(o.emoji, o.giant ? SPR_GIANT : SPR), o.x - s / 2, o.y - s / 2, s, s);
        }

        // ondes d'aspiration
        for (const rp of ripples) {
          ctx.globalAlpha = Math.max(0, rp.a); ctx.strokeStyle = C.grape; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, 7); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // le trou
        const R = hole.r * (1 + 0.18 * Math.max(0, hole.pulse));
        // glow externe
        const og = ctx.createRadialGradient(hole.x, hole.y, R * 0.6, hole.x, hole.y, R * 1.5);
        og.addColorStop(0, "rgba(43,36,64,.28)"); og.addColorStop(1, "rgba(43,36,64,0)");
        ctx.fillStyle = og; ctx.beginPath(); ctx.arc(hole.x, hole.y, R * 1.5, 0, 7); ctx.fill();
        // corps
        const g = ctx.createRadialGradient(hole.x - R * 0.2, hole.y - R * 0.2, R * 0.15, hole.x, hole.y, R);
        g.addColorStop(0, "#0a0a14"); g.addColorStop(0.75, "#181428"); g.addColorStop(1, "#3a3358");
        ctx.beginPath(); ctx.arc(hole.x, hole.y, R, 0, 7); ctx.fillStyle = g; ctx.fill();
        // anneau encre pointillé qui tourne (doodle)
        ctx.save();
        ctx.translate(hole.x, hole.y); ctx.rotate(hole.ang);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 3.5; ctx.setLineDash([R * 0.5, R * 0.32]);
        ctx.beginPath(); ctx.arc(0, 0, R + 1.5, 0, 7); ctx.stroke();
        ctx.restore();
        // reflet
        ctx.beginPath(); ctx.arc(hole.x - R * 0.32, hole.y - R * 0.36, R * 0.16, 0, 7);
        ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fill();

        // COMBO : multiplicateur gros et joyeux, juste au-dessus du trou
        if (running && combo > 1) {
          const cs = Math.round((16 + combo * 4) * S * (1 + 0.25 * Math.max(0, hole.pulse)));
          ctx.font = "700 " + cs + "px Fredoka, sans-serif"; ctx.textAlign = "center";
          ctx.lineWidth = Math.max(3, cs * 0.16); ctx.strokeStyle = C.paper;
          const cy = Math.max(cs, hole.y - R - 12 * S);
          ctx.strokeText("×" + combo, hole.x, cy);
          ctx.fillStyle = combo >= 4 ? C.coral : C.tang;
          ctx.fillText("×" + combo, hole.x, cy);
        }

        // "+N" flottants (verts = temps gagné, rouges = danger)
        for (const p of pops) {
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.bad ? C.coral : (p.good ? C.lime : C.ink);
          ctx.font = "700 " + (16 * S) + "px Fredoka, sans-serif";
          ctx.textAlign = "center"; ctx.fillText(p.txt, p.x, p.y);
        }
        ctx.globalAlpha = 1;

        // VAGUE FINALE : chrono géant dans le canvas, rouge qui pulse
        if (running && timeLeft <= 10) {
          const pu = 1 + 0.14 * Math.abs(Math.sin(timeLeft * Math.PI)); // pulse à chaque seconde
          const fs = Math.round(58 * S * pu);
          const txt = String(Math.ceil(timeLeft));
          ctx.globalAlpha = 0.9;
          ctx.font = "700 " + fs + "px Fredoka, sans-serif"; ctx.textAlign = "center";
          ctx.lineWidth = Math.max(4, fs * 0.1); ctx.strokeStyle = "rgba(255,248,236,.9)";
          ctx.strokeText(txt, W / 2, 72 * S);
          ctx.fillStyle = C.coral; ctx.fillText(txt, W / 2, 72 * S);
          ctx.globalAlpha = 1;
        }

        // indice de départ
        if (hintT > 0 && running) {
          ctx.globalAlpha = Math.min(1, hintT) * 0.9;
          ctx.fillStyle = C.ink; ctx.font = "600 " + (17 * S) + "px Fredoka, sans-serif"; ctx.textAlign = "center";
          ctx.fillText("Glisse ton doigt · avale · évite 💣🌵 · vise les ⭐", W / 2, H - 26 * S);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      reset();
      raf = requestAnimationFrame(frame);
      api.onExit(() => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); });
    },
  });
})();
