/* =========================================================
   Désinfecte ta chambre — jeu d'objets cachés (v2)

   v2 : microbes BEAUCOUP plus petits et camouflés, 5 chambres,
   et un rendu réorganisé pour la fluidité.

   Quatre choix structurants :
   1) LE DÉCOR EST UNE <img> TRANSFORMÉE EN CSS, pas un dessin
      canvas. Le zoom/déplacement est donc composé par le GPU et
      ne coûte rien par image. Le canvas ne dessine plus que les
      microbes et les particules — et seulement quand quelque
      chose a changé (drapeau `dirty`). Au repos : 0 dessin.
   2) TAILLE EN FRACTION DE LA LARGEUR DE LA CHAMBRE (pas en
      pixels), donc identique quel que soit le format du décor.
      De 6,2 % au niveau 1 à 1,8 % au niveau 12 : à ce stade le
      microbe fait ~7 px à l'écran en vue d'ensemble. Invisible
      sans zoomer, c'est le but.
   3) CAMOUFLAGE : au niveau 3 et au-delà, chaque microbe est
      teinté vers la couleur du décor SOUS lui (échantillonnée
      dans l'image) et pré-rendu une fois pour la partie.
   4) TOLÉRANCE DE CLIC EN PIXELS ÉCRAN : elle rétrécit dans
      l'image quand on dézoome → taper au hasard en vue
      d'ensemble ne trouve rien. Ne pas remplacer par une
      tolérance en pixels image, ça casserait le jeu.
   ========================================================= */
