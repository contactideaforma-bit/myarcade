/* =========================================================
   Désinfecte ta chambre — jeu d'objets cachés (v1)

   On cherche des microbes cachés dans une chambre d'enfant :
   pincer pour zoomer, glisser pour se déplacer, taper pour
   désinfecter. Quand la chambre est propre, niveau suivant.

   Aucun échec possible : le temps ne sert qu'à donner 1 à 3 ⭐.

   Trois choix structurants :
   1) CAMÉRA ZOOM/PAN sur l'image de la chambre. Tout est en
      coordonnées IMAGE, converties à l'affichage (`toScreen`).
   2) TOLÉRANCE DE CLIC EN PIXELS ÉCRAN : le rayon de détection
      vaut au moins ~18 px à l'écran, donc il RÉTRÉCIT dans
      l'image quand on dézoome. Taper au hasard en vue d'ensemble
      ne marche pas — il faut vraiment zoomer.
   3) CARTE D'ENCOMBREMENT par chambre (`clutter`, calculée hors
      ligne sur l'image) : plus le niveau monte, plus les microbes
      sont placés dans les zones chargées (le tas de peluches
      plutôt que le plafond nu). Le placement est aussi tiré d'un
      générateur PSEUDO-ALÉATOIRE GRAINÉ par le numéro de niveau →
      un niveau donné est toujours identique, donc rejouable et
      comparable en temps.
   ========================================================= */
