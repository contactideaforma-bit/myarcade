/* =========================================================
   Emoji Hole v4 — « Le Trou Glouton »
   Refonte en NIVEAUX par THÈME (bonbons, animaux, ville…).

   Principe : le trou démarre minuscule et grossit jusqu'à ×15
   en avalant. Quand le décor est vide, le niveau est terminé.
   Aucun chrono, aucun danger : le temps ne sert qu'à donner
   1 à 3 ⭐. On ne peut pas perdre.

   Deux choix structurants :
   1) CAMÉRA QUI DÉZOOME. Un trou ×15 ne tient pas à l'écran :
      le monde fait ~3000 unités, la caméra suit le trou et
      dézoome pour garder son rayon apparent à peu près stable.
      Tout est donc en COORDONNÉES MONDE, converties au dessin.
   2) COURBE DE CROISSANCE CALCULÉE. Les paliers de taille sont
      posés à la construction du niveau (buildCurve) de façon à
      garantir qu'après avoir mangé tout un palier on est
      toujours assez gros pour le suivant → niveau TOUJOURS
      finissable, quels que soient les effectifs.
   ========================================================= */
(function () {
  const KEY = "arc_hole_v4";

  const R0 = 26;             // rayon du trou au niveau 1 (unités monde)
  const MAXSCALE = 15;       // ×15 à la fin du niveau
  const TIER_MUL = [0.62, 1.5, 3.0, 5.5, 9.0, 12.5];   // rayon des objets, en R0
  const BASE_COUNT = [26, 16, 10, 6, 3, 1];            // effectifs au tour 1
  const MARGIN = 1.06;       // marge de sécurité sur la courbe de croissance

  // 12 thèmes, 6 tailles d'objets chacun. Le 6e est le « boss » du décor.
  const THEMES = [
    { id: "candy", name: "Bonbons",   emoji: "🍭", sky: ["#fff1f7", "#ffd9ea"], ground: "#ffe8f3",
      t: [["🍬","🌰","🫐","🍒"], ["🍪","🍫","🧁"], ["🍩","🥨","🍿"], ["🍦","🍮","🥧"], ["🍰","🍭"], ["🎂"]] },
    { id: "food", name: "Nourriture", emoji: "🍔", sky: ["#fff8e8", "#ffe4bd"], ground: "#ffeed4",
      t: [["🌰","🥜","🫒","🍇"], ["🥚","🍅","🥕","🧄"], ["🍔","🌮","🥪","🧀"], ["🍕","🍗","🥘"], ["🍉","🥧"], ["🏪"]] },
    { id: "animals", name: "Animaux", emoji: "🐾", sky: ["#eefbef", "#c9edd0"], ground: "#dcf3de",
      t: [["🐜","🐝","🐞","🦗"], ["🐭","🐸","🐹","🦎"], ["🐰","🐱","🐶","🦊"], ["🐷","🐼","🦁"], ["🐴","🐮","🦒"], ["🐘"]] },
    { id: "home", name: "Maison",     emoji: "🏡", sky: ["#fdf4ff", "#e6d9f6"], ground: "#f2e9fb",
      t: [["🔑","🔌","🧷","🪥"], ["☕","🕯️","🧴","📱"], ["📚","🪴","🧺","🖥️"], ["🪑","🚪","🛁"], ["🛋️","🛏️"], ["🏡"]] },
    { id: "garden", name: "Jardin",   emoji: "🌳", sky: ["#f2fbe9", "#d2ecb4"], ground: "#e5f5d4",
      t: [["🌱","🐛","🍄","🌰"], ["🌷","🌻","🪴","🥀"], ["🌿","🪨","🦔","🐢"], ["🌵","🎍","⛲"], ["🌳","🏕️"], ["🚜"]] },
    { id: "city", name: "Ville",      emoji: "🚗", sky: ["#eef4fb", "#cfdcec"], ground: "#e3ebf5",
      t: [["🔩","🥤","🪙","📎"], ["🛹","🧃","📦","🪧"], ["🚲","🛵","🛴"], ["🚗","🚕","🏍️"], ["🚌","🚚"], ["🏢"]] },
    { id: "beach", name: "Plage",     emoji: "🏖️", sky: ["#e9f9ff", "#b9e8f7"], ground: "#fdf0cf",
      t: [["🐚","🦐","🪸","🧿"], ["🦀","🐠","🥥","🍹"], ["🐙","🏐","⛱️"], ["🐬","🛟","🏄"], ["🦈","⛵"], ["🛳️"]] },
    { id: "sport", name: "Sport",     emoji: "⚽", sky: ["#fff0ef", "#ffd0cc"], ground: "#ffe2df",
      t: [["🏓","🥎","🎱","🏸"], ["⚾","🥊","🎾","🥏"], ["⚽","🏀","🏈","🏐"], ["🚴","🏋️","🤺"], ["🛷","🏎️"], ["🏟️"]] },
    { id: "music", name: "Musique",   emoji: "🎵", sky: ["#f4efff", "#d8caf7"], ground: "#eae2fb",
      t: [["🎵","🎶","🔔","📀"], ["🎤","🎧","🪇"], ["🎸","🎻","🪕"], ["🥁","🎷","🪗"], ["🎹","🎺"], ["🎪"]] },
    { id: "space", name: "Espace",    emoji: "🚀", sky: ["#1d2145", "#3b3070"], ground: "#2a2a55", dark: true,
      t: [["✨","⭐","💫","🌟"], ["☄️","🛰️","👾"], ["🌙","🔭","🧑‍🚀"], ["🚀","🛸"], ["🪐","🌍"], ["☀️"]] },
    { id: "spooky", name: "Halloween", emoji: "🎃", sky: ["#2a1f3d", "#4a2c52"], ground: "#3a2748", dark: true,
      t: [["🕷️","🦇","🍬","🕯️"], ["👻","💀","🕸️"], ["🎃","🧙","🧟"], ["⚰️","🪦","🐈‍⬛"], ["🏚️","🌕"], ["🏰"]] },
    { id: "xmas", name: "Noël",       emoji: "🎄", sky: ["#eef6ff", "#c8dcf0"], ground: "#e6f0fa",
      t: [["❄️","🔔","🍬","⭐"], ["🧦","🎁","🍪"], ["⛄","🕯️","🦌"], ["🎅","🛷","🏠"], ["🎄","🗻"], ["🏔️"]] },
  ];

  window.ARCADE.register({
    id: "hole", title: "Le Trou Glouton", emoji: "🕳️",
    mount(board, api) {
      const C = api.colors;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const rnd = (a, b) => a + Math.random() * (b - a);

      /* ================= Sauvegarde ================= */
      function load() {
        const d = { v: 4, lvl: 0, maxLvl: 0, stars: {} };
        try {
          const s = JSON.parse(localStorage.getItem(KEY) || "null");
          if (s && s.v === 4) {
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

      const themeOf = (n) => THEMES[n % THEMES.length];
      const roundOf = (n) => Math.floor(n / THEMES.length) + 1;   // tour 1, 2, 3…

      /* ================= Canvas ================= */
      let dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:none;";
      board.appendChild(canvas);
      const ctx = canvas.getContext("2d");

      const style = document.createElement("style");
      style.textContent = `
        .hl-hud{position:absolute;left:8px;right:8px;top:8px;z-index:4;pointer-events:none;
          display:flex;flex-direction:column;align-items:center;gap:3px;font-family:Fredoka,sans-serif;}
        .hl-name{font-weight:700;font-size:clamp(13px,3.6vw,17px);color:${C.ink};
          background:rgba(255,255,255,.82);border:2.5px solid ${C.ink};border-radius:14px;
          padding:2px 12px;box-shadow:0 3px 0 ${C.ink};white-space:nowrap;}
        .hl-bar{width:min(78%,320px);height:11px;background:rgba(255,255,255,.75);
          border:2.5px solid ${C.ink};border-radius:9px;overflow:hidden;box-shadow:0 2px 0 ${C.ink};}
        .hl-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,${C.turq},${C.lime});
          transition:width .18s ease;}
        .hl-meta{font-family:'Patrick Hand',cursive;font-size:clamp(11px,3vw,15px);color:${C.ink};
          background:rgba(255,255,255,.7);border-radius:10px;padding:0 8px;white-space:nowrap;}
        .hl-ov{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;
          background:rgba(20,14,32,.7);padding:12px;overflow-y:auto;-webkit-overflow-scrolling:touch;}
        .hl-card{width:100%;max-width:340px;background:${C.paper};border:4px solid ${C.ink};border-radius:22px;
          box-shadow:0 8px 0 ${C.ink},0 16px 34px rgba(0,0,0,.4);padding:16px;text-align:center;
          display:flex;flex-direction:column;gap:10px;max-height:100%;overflow-y:auto;}
        .hl-card h2{margin:0;font-size:1.3rem;}
        .hl-card p{margin:0;font-family:'Patrick Hand',cursive;font-size:1rem;line-height:1.3;}
        .hl-btn{display:block;width:100%;box-sizing:border-box;font-family:Fredoka;font-weight:700;
          font-size:.95rem;color:${C.ink};background:${C.sun};border:3px solid ${C.ink};
          border-radius:14px;padding:10px 12px;box-shadow:0 4px 0 ${C.ink};cursor:pointer;}
        .hl-btn:active{transform:translateY(3px);box-shadow:0 1px 0 ${C.ink};}
        .hl-btn.g{background:${C.lime};}
        .hl-btn.w{background:#fff;}
        .hl-stars{font-size:2.1rem;letter-spacing:2px;line-height:1;}
        .hl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
        .hl-tile{position:relative;background:#fff;border:3px solid ${C.ink};border-radius:14px;
          box-shadow:0 3px 0 ${C.ink};padding:7px 3px 5px;cursor:pointer;display:flex;
          flex-direction:column;align-items:center;gap:1px;font-family:Fredoka;}
        .hl-tile:active{transform:translateY(2px);box-shadow:0 1px 0 ${C.ink};}
        .hl-tile .e{font-size:1.5rem;line-height:1.1;}
        .hl-tile .n{font-size:.66rem;font-weight:600;}
        .hl-tile .s{font-size:.6rem;letter-spacing:-1px;height:.8em;}
        .hl-tile .l{font-family:'Patrick Hand',cursive;font-size:.6rem;opacity:.55;}
        .hl-tile.lock{background:#e9e5f0;color:#9a94ab;cursor:default;box-shadow:0 3px 0 #b8b2c6;border-color:#b8b2c6;}
        .hl-tile.cur{background:${C.sun};}
        .hl-round{font-weight:700;font-size:.9rem;margin-top:2px;}
      `;
      board.appendChild(style);

      const hud = document.createElement("div");
      hud.className = "hl-hud";
      hud.innerHTML = `<div class="hl-name" id="hlName">…</div><div class="hl-bar"><i id="hlBar"></i></div><div class="hl-meta" id="hlMeta"></div>`;
      board.appendChild(hud);
      const nameEl = hud.querySelector("#hlName"), barEl = hud.querySelector("#hlBar"), metaEl = hud.querySelector("#hlMeta");

      /* ================= Sprites emoji (pré-rendus) ================= */
      const cache = {};
      function sprite(emoji, px) {
        const key = emoji + "@" + px;
        if (cache[key]) return cache[key];
        const c = document.createElement("canvas"); c.width = c.height = px;
        const x = c.getContext("2d");
        x.font = Math.floor(px * 0.8) + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',serif";
        x.textAlign = "center"; x.textBaseline = "middle";
        x.fillText(emoji, px / 2, px / 2 + px * 0.04);
        cache[key] = c; return c;
      }
      const sprFor = (o) => sprite(o.emoji, o.tier >= 4 ? 384 : o.tier === 3 ? 192 : 96);

      /* ================= État ================= */
      let W = 0, H = 0, uiS = 1;
      let world = 3000, hole = null, objects = [], pops = [], ripples = [];
      let curve = null, totalMass = 0, eatenMass = 0, totalCount = 0;
      let cam = { x: 0, y: 0 }, zoom = 1;
      let playing = false, elapsed = 0, par = 60, hintT = 0;
      let level = save.lvl, theme = themeOf(level);

      function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = board.clientWidth; H = board.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        uiS = clamp(Math.min(W, H) / 480, 0.72, 2.0);
      }
      resize();

      /* ---------- Courbe de croissance ----------
         Renvoie une liste de points (fraction de masse mangée → échelle du trou),
         construite pour que la fin de chaque palier garantisse l'accès au suivant. */
      function buildCurve(counts) {
        const mass = counts.map((n, k) => n * Math.pow(R0 * TIER_MUL[k], 2));
        const total = mass.reduce((a, b) => a + b, 0);
        const pts = [{ f: 0, s: 1 }];
        let cum = 0, prev = 1;
        for (let k = 0; k < counts.length - 1; k++) {
          cum += mass[k];
          const s = Math.max(prev + 0.05, TIER_MUL[k + 1] * MARGIN);
          pts.push({ f: cum / total, s }); prev = s;
        }
        pts.push({ f: 1, s: Math.max(prev + 0.05, MAXSCALE) });
        return { pts, total };
      }
      function scaleAt(f) {
        const p = curve.pts;
        for (let i = 1; i < p.length; i++) {
          if (f <= p[i].f || i === p.length - 1) {
            const a = p[i - 1], b = p[i], t = b.f === a.f ? 1 : clamp((f - a.f) / (b.f - a.f), 0, 1);
            return a.s + (b.s - a.s) * t;
          }
        }
        return 1;
      }

      /* ---------- Construction d'un niveau ---------- */
      function startLevel(n) {
        level = n; theme = themeOf(n);
        const round = roundOf(n), boost = 1 + 0.3 * (round - 1);
        const counts = BASE_COUNT.map((c, k) => (k === 5 ? Math.min(3, round) : Math.round(c * boost)));
        const built = buildCurve(counts);
        curve = built; totalMass = built.total; eatenMass = 0;
        totalCount = counts.reduce((a, b) => a + b, 0);
        world = clamp(Math.sqrt(totalMass * 14), 1500, 4600);
        par = 10 + 0.8 * totalCount;

        hole = { x: world / 2, y: world / 2, tx: world / 2, ty: world / 2, r: R0, scale: 1, pulse: 0, ang: 0 };
        objects = []; pops = []; ripples = [];

        // Placement EN ANNEAUX autour du trou : les petits objets au centre, les
        // gros en périphérie. Indispensable : au niveau ×1 la vue ne couvre qu'une
        // petite partie du monde — sans ça on démarrerait devant un décor vide.
        const RING = [[0.03, 0.13], [0.07, 0.20], [0.12, 0.28], [0.18, 0.36], [0.25, 0.44], [0.28, 0.42]];
        for (let k = counts.length - 1; k >= 0; k--) {
          const r = R0 * TIER_MUL[k], pool = theme.t[k], ring = RING[k];
          for (let i = 0; i < counts[k]; i++) {
            let x = 0, y = 0, ok = false;
            for (let tr = 0; tr < 90 && !ok; tr++) {
              const a = Math.random() * Math.PI * 2, d = rnd(ring[0], ring[1]) * world;
              x = clamp(hole.x + Math.cos(a) * d, r + 12, world - r - 12);
              y = clamp(hole.y + Math.sin(a) * d, r + 12, world - r - 12);
              if (Math.hypot(x - hole.x, y - hole.y) < r + R0 * 2.6) continue;
              ok = true;
              for (const o of objects) if (Math.hypot(x - o.x, y - o.y) < r + o.r + 10) { ok = false; break; }
            }
            const drift = k <= 2 ? rnd(6, 22) : rnd(0, 7);   // les petits vagabondent un peu
            const a = Math.random() * 7;
            objects.push({ x, y, r, tier: k, emoji: pool[(Math.random() * pool.length) | 0],
                           vx: Math.cos(a) * drift, vy: Math.sin(a) * drift, suck: 0, wob: Math.random() * 7 });
          }
        }
        elapsed = 0; hintT = 3.5; playing = true;
        save.lvl = n; save.maxLvl = Math.max(save.maxLvl, n); persist();
        api.setBest("hole", n + 1);
        removeOverlay(); updateHud(true); camSnap();
      }

      /* ---------- Caméra ---------- */
      const screenR = () => (0.10 + 0.09 * (hole.scale - 1) / (MAXSCALE - 1)) * Math.min(W, H);
      function camUpdate(dt) {
        zoom = screenR() / hole.r;
        const halfW = W / 2 / zoom, halfH = H / 2 / zoom;
        let tx = hole.x, ty = hole.y;
        tx = halfW * 2 >= world ? world / 2 : clamp(tx, halfW, world - halfW);
        ty = halfH * 2 >= world ? world / 2 : clamp(ty, halfH, world - halfH);
        const k = dt ? Math.min(1, dt * 9) : 1;
        cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      }
      function camSnap() { camUpdate(0); }
      const toWorld = (sx, sy) => ({ x: cam.x + (sx - W / 2) / zoom, y: cam.y + (sy - H / 2) / zoom });

      /* ---------- Entrées ---------- */
      let activeId = null;
      function pointAt(e) {
        const rct = canvas.getBoundingClientRect();
        const p = toWorld(e.clientX - rct.left, e.clientY - rct.top - screenR() * 0.55);
        hole.tx = clamp(p.x, hole.r, world - hole.r);
        hole.ty = clamp(p.y, hole.r, world - hole.r);
      }
      const onDown = (e) => { if (!playing) return; if (activeId !== null) { e.preventDefault(); return; }
        activeId = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} pointAt(e); e.preventDefault(); };
      const onMove = (e) => { if (!playing) return;
        if (e.pointerId === activeId || (e.pointerType === "mouse" && activeId === null)) { pointAt(e); e.preventDefault(); } };
      const onUp = (e) => { if (e.pointerId !== activeId) return;
        try { canvas.releasePointerCapture(e.pointerId); } catch (x) {} activeId = null; };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      const onResize = () => { resize(); if (hole) camSnap(); };
      window.addEventListener("resize", onResize);

      /* ---------- HUD ---------- */
      let lastHud = "";
      function updateHud(force) {
        const left = objects.length;
        const sig = level + "|" + left + "|" + hole.scale.toFixed(1);
        if (!force && sig === lastHud) return;
        lastHud = sig;
        nameEl.textContent = theme.emoji + " " + theme.name + " · niveau " + (level + 1);
        barEl.style.width = Math.round((1 - left / totalCount) * 100) + "%";
        metaEl.textContent = "🕳️ ×" + hole.scale.toFixed(1) + " · " + left + " objet" + (left > 1 ? "s" : "") + " restant" + (left > 1 ? "s" : "");
        api.setStatus("niv. " + (level + 1) + " · ×" + hole.scale.toFixed(1));
      }

      /* ---------- Manger ---------- */
      function eat(o) {
        o.suck = 1;
        eatenMass += o.r * o.r;
        hole.scale = scaleAt(clamp(eatenMass / totalMass, 0, 1));
        hole.r = R0 * hole.scale;
        hole.pulse = 1;
        ripples.push({ x: hole.x, y: hole.y, r: hole.r, a: 0.55 });
        if (o.tier >= 3) { pops.push({ x: o.x, y: o.y, txt: o.emoji, life: 1.1 }); api.soundGood(); }
        if (o.tier === 5) api.soundWin();   // le boss : confettis réservés à la fin du niveau
        api.beep(180 + o.tier * 90, 0.05, "sine", 0.055);
        api.vibrate(o.tier >= 3 ? [8, 20, 10] : 7);
      }

      /* ================= Overlays ================= */
      let ov = null;
      function removeOverlay() { if (ov) { ov.remove(); ov = null; } }
      function overlay(html) {
        removeOverlay();
        ov = document.createElement("div"); ov.className = "hl-ov";
        ov.innerHTML = `<div class="hl-card">${html}</div>`;
        board.appendChild(ov); return ov;
      }

      function starsFor(t) { return t <= par ? 3 : t <= par * 1.6 ? 2 : 1; }
      function levelDone() {
        playing = false;
        const st = starsFor(elapsed);
        const prev = save.stars[level] || 0;
        if (st > prev) save.stars[level] = st;
        const next = level + 1;
        save.maxLvl = Math.max(save.maxLvl, next); save.lvl = next; persist();
        api.setBest("hole", next + 1);
        api.win();
        const nt = themeOf(next), nr = roundOf(next);
        const o = overlay(`
          <h2>🎉 Tout est avalé !</h2>
          <div class="hl-stars">${"⭐".repeat(st)}${"☆".repeat(3 - st)}</div>
          <p><b>${theme.emoji} ${theme.name}</b> · ${totalCount} objets engloutis<br>en <b>${Math.round(elapsed)} s</b><br>
             Trou final : <b>×${MAXSCALE}</b>${st < 3 ? `<br><span style="opacity:.7">3 ⭐ en moins de ${Math.round(par)} s</span>` : ""}</p>
          <button class="hl-btn g" data-a="next">${nt.emoji} Niveau ${next + 1} · ${nt.name}${nr > roundOf(level) ? " (tour " + nr + ")" : ""}</button>
          <button class="hl-btn w" data-a="again">↺ Refaire ce niveau</button>
          <button class="hl-btn w" data-a="map">🗺️ Carte des niveaux</button>`);
        o.addEventListener("click", (e) => {
          const b = e.target.closest("[data-a]"); if (!b) return;
          if (b.dataset.a === "next") startLevel(next);
          else if (b.dataset.a === "again") startLevel(level);
          else openMap();
        });
      }

      function openMap() {
        playing = false;
        const maxShow = save.maxLvl + 1;
        let tiles = "";
        for (let n = 0; n <= maxShow; n++) {
          const th = themeOf(n), locked = n > save.maxLvl, st = save.stars[n] || 0;
          tiles += `<div class="hl-tile ${locked ? "lock" : n === save.lvl ? "cur" : ""}" ${locked ? "" : `data-n="${n}"`}>
            <span class="e">${locked ? "🔒" : th.emoji}</span>
            <span class="n">${th.name}</span>
            <span class="s">${locked ? "" : "⭐".repeat(st) + "☆".repeat(3 - st)}</span>
            <span class="l">niv. ${n + 1}</span></div>`;
        }
        const done = Object.keys(save.stars).reduce((a, k) => a + save.stars[k], 0);
        const o = overlay(`
          <h2>🕳️ Le Trou Glouton</h2>
          <p>Avale tout ce qui est plus petit que toi.<br>
             Le trou grossit jusqu'à <b>×${MAXSCALE}</b> :<br>quand le décor est vide, c'est gagné.</p>
          <div class="hl-round">Tour ${roundOf(save.lvl)} · ⭐ ${done}</div>
          <div class="hl-grid">${tiles}</div>
          <button class="hl-btn g" data-a="play">▶ Jouer le niveau ${save.lvl + 1}</button>`);
        o.addEventListener("click", (e) => {
          if (e.target.closest("[data-a='play']")) { startLevel(save.lvl); return; }
          const t = e.target.closest("[data-n]");
          if (t) startLevel(+t.dataset.n);
        });
      }

      /* ================= Boucle ================= */
      let raf = 0, last = performance.now();
      function frame(ts) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
        if (playing) step(dt);
        draw();
      }

      function step(dt) {
        elapsed += dt;
        if (hintT > 0) hintT -= dt;
        hole.x += (hole.tx - hole.x) * Math.min(1, dt * 24);
        hole.y += (hole.ty - hole.y) * Math.min(1, dt * 24);
        hole.ang += dt * 0.6;
        hole.pulse *= (1 - dt * 4);

        for (const o of objects) {
          if (o.suck) {
            const dx = hole.x - o.x, dy = hole.y - o.y;
            o.x += dx * Math.min(1, dt * 11); o.y += dy * Math.min(1, dt * 11);
            o.r *= (1 - dt * 6.5); continue;
          }
          // dérive lente + rebond sur les bords du monde
          if (o.vx || o.vy) {
            o.x += o.vx * dt; o.y += o.vy * dt; o.wob += dt * 2;
            if (o.x < o.r || o.x > world - o.r) { o.vx *= -1; o.x = clamp(o.x, o.r, world - o.r); }
            if (o.y < o.r || o.y > world - o.r) { o.vy *= -1; o.y = clamp(o.y, o.r, world - o.r); }
          }
          const dx = hole.x - o.x, dy = hole.y - o.y, d = Math.hypot(dx, dy) || 0.001;
          const eatable = o.r <= hole.r * 1.02;
          if (eatable) {
            const reach = (hole.r + o.r) * 2.2;
            if (d < reach) {
              const pull = (1 - d / reach) * 10;
              o.x += dx / d * pull * dt * 32; o.y += dy / d * pull * dt * 32;
            }
            if (d < hole.r * 0.94) eat(o);
          } else if (d < hole.r + o.r * 0.8) {
            // trop gros : il glisse sur le bord au lieu de se superposer au trou
            const push = (hole.r + o.r * 0.8 - d) * Math.min(1, dt * 12);
            o.x -= dx / d * push; o.y -= dy / d * push;
            o.x = clamp(o.x, o.r, world - o.r); o.y = clamp(o.y, o.r, world - o.r);
          }
        }
        for (let i = objects.length - 1; i >= 0; i--) if (objects[i].suck && objects[i].r < 3) objects.splice(i, 1);
        for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.r += dt * hole.r * 2.4; r.a -= dt * 1.3; if (r.a <= 0) ripples.splice(i, 1); }
        for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt * 1.1; pops[i].y -= dt * hole.r * 0.5; if (pops[i].life <= 0) pops.splice(i, 1); }

        camUpdate(dt);
        updateHud();
        if (!objects.length) levelDone();
      }

      /* ================= Rendu ================= */
      function draw() {
        // ciel
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        if (!hole) return;

        ctx.save();
        ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);

        // sol du niveau + damier léger (donne l'échelle quand on dézoome)
        ctx.fillStyle = theme.ground;
        ctx.fillRect(0, 0, world, world);
        const cell = world / 14;
        ctx.fillStyle = theme.dark ? "rgba(255,255,255,.035)" : "rgba(43,36,64,.035)";
        for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) if ((i + j) & 1) ctx.fillRect(i * cell, j * cell, cell, cell);
        ctx.strokeStyle = theme.dark ? "rgba(255,255,255,.25)" : "rgba(43,36,64,.35)";
        ctx.lineWidth = 6 / zoom; ctx.strokeRect(0, 0, world, world);

        // objets (culling : on ne dessine que ce qui touche la vue)
        const vx = cam.x - W / 2 / zoom, vy = cam.y - H / 2 / zoom, vw = W / zoom, vh = H / zoom;
        for (const o of objects) {
          if (o.x + o.r < vx || o.x - o.r > vx + vw || o.y + o.r < vy || o.y - o.r > vy + vh) continue;
          const eatable = o.r <= hole.r * 1.02;
          ctx.globalAlpha = 0.14; ctx.fillStyle = "#000";
          ctx.beginPath(); ctx.ellipse(o.x, o.y + o.r * 0.66, o.r * 0.6, o.r * 0.19, 0, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
          if (eatable && !o.suck) {   // liseré vert = à ta portée
            ctx.globalAlpha = 0.30 + 0.2 * Math.abs(Math.sin(hole.ang * 2.2 + o.wob));
            ctx.strokeStyle = C.lime; ctx.lineWidth = Math.max(1.5, o.r * 0.09);
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.16, 0, 7); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          const s = o.r * 2.15;
          ctx.drawImage(sprFor(o), o.x - s / 2, o.y - s / 2, s, s);
        }

        // ondes
        for (const rp of ripples) {
          ctx.globalAlpha = Math.max(0, rp.a); ctx.strokeStyle = C.grape;
          ctx.lineWidth = 4 / zoom * 1.6; ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, 7); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // le trou
        const R = hole.r * (1 + 0.16 * Math.max(0, hole.pulse));
        const og = ctx.createRadialGradient(hole.x, hole.y, R * 0.6, hole.x, hole.y, R * 1.45);
        og.addColorStop(0, "rgba(30,22,48,.30)"); og.addColorStop(1, "rgba(30,22,48,0)");
        ctx.fillStyle = og; ctx.beginPath(); ctx.arc(hole.x, hole.y, R * 1.45, 0, 7); ctx.fill();
        const bg = ctx.createRadialGradient(hole.x - R * 0.2, hole.y - R * 0.22, R * 0.12, hole.x, hole.y, R);
        bg.addColorStop(0, "#08080f"); bg.addColorStop(0.72, "#181428"); bg.addColorStop(1, "#3a3358");
        ctx.beginPath(); ctx.arc(hole.x, hole.y, R, 0, 7); ctx.fillStyle = bg; ctx.fill();
        ctx.save();
        ctx.translate(hole.x, hole.y); ctx.rotate(hole.ang);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 3.5 / zoom;
        ctx.setLineDash([R * 0.45, R * 0.3]);
        ctx.beginPath(); ctx.arc(0, 0, R + 2 / zoom, 0, 7); ctx.stroke();
        ctx.restore();
        ctx.beginPath(); ctx.arc(hole.x - R * 0.33, hole.y - R * 0.36, R * 0.15, 0, 7);
        ctx.fillStyle = "rgba(255,255,255,.13)"; ctx.fill();

        // emojis aspirés qui s'envolent
        for (const p of pops) {
          ctx.globalAlpha = Math.max(0, p.life) * 0.9;
          const s = hole.r * 0.5;
          ctx.drawImage(sprite(p.txt, 96), p.x - s / 2, p.y - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // flèches vers les objets hors écran (quand il en reste peu)
        if (playing && objects.length <= 12) {
          const cx = W / 2, cy = H / 2, m = 26 * uiS;
          for (const o of objects) {
            const sx = (o.x - cam.x) * zoom + cx, sy = (o.y - cam.y) * zoom + cy;
            if (sx > -20 && sx < W + 20 && sy > -20 && sy < H + 20) continue;
            const a = Math.atan2(sy - cy, sx - cx);
            const px = cx + Math.cos(a) * (Math.min(W, H) / 2 - m), py = cy + Math.sin(a) * (Math.min(W, H) / 2 - m);
            ctx.save(); ctx.translate(px, py);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = "#fff"; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 0, 15 * uiS, 0, 7); ctx.fill(); ctx.stroke();
            const s = 20 * uiS;
            ctx.drawImage(sprite(o.emoji, 96), -s / 2, -s / 2, s, s);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }

        // indice de départ
        if (hintT > 0 && playing) {
          ctx.globalAlpha = Math.min(1, hintT) * 0.9;
          ctx.fillStyle = theme.dark ? "#fff" : C.ink;
          ctx.font = "600 " + Math.round(17 * uiS) + "px Fredoka, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Glisse ton doigt · avale les 🟢 · grossis", W / 2, H - 26 * uiS);
          ctx.globalAlpha = 1;
        }
      }

      /* ================= Démarrage ================= */
      // Crochet de test automatisé (inactif en production : il faut poser
      // window.__ARCADE_DEBUG = true AVANT d'ouvrir le jeu).
      if (window.__ARCADE_DEBUG) {
        window.__hole = {
          get objects() { return objects; }, get hole() { return hole; },
          get playing() { return playing; }, get level() { return level; },
          get world() { return world; }, get zoom() { return zoom; },
          get counts() { return totalCount; },
        };
      }

      startLevel(save.lvl);   // construit un niveau réel derrière la carte
      openMap();              // …puis on ouvre sur la carte des niveaux
      raf = requestAnimationFrame(frame);

      api.onExit(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        removeOverlay();
        persist();
      });
    },
  });
})();