(function () {
  const KEY = "arc_germs_v1";
  const BASE = "assets/germs/";

  const ROOMS = [
    { id: "pastel", name: "Chambre pastel", emoji: "🛏️", c1: "#907b77", c2: "#77564a",
      w: 768, h: 1344, cols: 10, rows: 18,
      clutter: ["0000000000", "0000100000", "0000100011", "0011221100", "0012120110", "1000015550", "3333323252", "3445413342", "1125613141", "0012615420", "3376536433", "3544637674", "4786747674", "3896457535", "5444342233", "1343345521", "1112323351", "0111114251"] },
    { id: "licorne", name: "Chambre licorne", emoji: "🦄", c1: "#675856", c2: "#4e3d34",
      w: 768, h: 1344, cols: 10, rows: 18,
      clutter: ["0000000000", "0000000000", "1000111000", "1221222221", "1232555522", "1123442611", "1113331621", "1212221511", "1212221511", "3235211555", "6346877586", "9855676586", "3353222467", "5545442444", "5664344444", "5555444444", "5554555545", "5445445555"] },
    { id: "peluches", name: "Chambre aux peluches", emoji: "🧸", c1: "#9a7174", c2: "#6a404c",
      w: 768, h: 1344, cols: 10, rows: 18,
      clutter: ["0000021100", "0000000100", "2211000000", "3311111100", "2411222111", "1421223254", "1333322465", "1332212366", "1321211343", "4442232264", "4465455473", "5464656675", "3567776689", "5666676688", "5656325757", "6542225567", "3333223434", "3332222442"] },
    { id: "superpose", name: "Chambre des lits superposés", emoji: "🪜", c1: "#81657e", c2: "#7e5a68",
      w: 896, h: 1152, cols: 10, rows: 13,
      clutter: ["1044410000", "1243331111", "2442231354", "6742354466", "5555566667", "2332455446", "2311346232", "5544578898", "6664365565", "6666788555", "6778877766", "4777555785", "3452556653"] },
    { id: "volcan", name: "Chambre volcan", emoji: "🌋", c1: "#ae8473", c2: "#8c4136",
      w: 1024, h: 1024, cols: 10, rows: 10,
      clutter: ["0000000000", "3013333100", "5112132314", "3343424424", "3323682345", "7774875587", "7668349567", "6556444665", "3672213764", "1244434542"] },
  ];
  const BUGS = ["pink", "red", "greenoval", "blue", "greenrod", "yellow"];

  const HINT_COST = 8;      // secondes ajoutées au chrono des ⭐

  // Difficulté — tout est réglable ici.
  const COUNT = (n) => Math.min(30, 4 + Math.round(n * 1.6));
  const SIZE  = (n) => Math.max(0.018, 0.062 - n * 0.004);   // diamètre, en fraction de la largeur
  const CAMO  = (n) => Math.max(0, Math.min(0.42, (n - 2) * 0.05));
  const BIAS  = (n) => Math.min(1, n / 4);                   // attirance vers les zones chargées
  const PAR   = (n) => 12 + COUNT(n) * 4.5;
  const HINTS = (n) => (COUNT(n) >= 18 ? 5 : 3);

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

      /* ================= Chargement ================= */
      const imgs = {}; let pending = 0, ready = false;
      function loadImg(key, src) {
        pending++;
        const im = new Image();
        im.onload = im.onerror = () => { if (--pending === 0) { ready = true; onReady(); } };
        im.src = src; imgs[key] = im;
      }
      ROOMS.forEach((r) => loadImg("room_" + r.id, BASE + "rooms/" + r.id + ".jpg"));
      BUGS.forEach((b) => loadImg("bug_" + b, BASE + "bugs/" + b + ".png"));

      /* ================= DOM ================= */
      const style = document.createElement("style");
      style.textContent = `
        .ar-title{font-size:clamp(.88rem,3.7vw,1.15rem);}
        .gm-stage{position:absolute;inset:0;overflow:hidden;}
        /* le décor est composé par le GPU : le zoom ne coûte rien par image */
        .gm-room{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;
          pointer-events:none;}
        .gm-fx{position:absolute;inset:0;display:block;touch-action:none;background:transparent;}
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

      const stage = document.createElement("div");
      stage.className = "gm-stage";
      const roomEl = document.createElement("img");
      roomEl.className = "gm-room"; roomEl.alt = "";
      const canvas = document.createElement("canvas");
      canvas.className = "gm-fx";
      stage.appendChild(roomEl); stage.appendChild(canvas);
      board.appendChild(stage);
      const ctx = canvas.getContext("2d");

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
      let dpr = Math.min(2, window.devicePixelRatio || 1);
      let W = 0, H = 0, uiS = 1;
      let level = save.lvl, room = roomOf(level), bugs = [], found = 0;
      let view = { s: 1, x: 0, y: 0 }, tween = null, minS = 1, maxS = 9;
      let playing = false, elapsed = 0, hints = 3, penalty = 0;
      let fx = [], ring = null, hintT = 0;
      let dirty = true, dead = false, doneTimer = 0;

      function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = board.clientWidth; H = board.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        uiS = clamp(Math.min(W, H) / 480, 0.7, 2);
        recomputeLimits(); applyView();
      }
      function recomputeLimits() {
        if (!room || !W || !H) return;
        minS = Math.min(W / room.w, H / room.h);
        maxS = minS * 9;
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

      // seule fonction qui bouge le décor : une transform CSS, composée par le GPU
      function applyView() {
        const o = toScreen(0, 0);
        roomEl.style.transform = "translate3d(" + o.x.toFixed(1) + "px," + o.y.toFixed(1) + "px,0) scale(" + view.s.toFixed(4) + ")";
        dirty = true;
      }

      /* ---------- Échantillonnage du décor (pour le camouflage) ---------- */
      const sampCache = {};
      function sampler(r) {
        if (sampCache[r.id]) return sampCache[r.id];
        const sw = 200, sh = Math.max(1, Math.round(200 * r.h / r.w));
        const c = document.createElement("canvas"); c.width = sw; c.height = sh;
        const x = c.getContext("2d", { willReadFrequently: true });
        const im = imgs["room_" + r.id];
        let d = null;
        try { if (im && im.width) { x.drawImage(im, 0, 0, sw, sh); d = x.getImageData(0, 0, sw, sh).data; } } catch (e) { d = null; }
        sampCache[r.id] = { sw, sh, d };
        return sampCache[r.id];
      }
      function sampleAt(r, ix, iy) {
        const s = sampler(r);
        if (!s.d) return [200, 200, 200];
        const px = clamp(Math.floor(ix / r.w * s.sw), 0, s.sw - 1);
        const py = clamp(Math.floor(iy / r.h * s.sh), 0, s.sh - 1);
        const i = (py * s.sw + px) * 4;
        return [s.d[i], s.d[i + 1], s.d[i + 2]];
      }
      // sprite teinté, rendu UNE fois par microbe au début du niveau
      function tinted(bugId, rgb, amount) {
        const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
        const x = c.getContext("2d");
        const g = imgs["bug_" + bugId];
        if (g && g.width) x.drawImage(g, 0, 0, S, S);
        if (amount > 0) {
          x.globalCompositeOperation = "source-atop";
          x.fillStyle = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + amount + ")";
          x.fillRect(0, 0, S, S);
        }
        return c;
      }

      /* ================= Construction d'un niveau ================= */
      function startLevel(n) {
        level = n; room = roomOf(n);
        stage.style.background = "linear-gradient(180deg," + room.c1 + "," + room.c2 + ")";
        roomEl.src = BASE + "rooms/" + room.id + ".jpg";
        roomEl.style.width = room.w + "px"; roomEl.style.height = room.h + "px";

        const rnd = rngFor(n * 7919 + 13);
        const count = COUNT(n), size = SIZE(n) * room.w, bias = BIAS(n), camo = CAMO(n);

        const cells = [];
        for (let j = 0; j < room.rows; j++) {
          for (let i = 0; i < room.cols; i++) {
            const c = +room.clutter[j][i];
            if (n >= 4 && c <= 1) continue;            // à partir du niveau 5 : plus rien sur le mur nu
            cells.push({ i, j, wgt: 1 + bias * c * 4 });
          }
        }
        const totW = cells.reduce((a, c) => a + c.wgt, 0);
        const cw = room.w / room.cols, ch = room.h / room.rows;

        bugs = [];
        for (let k = 0; k < count; k++) {
          let px = 0, py = 0, ok = false;
          for (let tr = 0; tr < 150 && !ok; tr++) {
            let pick = rnd() * totW, ci = 0;
            while (pick > cells[ci].wgt && ci < cells.length - 1) { pick -= cells[ci].wgt; ci++; }
            const c = cells[ci];
            px = clamp((c.i + rnd()) * cw, size * 0.6, room.w - size * 0.6);
            py = clamp((c.j + rnd()) * ch, size * 0.6, room.h - size * 0.6);
            ok = true;
            for (const b of bugs) if (Math.hypot(px - b.x, py - b.y) < size * 2.2) { ok = false; break; }
          }
          const id = BUGS[(rnd() * BUGS.length) | 0];
          const b = { x: px, y: py, r: size / 2, found: false, img: id, rot: (rnd() - 0.5) * 1.6, fade: 0 };
          b.spr = tinted(id, sampleAt(room, px, py), camo);
          bugs.push(b);
        }
        found = 0; elapsed = 0; hints = HINTS(n); penalty = 0;
        fx = []; ring = null; hintT = 0;
        view = { s: 1, x: room.w / 2, y: room.h / 2 };
        recomputeLimits(); view.s = minS; clampView(); applyView();
        tween = null; playing = true; dirty = true;
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
      const evPos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

      function onDown(e) {
        if (!playing || !ready) return;
        try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
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
          clampView(); applyView(); pinch = { d, m };
        } else if (pointers.size === 1) {
          const dx = now.x - prev.x, dy = now.y - prev.y;
          if (Math.hypot(now.x - downPt.x, now.y - downPt.y) > 8) dragged = true;
          view.x -= dx / view.s; view.y -= dy / view.s; clampView(); applyView();
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
          if (now - lastTap < 300) { zoomAt(p, 2.2); clampView(); applyView(); lastTap = 0; }
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
      function onWheel(e) { if (!playing) return; e.preventDefault(); zoomAt(evPos(e), e.deltaY < 0 ? 1.18 : 1 / 1.18); applyView(); }

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      const onResize = () => resize();
      window.addEventListener("resize", onResize);

      function tap(pt) {
        const p = toImage(pt.x, pt.y);
        let best = null, bd = 1e9;
        for (const b of bugs) {
          if (b.found) continue;
          const d = Math.hypot(p.x - b.x, p.y - b.y);
          const tol = Math.max(b.r * 0.95, 16 / view.s);
          if (d < tol && d < bd) { bd = d; best = b; }
        }
        if (best) hit(best); else miss(p);
      }
      const FXC = ["#ffffff", C.turq, "#d9f7ff", C.lime];
      function hit(b) {
        b.found = true; b.fade = 1; found++;
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * 7, sp = 40 + Math.random() * 110;
          fx.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
                    life: 1, r: b.r * (0.18 + Math.random() * 0.22), col: FXC[(Math.random() * 4) | 0] });
        }
        api.soundGood(); api.beep(720, 0.06, "triangle", 0.06); api.vibrate([8, 20, 10]);
        dirty = true; updateHud(true);
        if (found >= bugs.length) doneTimer = setTimeout(levelDone, 450);
      }
      function miss(p) {
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * 7, sp = 20 + Math.random() * 50;
          fx.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                    life: 0.55, r: 6 / view.s, col: "#dfe9ff", pale: true });
        }
        api.beep(180, 0.04, "sine", 0.03); api.vibrate(4); dirty = true;
      }

      hintBtn.addEventListener("click", () => {
        if (!playing || hints <= 0) return;
        const rest = bugs.filter((b) => !b.found);
        if (!rest.length) return;
        const b = rest[(Math.random() * rest.length) | 0];
        hints--; penalty += HINT_COST;
        ring = { x: b.x, y: b.y, r: b.r }; hintT = 3;
        tween = { s: clamp(minS * 4, minS, maxS), x: b.x, y: b.y, t: 0 };
        api.beep(880, 0.08, "sine", 0.05);
        updateHud(true); dirty = true;
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
      const starsFor = (t) => { const p = PAR(level); return t <= p ? 3 : t <= p * 1.7 ? 2 : 1; };

      function levelDone() {
        doneTimer = 0; if (dead) return;
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
             ${st < 3 ? `<br><span style="opacity:.7">3 ⭐ en moins de ${Math.round(PAR(level))} s</span>` : ""}</p>
          <button class="gm-big g" data-a="next">${nr.emoji} Niveau ${next + 1} · ${COUNT(next)} microbes</button>
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
            <span class="n">${COUNT(n)} microbes</span>
            <span class="s">${locked ? "" : "⭐".repeat(st) + "☆".repeat(3 - st)}</span>
            <span class="l">niv. ${n + 1}</span></div>`;
        }
        const tot = Object.keys(save.stars).reduce((a, k) => a + save.stars[k], 0);
        const o = overlay(`
          <h2>🧼 Désinfecte ta chambre</h2>
          <p>Les microbes sont <b>minuscules</b> et camouflés.<br>
             <b>Pince pour zoomer</b>, glisse pour fouiller,<br>
             et tape dessus pour les désinfecter.</p>
          <div style="font-weight:700">⭐ ${tot}</div>
          <div class="gm-grid">${tiles}</div>
          <button class="gm-big g" data-a="play">▶ Jouer le niveau ${save.lvl + 1}</button>`);
        o.addEventListener("click", (e) => {
          if (e.target.closest("[data-a='play']")) { startLevel(save.lvl); return; }
          const t = e.target.closest("[data-n]"); if (t) startLevel(+t.dataset.n);
        });
      }

      /* ================= Boucle =================
         On ne dessine QUE s'il se passe quelque chose. Au repos (décor
         immobile, aucune particule) la boucle ne fait rien du tout. */
      let raf = 0, last = performance.now();
      function frame(ts) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
        if (playing) {
          elapsed += dt;
          if (elapsed < 4.2) dirty = true;                 // le bandeau d'aide s'estompe
          if (hintT > 0) { hintT -= dt; dirty = true; if (hintT <= 0) ring = null; }
        }
        if (tween) {
          tween.t = Math.min(1, tween.t + dt * 2.6);
          const k = 1 - Math.pow(1 - tween.t, 3);
          view.s += (tween.s - view.s) * k * 0.5;
          view.x += (tween.x - view.x) * k * 0.5;
          view.y += (tween.y - view.y) * k * 0.5;
          clampView(); applyView();
          if (tween.t >= 1) tween = null;
        }
        if (fx.length) {
          for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt * 1.5;
            if (p.life <= 0) fx.splice(i, 1);
          }
          dirty = true;
        }
        for (const b of bugs) if (b.fade > 0) { b.fade = Math.max(0, b.fade - dt * 2.2); dirty = true; }
        if (dirty) { dirty = false; draw(); }
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        if (!ready) {
          ctx.fillStyle = "#fff"; ctx.textAlign = "center";
          ctx.font = "600 " + Math.round(16 * uiS) + "px Fredoka, sans-serif";
          ctx.fillText("chargement…", W / 2, H / 2);
          return;
        }
        for (const b of bugs) {
          if (b.found && b.fade <= 0) continue;
          const p = toScreen(b.x, b.y), rr = b.r * view.s;
          if (p.x + rr < -20 || p.x - rr > W + 20 || p.y + rr < -20 || p.y - rr > H + 20) continue;
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(b.rot);
          if (b.found) { const g = 1 + (1 - b.fade) * 0.8; ctx.globalAlpha = b.fade; ctx.scale(g, g); }
          const s = rr * 2;
          ctx.drawImage(b.spr, -s / 2, -s / 2, s, s);
          ctx.restore();
        }
        if (ring) {
          const p = toScreen(ring.x, ring.y);
          const pulse = 1 + 0.35 * Math.abs(Math.sin(hintT * 6));
          ctx.save();
          ctx.globalAlpha = Math.min(1, hintT) * 0.9;
          ctx.strokeStyle = C.sun; ctx.lineWidth = 4 * uiS;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(26 * uiS, ring.r * view.s * 2.2) * pulse, 0, 7); ctx.stroke();
          ctx.restore();
        }
        for (const p of fx) {
          const sp = toScreen(p.x, p.y);
          ctx.globalAlpha = Math.max(0, p.life) * (p.pale ? 0.5 : 0.95);
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(1.5, p.r * view.s), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (playing && elapsed < 4 && found === 0) {
          ctx.globalAlpha = Math.min(1, 4 - elapsed) * 0.92;
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(30,22,48,.65)";
          ctx.lineWidth = 4 * uiS; ctx.textAlign = "center";
          ctx.font = "600 " + Math.round(15 * uiS) + "px Fredoka, sans-serif";
          const msg = "Pince pour zoomer · les microbes sont minuscules";
          ctx.strokeText(msg, W / 2, H - 22 * uiS); ctx.fillText(msg, W / 2, H - 22 * uiS);
          ctx.globalAlpha = 1;
        }
      }

      /* ================= Démarrage ================= */
      function onReady() { resize(); startLevel(save.lvl); openMap(); }
      resize();

      if (window.__ARCADE_DEBUG) {
        window.__germs = {
          get bugs() { return bugs; }, get view() { return view; }, get playing() { return playing; },
          get level() { return level; }, get found() { return found; }, get room() { return room; },
          get minS() { return minS; }, get maxS() { return maxS; },
          tapImage(ix, iy) { tap(toScreen(ix, iy)); },
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