(function () {
  const KEY = "arc_germs_v1";
  const BASE = "assets/germs/";

  const ROOMS = [
    { id: "pastel", c1: "#907b77", c2: "#77564a", name: "Chambre pastel", emoji: "🛏️", w: 820, h: 1435, cols: 10, rows: 18,
      clutter: ["0000000000", "0000100000", "0000100011", "0011221100", "0012120110", "1000015550", "3333423252", "3445413342", "1125613141", "0012615420", "3376536433", "3544647674", "4786747674", "3896457535", "5444342233", "1343345521", "1112223351", "0111114251"] },
    { id: "licorne", c1: "#675856", c2: "#4d3d33", name: "Chambre licorne", emoji: "🦄", w: 820, h: 1435, cols: 10, rows: 18,
      clutter: ["0000000000", "0000000000", "1000111000", "1221222221", "1232555522", "1123442611", "1113231621", "1212221511", "1212221521", "3235211555", "6346877586", "9855676586", "3353222467", "6545442444", "6665444444", "5665444444", "6555555555", "5545555555"] },
    { id: "peluches", c1: "#9a7174", c2: "#69404c", name: "Chambre aux peluches", emoji: "🧸", w: 820, h: 1435, cols: 10, rows: 18,
      clutter: ["0000021100", "0000000100", "2211000000", "3312111100", "2411222111", "1421223254", "1333322465", "1332212366", "1321211443", "4442232264", "4465455473", "5465656675", "3567776689", "5667686788", "5656325757", "6542235667", "3333223444", "3332222442"] },
    { id: "superpose", c1: "#82657e", c2: "#7e5a68", name: "Chambre des lits superposés", emoji: "🪜", w: 820, h: 1054, cols: 10, rows: 13,
      clutter: ["1044410000", "1243331111", "2442231354", "7752354466", "5565566667", "2333455446", "2321346232", "5544579898", "6664365566", "6766788555", "7779978766", "4777555785", "3452557753"] },
  ];
  const BUGS = ["pink", "red", "greenoval", "blue", "greenrod", "yellow"];

  const HINTS = 3;          // coups de loupe par niveau
  const HINT_COST = 8;      // secondes ajoutées au chrono des ⭐

  // pseudo-aléatoire grainé : un niveau donné a toujours la même disposition
  function rngFor(seed) {
    let a = (seed * 1831565813 + 0x6d2b79f5) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  window.ARCADE.register({
    id: "germs", title: "Désinfecte ta chambre", emoji: "🧼",
    mount(board, api) {
      const C = api.colors;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

      /* ================= Sauvegarde ================= */
      function load() {
        const d = { v: 1, lvl: 0, maxLvl: 0, stars: {} };
        try {
          const s = JSON.parse(localStorage.getItem(KEY) || "null");
          if (s && s.v === 1) {
            d.lvl = Math.max(0, s.lvl | 0); d.maxLvl = Math.max(0, s.maxLvl | 0);
            if (s.stars && typeof s.stars === "object") {
              Object.keys(s.stars).forEach((k) => { const n = s.stars[k] | 0; if (n > 0) d.stars[k] = Math.min(3, n); });
            }
          }
        } catch (e) {}
        d.lvl = Math.min(d.lvl, d.maxLvl);
        return d;
      }
      function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
      const save = load();

      const roomOf = (n) => ROOMS[n % ROOMS.length];
      const countOf = (n) => Math.min(24, 3 + Math.round(n * 1.3));
      const sizeOf = (n) => Math.max(46, 120 - n * 6);          // diamètre en pixels image
      const parOf = (n) => 10 + countOf(n) * 3.5;

      /* ================= Chargement des images ================= */
      const imgs = {}; let pending = 0, ready = false;
      function loadImg(key, src) {
        pending++;
        const im = new Image();
        im.onload = im.onerror = () => { if (--pending === 0) { ready = true; onReady(); } };
        im.src = src; imgs[key] = im;
      }
      ROOMS.forEach((r) => loadImg("room_" + r.id, BASE + "rooms/" + r.id + ".jpg"));
      BUGS.forEach((b) => loadImg("bug_" + b, BASE + "bugs/" + b + ".png"));

      /* ================= Canvas + HUD ================= */
      let dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:none;background:#20182e;";
      board.appendChild(canvas);
      const ctx = canvas.getContext("2d");

      const style = document.createElement("style");
      style.textContent = `
        .ar-title{font-size:clamp(.88rem,3.7vw,1.15rem);}
        .gm-hud{position:absolute;left:8px;right:8px;top:8px;z-index:4;
          display:flex;flex-direction:column;align-items:center;gap:4px;
          font-family:Fredoka,sans-serif;pointer-events:none;}
        .gm-name{font-weight:700;font-size:clamp(12px,3.4vw,16px);color:${C.ink};
          background:rgba(255,255,255,.86);border:2.5px solid ${C.ink};border-radius:14px;
          padding:2px 12px;box-shadow:0 3px 0 ${C.ink};white-space:nowrap;}
        .gm-row{display:flex;gap:6px;align-items:center;pointer-events:auto;}
        .gm-chip{font-weight:700;font-size:clamp(11px,3.1vw,15px);color:${C.ink};
          background:rgba(255,255,255,.9);border:2.5px solid ${C.ink};border-radius:13px;
          padding:3px 10px;box-shadow:0 3px 0 ${C.ink};white-space:nowrap;}
        .gm-btn{font-family:Fredoka;font-weight:700;font-size:clamp(11px,3.1vw,15px);color:${C.ink};
          background:${C.sun};border:2.5px solid ${C.ink};border-radius:13px;padding:3px 10px;
          box-shadow:0 3px 0 ${C.ink};cursor:pointer;white-space:nowrap;}
        .gm-btn:active{transform:translateY(2px);box-shadow:0 1px 0 ${C.ink};}
        .gm-btn.off{background:#ded9e8;color:#8b85a0;box-shadow:0 3px 0 #b6b0c6;}
        .gm-ov{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;
          background:rgba(20,14,32,.72);padding:12px;overflow-y:auto;-webkit-overflow-scrolling:touch;}
        .gm-card{width:100%;max-width:340px;background:${C.paper};border:4px solid ${C.ink};border-radius:22px;
          box-shadow:0 8px 0 ${C.ink},0 16px 34px rgba(0,0,0,.4);padding:16px;text-align:center;
          display:flex;flex-direction:column;gap:10px;max-height:100%;overflow-y:auto;}
        .gm-card h2{margin:0;font-size:1.25rem;}
        .gm-card p{margin:0;font-family:'Patrick Hand',cursive;font-size:1rem;line-height:1.3;}
        .gm-big{display:block;width:100%;box-sizing:border-box;font-family:Fredoka;font-weight:700;
          font-size:.95rem;color:${C.ink};background:${C.sun};border:3px solid ${C.ink};
          border-radius:14px;padding:10px 12px;box-shadow:0 4px 0 ${C.ink};cursor:pointer;}
        .gm-big:active{transform:translateY(3px);box-shadow:0 1px 0 ${C.ink};}
        .gm-big.g{background:${C.lime};}
        .gm-big.w{background:#fff;}
        .gm-stars{font-size:2.1rem;letter-spacing:2px;line-height:1;}
        .gm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
        .gm-tile{background:#fff;border:3px solid ${C.ink};border-radius:14px;box-shadow:0 3px 0 ${C.ink};
          padding:7px 3px 5px;cursor:pointer;display:flex;flex-direction:column;align-items:center;
          gap:1px;font-family:Fredoka;}
        .gm-tile:active{transform:translateY(2px);box-shadow:0 1px 0 ${C.ink};}
        .gm-tile .e{font-size:1.45rem;line-height:1.1;}
        .gm-tile .n{font-size:.62rem;font-weight:600;}
        .gm-tile .s{font-size:.6rem;letter-spacing:-1px;height:.8em;}
        .gm-tile .l{font-family:'Patrick Hand',cursive;font-size:.6rem;opacity:.55;}
        .gm-tile.lock{background:#e9e5f0;color:#9a94ab;cursor:default;box-shadow:0 3px 0 #b8b2c6;border-color:#b8b2c6;}
        .gm-tile.cur{background:${C.sun};}
      `;
      board.appendChild(style);

      const hud = document.createElement("div");
      hud.className = "gm-hud";
      hud.innerHTML = `<div class="gm-name" id="gmName">…</div>
        <div class="gm-row">
          <span class="gm-chip" id="gmCount">🦠 0/0</span>
          <button class="gm-btn" id="gmHint">💡 3</button>
          <button class="gm-btn" id="gmWide">🔍 vue</button>
        </div>`;
      board.appendChild(hud);
      const nameEl = hud.querySelector("#gmName"), countEl = hud.querySelector("#gmCount"),
            hintBtn = hud.querySelector("#gmHint"), wideBtn = hud.querySelector("#gmWide");

      /* ================= État ================= */
      let W = 0, H = 0, uiS = 1;
      let level = save.lvl, room = roomOf(level), bugs = [], found = 0;
      let view = { s: 1, x: 0, y: 0 };            // s = px écran par px image ; x,y = point image au centre
      let tween = null, minS = 1, maxS = 6;
      let playing = false, elapsed = 0, hints = HINTS, penalty = 0;
      let fx = [], ring = null, hintT = 0;
      let dead = false, doneTimer = 0;   // garde-fou : rien ne doit survivre à api.onExit

      function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = board.clientWidth; H = board.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        uiS = clamp(Math.min(W, H) / 480, 0.7, 2);
        recomputeLimits();
      }
      function recomputeLimits() {
        if (!room || !W || !H) return;
        minS = Math.min(W / room.w, H / room.h);
        maxS = minS * 6;
        view.s = clamp(view.s, minS, maxS);
        clampView();
      }
      function clampView() {
        const hw = W / 2 / view.s, hh = H / 2 / view.s;
        view.x = hw * 2 >= room.w ? room.w / 2 : clamp(view.x, hw, room.w - hw);
        view.y = hh * 2 >= room.h ? room.h / 2 : clamp(view.y, hh, room.h - hh);
      }
      const toScreen = (ix, iy) => ({ x: W / 2 + (ix - view.x) * view.s, y: H / 2 + (iy - view.y) * view.s });
      const toImage = (sx, sy) => ({ x: view.x + (sx - W / 2) / view.s, y: view.y + (sy - H / 2) / view.s });

      /* ================= Construction d'un niveau ================= */
      function startLevel(n) {
        level = n; room = roomOf(n);
        const rnd = rngFor(n * 7919 + 13);
        const count = countOf(n), size = sizeOf(n), bias = Math.min(1, n / 8);

        // tirage pondéré par l'encombrement : plus le niveau monte, plus on vise les zones chargées
        const cells = [];
        for (let j = 0; j < room.rows; j++) {
          for (let i = 0; i < room.cols; i++) {
            const c = +room.clutter[j][i];
            cells.push({ i, j, wgt: 1 + bias * c * 2.2 });
          }
        }
        const totW = cells.reduce((a, c) => a + c.wgt, 0);
        const cw = room.w / room.cols, ch = room.h / room.rows;

        bugs = [];
        for (let k = 0; k < count; k++) {
          let px = 0, py = 0, ok = false;
          for (let tr = 0; tr < 120 && !ok; tr++) {
            let pick = rnd() * totW, ci = 0;
            while (pick > cells[ci].wgt && ci < cells.length - 1) { pick -= cells[ci].wgt; ci++; }
            const c = cells[ci];
            px = clamp((c.i + rnd()) * cw, size * 0.6, room.w - size * 0.6);
            py = clamp((c.j + rnd()) * ch, size * 0.6, room.h - size * 0.6);
            ok = true;
            for (const b of bugs) if (Math.hypot(px - b.x, py - b.y) < size * 1.25) { ok = false; break; }
          }
          bugs.push({
            x: px, y: py, r: size / 2, found: false,
            img: BUGS[(rnd() * BUGS.length) | 0],
            rot: (rnd() - 0.5) * 0.9, ph: rnd() * 7, fade: 0,
          });
        }
        found = 0; elapsed = 0; hints = HINTS; penalty = 0;
        fx = []; ring = null; hintT = 0;
        view = { s: 1, x: room.w / 2, y: room.h / 2 };
        recomputeLimits(); view.s = minS; clampView();
        tween = null; playing = true;
        save.lvl = n; save.maxLvl = Math.max(save.maxLvl, n); persist();
        api.setBest("germs", n + 1);
        removeOverlay(); updateHud(true);
      }

      /* ================= HUD ================= */
      let lastHud = "";
      function updateHud(force) {
        const sig = level + "|" + found + "|" + hints;
        if (!force && sig === lastHud) return;
        lastHud = sig;
        nameEl.textContent = room.emoji + " " + room.name + " · niveau " + (level + 1);
        countEl.textContent = "🦠 " + found + "/" + bugs.length;
        hintBtn.textContent = "💡 " + hints;
        hintBtn.classList.toggle("off", hints <= 0);
        api.setStatus("niv. " + (level + 1) + " · " + found + "/" + bugs.length);
      }

      /* ================= Interactions ================= */
      const pointers = new Map();
      let pinch = null, dragged = false, downT = 0, downPt = null, lastTap = 0;

      function evPos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

      function onDown(e) {
        if (!playing || !ready) return;
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, evPos(e));
        if (pointers.size === 1) { dragged = false; downT = performance.now(); downPt = evPos(e); tween = null; }
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
          dragged = true;
        }
        e.preventDefault();
      }
      function onMove(e) {
        if (!pointers.has(e.pointerId)) return;
        const prev = pointers.get(e.pointerId), now = evPos(e);
        pointers.set(e.pointerId, now);
        if (pointers.size === 2 && pinch) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          zoomAt(m, (d || 1) / (pinch.d || 1));
          view.x -= (m.x - pinch.m.x) / view.s; view.y -= (m.y - pinch.m.y) / view.s;
          clampView(); pinch = { d, m };
        } else if (pointers.size === 1) {
          const dx = now.x - prev.x, dy = now.y - prev.y;
          if (Math.hypot(now.x - downPt.x, now.y - downPt.y) > 8) dragged = true;
          view.x -= dx / view.s; view.y -= dy / view.s; clampView();
        }
        e.preventDefault();
      }
      function onUp(e) {
        if (!pointers.has(e.pointerId)) return;
        const p = pointers.get(e.pointerId);
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (pointers.size === 0 && !dragged && performance.now() - downT < 400) {
          const now = performance.now();
          if (now - lastTap < 300) { zoomAt(p, 2); clampView(); lastTap = 0; }
          else { lastTap = now; tap(p); }
        }
      }
      function zoomAt(pt, factor) {
        const before = toImage(pt.x, pt.y);
        view.s = clamp(view.s * factor, minS, maxS);
        view.x = before.x - (pt.x - W / 2) / view.s;
        view.y = before.y - (pt.y - H / 2) / view.s;
        clampView();
      }
      function onWheel(e) { if (!playing) return; e.preventDefault(); zoomAt(evPos(e), e.deltaY < 0 ? 1.18 : 1 / 1.18); }

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      const onResize = () => resize();
      window.addEventListener("resize", onResize);

      /* ---------- Toucher un microbe ----------
         La tolérance vaut au moins ~18 px À L'ÉCRAN : en vue d'ensemble
         elle est donc minuscule dans l'image → il faut zoomer pour viser. */
      function tap(pt) {
        const p = toImage(pt.x, pt.y);
        let best = null, bd = 1e9;
        for (const b of bugs) {
          if (b.found) continue;
          const d = Math.hypot(p.x - b.x, p.y - b.y);
          const tol = Math.max(b.r * 0.85, 18 / view.s);
          if (d < tol && d < bd) { bd = d; best = b; }
        }
        if (best) hit(best, pt);
        else miss(pt);
      }
      function hit(b, pt) {
        b.found = true; b.fade = 1; found++;
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * 7, sp = 40 + Math.random() * 110;
          fx.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 1, r: b.r * (0.12 + Math.random() * 0.14) });
        }
        api.soundGood(); api.beep(720, 0.06, "triangle", 0.06); api.vibrate([8, 20, 10]);
        updateHud(true);
        if (found >= bugs.length) doneTimer = setTimeout(levelDone, 450);
      }
      function miss(pt) {
        const p = toImage(pt.x, pt.y);
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * 7, sp = 20 + Math.random() * 50;
          fx.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, r: 6 / view.s, pale: true });
        }
        api.beep(180, 0.04, "sine", 0.03); api.vibrate(4);
      }

      /* ---------- Loupe ---------- */
      hintBtn.addEventListener("click", () => {
        if (!playing || hints <= 0) return;
        const rest = bugs.filter((b) => !b.found);
        if (!rest.length) return;
        const b = rest[(Math.random() * rest.length) | 0];
        hints--; penalty += HINT_COST;
        ring = { x: b.x, y: b.y, r: b.r }; hintT = 3;
        tween = { s: Math.max(view.s, minS * 2.6), x: b.x, y: b.y, t: 0 };
        api.beep(880, 0.08, "sine", 0.05);
        updateHud(true);
      });
      wideBtn.addEventListener("click", () => {
        if (!playing) return;
        tween = { s: minS, x: room.w / 2, y: room.h / 2, t: 0 };
      });

      /* ================= Overlays ================= */
      let ov = null;
      function removeOverlay() { if (ov) { ov.remove(); ov = null; } }
      function overlay(html) {
        if (dead) return document.createElement("div");
        removeOverlay();
        ov = document.createElement("div"); ov.className = "gm-ov";
        ov.innerHTML = `<div class="gm-card">${html}</div>`;
        board.appendChild(ov); return ov;
      }
      const starsFor = (t) => { const p = parOf(level); return t <= p ? 3 : t <= p * 1.7 ? 2 : 1; };

      function levelDone() {
        doneTimer = 0;
        if (dead) return;
        playing = false;
        const t = elapsed + penalty, st = starsFor(t);
        if (st > (save.stars[level] || 0)) save.stars[level] = st;
        const next = level + 1;
        save.maxLvl = Math.max(save.maxLvl, next); save.lvl = next; persist();
        api.setBest("germs", next + 1);
        api.win();
        const nr = roomOf(next);
        const o = overlay(`
          <h2>✨ Chambre désinfectée !</h2>
          <div class="gm-stars">${"⭐".repeat(st)}${"☆".repeat(3 - st)}</div>
          <p><b>${bugs.length} microbes</b> attrapés en <b>${Math.round(elapsed)} s</b>
             ${penalty ? `<br><span style="opacity:.7">+${penalty} s de loupe</span>` : ""}
             ${st < 3 ? `<br><span style="opacity:.7">3 ⭐ en moins de ${Math.round(parOf(level))} s</span>` : ""}</p>
          <button class="gm-big g" data-a="next">${nr.emoji} Niveau ${next + 1} · ${countOf(next)} microbes</button>
          <button class="gm-big w" data-a="again">↺ Refaire ce niveau</button>
          <button class="gm-big w" data-a="map">🗺️ Carte des niveaux</button>`);
        o.addEventListener("click", (e) => {
          const b = e.target.closest("[data-a]"); if (!b) return;
          if (b.dataset.a === "next") startLevel(next);
          else if (b.dataset.a === "again") startLevel(level);
          else openMap();
        });
      }

      function openMap() {
        playing = false;
        let tiles = "";
        for (let n = 0; n <= save.maxLvl + 1; n++) {
          const r = roomOf(n), locked = n > save.maxLvl, st = save.stars[n] || 0;
          tiles += `<div class="gm-tile ${locked ? "lock" : n === save.lvl ? "cur" : ""}" ${locked ? "" : `data-n="${n}"`}>
            <span class="e">${locked ? "🔒" : r.emoji}</span>
            <span class="n">${countOf(n)} microbes</span>
            <span class="s">${locked ? "" : "⭐".repeat(st) + "☆".repeat(3 - st)}</span>
            <span class="l">niv. ${n + 1}</span></div>`;
        }
        const tot = Object.keys(save.stars).reduce((a, k) => a + save.stars[k], 0);
        const o = overlay(`
          <h2>🧼 Désinfecte ta chambre</h2>
          <p>Des microbes se cachent dans la chambre.<br>
             <b>Pince pour zoomer</b>, glisse pour te déplacer,<br>
             et tape dessus pour les désinfecter.</p>
          <div style="font-weight:700">⭐ ${tot}</div>
          <div class="gm-grid">${tiles}</div>
          <button class="gm-big g" data-a="play">▶ Jouer le niveau ${save.lvl + 1}</button>`);
        o.addEventListener("click", (e) => {
          if (e.target.closest("[data-a='play']")) { startLevel(save.lvl); return; }
          const t = e.target.closest("[data-n]"); if (t) startLevel(+t.dataset.n);
        });
      }

      /* ================= Boucle ================= */
      let raf = 0, last = performance.now();
      function frame(ts) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
        if (playing) {
          elapsed += dt;
          if (hintT > 0) { hintT -= dt; if (hintT <= 0) ring = null; }
        }
        if (tween) {
          tween.t = Math.min(1, tween.t + dt * 2.6);
          const k = 1 - Math.pow(1 - tween.t, 3);
          view.s = view.s + (tween.s - view.s) * k * 0.5;
          view.x = view.x + (tween.x - view.x) * k * 0.5;
          view.y = view.y + (tween.y - view.y) * k * 0.5;
          clampView();
          if (tween.t >= 1) tween = null;
        }
        for (let i = fx.length - 1; i >= 0; i--) {
          const p = fx[i];
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt * 1.5;
          if (p.life <= 0) fx.splice(i, 1);
        }
        for (const b of bugs) if (b.fade > 0) b.fade = Math.max(0, b.fade - dt * 2.2);
        draw(ts / 1000);
      }

      function draw(t) {
        const bgg = ctx.createLinearGradient(0, 0, 0, H);
        bgg.addColorStop(0, room.c1); bgg.addColorStop(1, room.c2);
        ctx.fillStyle = bgg; ctx.fillRect(0, 0, W, H);
        if (!ready) {
          ctx.fillStyle = "#fff"; ctx.textAlign = "center";
          ctx.font = "600 " + Math.round(16 * uiS) + "px Fredoka, sans-serif";
          ctx.fillText("chargement…", W / 2, H / 2);
          return;
        }
        const im = imgs["room_" + room.id];
        const o = toScreen(0, 0);
        if (im && im.width) ctx.drawImage(im, o.x, o.y, room.w * view.s, room.h * view.s);

        // microbes
        for (const b of bugs) {
          if (b.found && b.fade <= 0) continue;
          const p = toScreen(b.x, b.y);
          const rr = b.r * view.s;
          if (p.x + rr < -20 || p.x - rr > W + 20 || p.y + rr < -20 || p.y - rr > H + 20) continue;
          const breathe = 1 + 0.05 * Math.sin(t * 2 + b.ph);
          const g = imgs["bug_" + b.img];
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(b.rot + 0.05 * Math.sin(t * 1.3 + b.ph));
          if (b.found) { ctx.globalAlpha = b.fade; ctx.scale(1 + (1 - b.fade) * 0.8, 1 + (1 - b.fade) * 0.8); }
          const s = rr * 2 * breathe;
          if (g && g.width) ctx.drawImage(g, -s / 2, -s / 2, s, s);
          ctx.restore();
        }

        // cercle de la loupe
        if (ring) {
          const p = toScreen(ring.x, ring.y);
          const pulse = 1 + 0.35 * Math.abs(Math.sin(t * 4));
          ctx.save();
          ctx.globalAlpha = Math.min(1, hintT) * 0.9;
          ctx.strokeStyle = C.sun; ctx.lineWidth = 4 * uiS;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(26 * uiS, ring.r * view.s * 1.6) * pulse, 0, 7); ctx.stroke();
          ctx.restore();
        }

        // particules (spray + étincelles)
        for (const p of fx) {
          const sp = toScreen(p.x, p.y);
          ctx.globalAlpha = Math.max(0, p.life) * (p.pale ? 0.5 : 0.95);
          ctx.fillStyle = p.pale ? "#dfe9ff" : (Math.random() < 0.5 ? "#fff" : C.turq);
          ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(1.5, p.r * view.s), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // aide au démarrage
        if (playing && elapsed < 4 && found === 0) {
          ctx.globalAlpha = Math.min(1, 4 - elapsed) * 0.92;
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(30,22,48,.65)";
          ctx.lineWidth = 4 * uiS; ctx.textAlign = "center";
          ctx.font = "600 " + Math.round(15 * uiS) + "px Fredoka, sans-serif";
          const msg = "Pince pour zoomer · tape les microbes";
          ctx.strokeText(msg, W / 2, H - 22 * uiS); ctx.fillText(msg, W / 2, H - 22 * uiS);
          ctx.globalAlpha = 1;
        }
      }

      /* ================= Démarrage ================= */
      function onReady() { resize(); startLevel(save.lvl); openMap(); }
      resize();
      if (ready) onReady();

      if (window.__ARCADE_DEBUG) {
        window.__germs = {
          get bugs() { return bugs; }, get view() { return view; }, get playing() { return playing; },
          get level() { return level; }, get found() { return found; }, get room() { return room; },
          get minS() { return minS; }, tapImage(ix, iy) { const p = toScreen(ix, iy); tap(p); },
        };
      }

      raf = requestAnimationFrame(frame);
      api.onExit(() => {
        dead = true;
        if (doneTimer) { clearTimeout(doneTimer); doneTimer = 0; }
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
        removeOverlay();
        persist();
      });
    },
  });
})();
