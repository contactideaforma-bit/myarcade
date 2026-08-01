/* =========================================================
   Arcade Tycoon v3 — « Ma Fête Foraine »
   Refonte complète : progression étape par étape sur un parc
   de 9 emplacements (grille du fond assets/park/bg.jpg).

   PRINCIPE ANTI-INFLATION (le point clé de la refonte) :
   une SAISON est FINIE. 9 attractions, 25 niveaux chacune,
   4 paliers ⭐ (6/12/18/25) qui doublent la production.
   Les coûts (×1.22/niv) et les productions (×2.2/attraction)
   sont calibrés pour qu'une saison complète tienne en ~30 h de
   production continue (≈ 2-3 jours de jeu détendu avec le
   hors-ligne) et surtout pour que les nombres ne dépassent
   JAMAIS ~1 M/s et ~100 G cumulés. Plus de 1e30 illisible.
   La progression long terme passe par les saisons et les ⭐ VIP,
   pas par des zéros supplémentaires.
   ========================================================= */
(function () {
  const KEY = "arc_tycoon_v3";
  const OLDKEY = "arc_tycoon_v2";

  const MAXL = 25;                 // niveau max d'une attraction
  const MS = [6, 12, 18, 25];      // paliers ⭐ (×2 chacun → ×16 au max)
  const GR = 1.22;                 // croissance du coût par niveau
  const GATE = 18;                 // niveau requis pour débloquer la suivante

  // Ordre = ordre de lecture des cadres sur l'image de fond
  const ATTR = [
    { id: "carousel", name: "Carrousel",           emoji: "🎠", base: 1,   c0: 15 },
    { id: "ferris",   name: "Grande Roue",         emoji: "🎡", base: 2.2, c0: 105 },
    { id: "circus",   name: "Chapiteau",           emoji: "🎪", base: 5,   c0: 750 },
    { id: "coaster",  name: "Montagnes Russes",    emoji: "🎢", base: 11,  c0: 5200 },
    { id: "bumper",   name: "Autos Tamponneuses",  emoji: "🚗", base: 23,  c0: 36000 },
    { id: "striker",  name: "Marteau Forain",      emoji: "🔨", base: 52,  c0: 250000 },
    { id: "duck",     name: "Pêche aux Canards",   emoji: "🦆", base: 113, c0: 1.75e6 },
    { id: "popcorn",  name: "Stand de Pop-corn",   emoji: "🍿", base: 249, c0: 1.25e7 },
    { id: "fortune",  name: "Roulotte de Voyante", emoji: "🔮", base: 548, c0: 8.6e7 },
  ];

  // Position des 9 cadres, en % de l'image de fond (768 × 1344), mesurée sur le PNG
  const SX = [8.98, 40.36, 71.74], SY = [51.56, 66.96, 82.22], SW = 19.27, SH = 8.48;

  // Note du parc : 0 à 5 ⭐, multiplicateur global
  const NOTE = [
    { f: 0.85, s: 5, m: 3.0 }, { f: 0.65, s: 4, m: 2.2 }, { f: 0.45, s: 3, m: 1.7 },
    { f: 0.25, s: 2, m: 1.3 }, { f: 0.05, s: 1, m: 1.1 }, { f: -1, s: 0, m: 1 },
  ];

  // Boutique VIP — perks permanents, payés en ⭐ gagnées aux fins de saison
  const PERKS = [
    { id: "prod",    emoji: "📈", name: "Rendement",       max: 30, desc: (l) => "Production ×" + Math.pow(1.35, l).toFixed(2), cost: (l) => Math.ceil(5 * Math.pow(2, l)) },
    { id: "tap",     emoji: "👆", name: "Bouche à oreille", max: 10, desc: (l) => "Clic ×" + Math.pow(3, l),                     cost: (l) => Math.ceil(3 * Math.pow(2.2, l)) },
    { id: "golden",  emoji: "🪙", name: "Aimant à pièces",  max: 10, desc: (l) => "Pièces +" + l * 50 + "% fréquentes · gains +" + l * 40 + "%", cost: (l) => Math.ceil(6 * Math.pow(2, l)) },
    { id: "offline", emoji: "🌙", name: "Gardien de nuit",  max: 10, desc: (l) => "Hors-ligne " + (12 + 4 * l) + " h · " + Math.round(Math.min(0.95, 0.6 + 0.08 * l) * 100) + " %", cost: (l) => Math.ceil(5 * Math.pow(2, l)) },
    { id: "head",    emoji: "🚀", name: "Grande ouverture", max: 8,  desc: (l) => "Nouvelle saison : " + l + " attraction" + (l > 1 ? "s" : "") + " offerte" + (l > 1 ? "s" : "") + " niv. 10", cost: (l) => Math.ceil(8 * Math.pow(2.5, l)) },
    { id: "ticket",  emoji: "🎫", name: "Guichet doré",     max: 3,  desc: (l) => "+" + l + " billet" + (l > 1 ? "s" : "") + " d'or par palier ⭐", cost: (l) => Math.ceil(12 * Math.pow(3, l)) },
  ];

  const SUF = ["", "K", "M", "G", "T", "P"];
  function fmt(n) {
    if (!isFinite(n)) return "∞";
    if (n < 0) n = 0;
    if (n < 1000) return (Math.floor(n * 10) / 10).toString().replace(/\.0$/, "");
    let i = 0; while (n >= 999.5 && i < SUF.length - 1) { n /= 1000; i++; }
    return n.toFixed(2).replace(/\.?0+$/, "") + SUF[i];
  }
  const dur = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? h + " h " + m + " min" : (m ? m + " min" : Math.max(1, s) + " s"); };
  const msCount = (l) => { let n = 0; for (const x of MS) if (l >= x) n++; return n; };
  const msMult = (l) => Math.pow(2, msCount(l));
  const nextMs = (l) => { for (const x of MS) if (l < x) return x; return null; };

  window.ARCADE.register({
    id: "tycoon", title: "Ma Fête Foraine", emoji: "🎡",
    mount(board, api) {
      const C = api.colors;
      const rnd = (a, b) => a + Math.random() * (b - a);

      /* ================= Sauvegarde ================= */
      function fresh() {
        return {
          v: 3, season: 1, tokens: 0, gold: 0,           // 🎟️ jetons, 🎫 billets d'or
          lv: ATTR.map(() => 0), chef: ATTR.map(() => 0),
          vip: 0, vipTotal: 0,
          perks: { prod: 0, tap: 0, golden: 0, offline: 0, head: 0, ticket: 0 },
          lastSeen: Date.now(),
        };
      }
      function load() {
        let s = null;
        try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
        const b = fresh();
        if (s && s.v === 3) {
          const num = (v) => { v = +v; return isFinite(v) && v > 0 ? v : 0; };
          b.season = Math.max(1, s.season | 0); b.tokens = num(s.tokens); b.gold = Math.max(0, s.gold | 0);
          b.vip = num(s.vip); b.vipTotal = num(s.vipTotal); b.lastSeen = s.lastSeen || Date.now();
          if (Array.isArray(s.lv)) ATTR.forEach((a, i) => { b.lv[i] = Math.min(MAXL, Math.max(0, s.lv[i] | 0)); });
          if (Array.isArray(s.chef)) ATTR.forEach((a, i) => { b.chef[i] = s.chef[i] ? 1 : 0; });
          if (s.perks) Object.keys(b.perks).forEach((k) => { b.perks[k] = Math.max(0, s.perks[k] | 0); });
        } else {
          // Reprise depuis la v2 : on convertit les ⭐ VIP déjà gagnées, le reste repart à neuf.
          try {
            const old = JSON.parse(localStorage.getItem(OLDKEY) || "null");
            if (old && (old.vip || old.vipTotal)) {
              b.vip = Math.max(0, (+old.vip || 0) + 3); b.vipTotal = Math.max(0, +old.vipTotal || 0);
            }
          } catch (e) {}
        }
        return b;
      }
      function persist() { save.lastSeen = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
      let save = load();

      let frenzyT = 0, boostI = -1, boostT = 0;
      let dead = false, doneTimer = 0;   // garde-fou : rien ne doit survivre à api.onExit
      const FRENZY = 7;

      /* ================= Économie ================= */
      const built = (i) => save.lv[i] > 0;
      const canBuild = (i) => !built(i) && (i === 0 || save.lv[i - 1] >= GATE);
      const cost1 = (i) => Math.ceil(ATTR[i].c0 * Math.pow(GR, save.lv[i]));
      const costN = (i, n) => Math.ceil(ATTR[i].c0 * Math.pow(GR, save.lv[i]) * (Math.pow(GR, n) - 1) / (GR - 1));
      function maxAff(i) {
        let n = 0, cap = MAXL - save.lv[i];
        while (n < cap && costN(i, n + 1) <= save.tokens) n++;
        return n;
      }
      const totalLv = () => save.lv.reduce((a, b) => a + b, 0);
      function note() { const f = totalLv() / (ATTR.length * MAXL); for (const n of NOTE) if (f >= n.f) return n; return NOTE[NOTE.length - 1]; }
      const prodPerk = () => Math.pow(1.35, save.perks.prod);
      const tapPerk = () => Math.pow(3, save.perks.tap);
      const offlineCap = () => (12 + 4 * save.perks.offline) * 3600;
      const offlineEff = () => Math.min(0.95, 0.6 + 0.08 * save.perks.offline);
      const attrRate = (i) => ATTR[i].base * save.lv[i] * msMult(save.lv[i]) * (save.chef[i] ? 1.5 : 1) * (boostI === i && boostT > 0 ? 3 : 1);
      const rawSec = () => ATTR.reduce((s, a, i) => s + attrRate(i), 0) * prodPerk() * note().m;
      const perSec = () => rawSec() * (frenzyT > 0 ? FRENZY : 1);
      const tapBase = () => Math.max(1, Math.floor(rawSec() * 0.06)) * tapPerk();
      const tapGain = () => tapBase() * (frenzyT > 0 ? FRENZY : 1);
      const complete = () => save.lv.every((l) => l >= MAXL);
      const vipGain = () => save.lv.reduce((s, l) => s + msCount(l), 0) + (complete() ? 5 : 0);
      const chefCost = (i) => 3 + i;
      function earn(x) { save.tokens += x; }

      /* ================= Styles ================= */
      const style = document.createElement("style");
      style.textContent = `
        .pk-wrap{position:absolute;inset:0;font-family:Fredoka,system-ui,sans-serif;color:${C.ink};
          overflow:hidden;background:#123043;--u:3.9px;}
        .pk-wrap::before{content:'';position:absolute;inset:-30px;background:url('assets/park/bg.jpg') center/cover;
          filter:blur(22px) brightness(.72) saturate(1.1);}
        /* couche de défilement : sert uniquement quand le parc ne tient pas
           en hauteur (téléphone en paysage, fenêtre très basse) */
        .pk-scroll{position:absolute;inset:0;display:flex;overflow:auto;-webkit-overflow-scrolling:touch;}
        /* dimensions posées en px par layout() : aspect-ratio + max-height déforment
           la boîte quand la largeur est explicite, ce qui décalerait les 9 cadres */
        .pk-park{position:relative;margin:auto;flex:0 0 auto;overflow:hidden;
          background:url('assets/park/bg.jpg') center/100% 100% no-repeat;user-select:none;-webkit-user-select:none;}
        .pk-a{position:absolute;box-sizing:border-box;}

        /* --- HUD (recouvre la bannière d'origine) --- */
        .pk-hud{left:3%;right:3%;top:1.4%;height:12.6%;border-radius:16px;
          background:linear-gradient(180deg,#fffdf5,#ffeec9);border:3px solid ${C.ink};
          box-shadow:0 4px 0 ${C.ink},0 8px 18px rgba(0,0,0,.25);
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:2px 8px;}
        .pk-tok{font-weight:700;line-height:1;font-size:max(13px,calc(var(--u)*5.2));white-space:nowrap;}
        .pk-rate{font-family:'Patrick Hand',cursive;font-size:max(9px,calc(var(--u)*3.2));opacity:.8;line-height:1;}
        .pk-row2{display:flex;align-items:center;gap:6px;line-height:1;}
        .pk-note{font-size:max(9px,calc(var(--u)*2.9));letter-spacing:calc(var(--u)*-.25);}
        .pk-chip{font-size:max(9px,calc(var(--u)*2.8));font-weight:600;background:#fff;border:2px solid ${C.ink};
          border-radius:12px;padding:1px 7px;box-shadow:1px 2px 0 ${C.ink};white-space:nowrap;}
        .pk-chip.btn{cursor:pointer;background:${C.sun};}
        .pk-chip.btn:active{transform:translateY(2px);box-shadow:0 0 0 ${C.ink};}
        .pk-chip.hot{background:${C.lime};animation:pkPulse 1s ease-in-out infinite;}
        @keyframes pkPulse{50%{transform:scale(1.08);}}

        /* --- Scène (zone de tap + visiteurs + pièces) --- */
        .pk-scene{left:0;right:0;top:15%;height:33%;cursor:pointer;}
        .pk-vis{position:absolute;font-size:max(12px,calc(var(--u)*4));will-change:transform;
          filter:drop-shadow(0 2px 2px rgba(0,0,0,.35));pointer-events:none;}
        @keyframes pkWalk{from{left:-12%;}to{left:106%;}}
        @keyframes pkWalkR{from{left:106%;}to{left:-12%;}}
        .pk-taphint{position:absolute;left:50%;top:56%;transform:translateX(-50%);
          font-family:'Patrick Hand',cursive;font-size:max(10px,calc(var(--u)*3.4));color:#fff;
          background:rgba(43,36,64,.55);padding:2px 12px;border-radius:14px;white-space:nowrap;pointer-events:none;}

        /* --- Bandeau objectif --- */
        .pk-goal{left:4%;right:4%;top:41.4%;height:6.6%;border-radius:12px;
          background:linear-gradient(180deg,#fffdf5,#fff2d6);border:3px solid ${C.ink};
          box-shadow:0 3px 0 ${C.ink};display:flex;align-items:center;justify-content:center;
          padding:0 8px;text-align:center;overflow:hidden;}
        .pk-goal span{font-size:max(9px,calc(var(--u)*2.9));font-weight:600;line-height:1.05;}

        /* --- Emplacements --- */
        .pk-slot{border:none;background:none;padding:0;cursor:pointer;border-radius:9px;overflow:hidden;
          display:block;transition:transform .12s ease;}
        .pk-slot:active{transform:scale(.94);}
        .pk-slot img{width:100%;height:100%;object-fit:cover;display:block;}
        .pk-slot .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
          flex-direction:column;gap:1px;font-size:max(13px,calc(var(--u)*4.4));}
        .pk-slot .ph small{font-family:'Patrick Hand',cursive;font-size:max(8px,calc(var(--u)*2.4));font-weight:700;}
        .pk-lock{background:rgba(30,24,45,.55);color:#fff;}
        .pk-new{background:rgba(255,255,255,.35);color:${C.ink};
          box-shadow:inset 0 0 0 3px ${C.lime};animation:pkGlow 1.1s ease-in-out infinite;}
        @keyframes pkGlow{50%{box-shadow:inset 0 0 0 3px ${C.lime},0 0 14px 3px rgba(142,208,90,.9);}}
        .pk-badge{position:absolute;left:2px;bottom:2px;background:${C.ink};color:#fff;
          font-size:max(7px,calc(var(--u)*2.2));font-weight:600;border-radius:calc(var(--u)*2);padding:0 5px;line-height:1.5;
          box-shadow:0 1px 3px rgba(0,0,0,.4);}
        .pk-stars{position:absolute;right:2px;bottom:2px;font-size:max(6px,calc(var(--u)*1.9));
          letter-spacing:-1px;text-shadow:0 1px 2px rgba(0,0,0,.6);}
        .pk-chefb{position:absolute;left:2px;top:2px;font-size:max(8px,calc(var(--u)*2.4));
          filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));}
        .pk-up{position:absolute;right:2px;top:2px;width:max(11px,calc(var(--u)*3.4));height:max(11px,calc(var(--u)*3.4));
          border-radius:50%;background:${C.lime};border:2px solid ${C.ink};
          display:grid;place-items:center;font-size:max(7px,calc(var(--u)*2.1));font-weight:700;
          animation:pkPulse 1s ease-in-out infinite;}
        .pk-max{position:absolute;inset:0;box-shadow:inset 0 0 0 3px ${C.sun};border-radius:9px;}

        /* --- Barre d'action --- */
        .pk-act{left:4%;right:4%;top:91.4%;height:7.4%;border-radius:14px;cursor:pointer;
          background:linear-gradient(180deg,${C.lime},#79bd46);border:3px solid ${C.ink};
          box-shadow:0 4px 0 ${C.ink};display:flex;align-items:center;justify-content:center;gap:6px;
          font-weight:700;font-size:max(10px,calc(var(--u)*3.2));color:${C.ink};padding:0 8px;white-space:nowrap;}
        .pk-act:active{transform:translateY(3px);box-shadow:0 1px 0 ${C.ink};}
        .pk-act.off{background:linear-gradient(180deg,#dcd7e6,#c4bed3);color:#7a7490;}
        .pk-act.party{background:linear-gradient(180deg,${C.sun},${C.tang});}

        /* --- Effets --- */
        .pk-pop{position:absolute;z-index:30;pointer-events:none;font-weight:700;color:#fff;
          text-shadow:0 2px 0 ${C.ink},0 0 8px rgba(0,0,0,.5);font-size:max(12px,calc(var(--u)*3.8));
          transform:translate(-50%,-50%);animation:pkUp .8s ease forwards;}
        @keyframes pkUp{from{opacity:1;}to{opacity:0;transform:translate(-50%,-190%);}}
        .pk-coin{position:absolute;z-index:34;width:13%;aspect-ratio:1;border:none;background:none;cursor:pointer;
          font-size:max(24px,calc(var(--u)*9));line-height:1;filter:drop-shadow(0 0 9px gold) drop-shadow(0 3px 4px rgba(0,0,0,.4));
          animation:pkSpin 1.2s linear infinite;}
        @keyframes pkSpin{0%{transform:scale(1) rotate(-9deg);}50%{transform:scale(1.14) rotate(9deg);}100%{transform:scale(1) rotate(-9deg);}}
        .pk-toast{position:absolute;left:50%;top:24%;transform:translateX(-50%);z-index:40;
          background:${C.ink};color:#fff;font-weight:600;padding:8px 15px;border-radius:18px;
          border:2.5px solid #fff;box-shadow:0 6px 20px rgba(0,0,0,.4);white-space:nowrap;
          font-size:max(11px,calc(var(--u)*3.2));animation:pkToast 1.8s ease forwards;pointer-events:none;}
        @keyframes pkToast{0%{opacity:0;transform:translate(-50%,10px);}12%{opacity:1;transform:translateX(-50%);}80%{opacity:1;}100%{opacity:0;}}
        .pk-frz{position:absolute;left:50%;top:14.4%;transform:translateX(-50%);z-index:28;
          background:linear-gradient(135deg,${C.coral},${C.tang});color:#fff;font-weight:700;
          border:2.5px solid ${C.ink};border-radius:16px;padding:2px 12px;box-shadow:0 3px 0 ${C.ink};
          font-size:max(10px,calc(var(--u)*3));white-space:nowrap;}

        .pk-rotate{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:45;
          background:rgba(43,36,64,.85);color:#fff;border:2px solid #fff;border-radius:16px;
          padding:5px 14px;font-size:13px;font-weight:600;white-space:nowrap;pointer-events:none;
          box-shadow:0 4px 14px rgba(0,0,0,.45);}

        /* --- Overlays --- */
        .pk-ov{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;
          background:rgba(20,14,32,.72);padding:14px;overflow-y:auto;-webkit-overflow-scrolling:touch;}
        .pk-card{width:100%;max-width:min(94%,calc(var(--u)*90));background:${C.paper};
          border:4px solid ${C.ink};border-radius:22px;
          box-shadow:0 8px 0 ${C.ink},0 16px 34px rgba(0,0,0,.4);padding:14px;text-align:center;
          display:flex;flex-direction:column;gap:9px;max-height:100%;overflow-y:auto;}
        .pk-card h2{margin:0;font-size:max(17px,calc(var(--u)*5));}
        .pk-card p{margin:0;font-family:'Patrick Hand',cursive;font-size:max(14px,calc(var(--u)*4));line-height:1.25;}
        .pk-thumb{width:100%;aspect-ratio:300/232;border:3px solid ${C.ink};border-radius:14px;
          object-fit:cover;box-shadow:0 3px 0 ${C.ink};}
        .pk-bar{height:11px;background:#e6e1f0;border:2px solid ${C.ink};border-radius:8px;overflow:hidden;}
        .pk-bar i{display:block;height:100%;background:linear-gradient(90deg,${C.turq},${C.lime});}
        .pk-btn{display:block;width:100%;box-sizing:border-box;font-family:Fredoka;font-weight:700;
          font-size:max(13px,calc(var(--u)*3.7));color:${C.ink};background:${C.sun};
          border:3px solid ${C.ink};border-radius:14px;padding:9px 12px;box-shadow:0 4px 0 ${C.ink};cursor:pointer;}
        .pk-btn.neutral{background:#fff;}
        #pkSheet{display:flex;flex-direction:column;gap:9px;}
        .pk-btn:active{transform:translateY(3px);box-shadow:0 1px 0 ${C.ink};}
        .pk-btn.g{background:${C.lime};}
        .pk-btn.p{background:linear-gradient(135deg,${C.grape},${C.coral});color:#fff;}
        .pk-btn.off{background:#ded9e8;color:#8b85a0;box-shadow:0 4px 0 #b6b0c6;}
        .pk-btn.sm{font-size:max(12px,calc(var(--u)*3.2));padding:7px 9px;box-shadow:0 3px 0 ${C.ink};}
        .pk-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
        .pk-perk{display:flex;align-items:center;gap:9px;background:#fff;border:3px solid ${C.ink};
          border-radius:14px;padding:7px 9px;box-shadow:0 3px 0 ${C.ink};text-align:left;}
        .pk-perk .pe{font-size:max(19px,calc(var(--u)*5.6));}
        .pk-perk .pm{flex:1;min-width:0;}
        .pk-perk .pn{font-weight:600;font-size:max(12px,calc(var(--u)*3.4));}
        .pk-perk .pd{font-family:'Patrick Hand',cursive;font-size:max(11px,calc(var(--u)*3));opacity:.82;line-height:1.15;}
      `;
      board.appendChild(style);

      /* ================= DOM ================= */
      const wrap = document.createElement("div");
      wrap.className = "pk-wrap";
      wrap.innerHTML = `
        <div class="pk-scroll" id="pkScroll"><div class="pk-park" id="pkPark">
          <div class="pk-a pk-hud">
            <div class="pk-tok"><span id="pkTok">0</span> 🎟️</div>
            <div class="pk-rate"><span id="pkRate">0</span> 🎟️/s</div>
            <div class="pk-row2">
              <span class="pk-note" id="pkNote">☆☆☆☆☆</span>
              <span class="pk-chip" id="pkGold">🎫 0</span>
              <span class="pk-chip btn" id="pkShop">🛍️</span>
              <span class="pk-chip btn" id="pkSeason">Saison 1</span>
            </div>
          </div>
          <div class="pk-a pk-scene" id="pkScene">
            <div class="pk-taphint" id="pkHint">tape ici pour attirer du monde 👆</div>
          </div>
          <div class="pk-a pk-goal"><span id="pkGoal">…</span></div>
          <div class="pk-a pk-act" id="pkAct">…</div>
        </div></div>
        <div class="pk-rotate" id="pkRot" hidden>📱 Tourne ton téléphone pour voir tout le parc</div>`;
      board.appendChild(wrap);
      const $ = (s) => wrap.querySelector(s);
      const park = $("#pkPark"), scroller = $("#pkScroll"), scene = $("#pkScene"),
            hintEl = $("#pkHint"), rotEl = $("#pkRot");
      const tokEl = $("#pkTok"), rateEl = $("#pkRate"), noteEl = $("#pkNote"),
            goldEl = $("#pkGold"), goalEl = $("#pkGoal"), actEl = $("#pkAct"),
            seasonEl = $("#pkSeason");

      // 9 emplacements positionnés pile sur les cadres de l'image
      const slots = ATTR.map((a, i) => {
        const b = document.createElement("button");
        b.className = "pk-a pk-slot";
        b.style.left = SX[i % 3] + "%"; b.style.top = SY[(i / 3) | 0] + "%";
        b.style.width = SW + "%"; b.style.height = SH + "%";
        b.setAttribute("aria-label", a.name);
        b.addEventListener("click", () => openSheet(i));
        park.appendChild(b);
        return { el: b, sig: "" };
      });

      /* ================= Mise en page adaptative =================
         Le parc garde EXACTEMENT le ratio de l'image (768×1344), sinon les 9
         cadres se décalent. On le dimensionne donc en pixels :
           - il occupe la largeur disponible, plafonnée à 560 px (tablette : une
             colonne façon téléphone, centrée, plutôt qu'une image géante) ;
           - s'il ne tient pas en hauteur, il rétrécit ;
           - il ne descend jamais sous 300 px de large : en dessous (téléphone en
             paysage) on laisse défiler verticalement plutôt que de tout miniaturiser.
         --u vaut 1 % de la largeur du parc : toutes les tailles de texte en
         dépendent, donc l'interface reste proportionnée à toute échelle. */
      const RATIO = 1344 / 768, MAXW = 560, MINW = 300;
      function layout() {
        const W = scroller.clientWidth, H = scroller.clientHeight;
        if (!W || !H) return;
        let w = Math.min(W, MAXW);
        if (w * RATIO > H) w = H / RATIO;
        w = Math.max(w, Math.min(W, MINW));
        const h = Math.round(w * RATIO);
        park.style.width = Math.round(w) + "px";
        park.style.height = h + "px";
        wrap.style.setProperty("--u", (w / 100).toFixed(3) + "px");
        rotEl.hidden = h <= H + 2;   // le parc déborde → on suggère le portrait
      }
      layout();
      let ro = null;
      if (window.ResizeObserver) { ro = new ResizeObserver(layout); ro.observe(board); }
      window.addEventListener("resize", layout);
      window.addEventListener("orientationchange", layout);

      /* ================= Effets visuels ================= */
      function pop(x, y, txt) {
        const p = document.createElement("div"); p.className = "pk-pop"; p.textContent = txt;
        p.style.left = x + "px"; p.style.top = y + "px"; park.appendChild(p);
        setTimeout(() => p.remove(), 800);
      }
      function toast(txt) {
        const t = document.createElement("div"); t.className = "pk-toast"; t.textContent = txt;
        park.appendChild(t); setTimeout(() => t.remove(), 1800);
      }

      /* --- Visiteurs (animation 100 % CSS, aucun coût par frame) --- */
      const PEOPLE = ["🧑", "👩", "👨", "👧", "👦", "🧒", "👵", "👴", "🧑‍🦰", "👩‍🦱", "🎈", "🍭", "🐶"];
      let visitors = [];
      function syncVisitors() {
        const want = Math.min(14, 2 + save.lv.filter((l) => l > 0).length + Math.floor(totalLv() / 30));
        while (visitors.length > want) visitors.pop().remove();
        while (visitors.length < want) {
          const v = document.createElement("div");
          v.className = "pk-vis";
          v.textContent = PEOPLE[(Math.random() * PEOPLE.length) | 0];
          const right = Math.random() < 0.5;
          v.style.top = rnd(38, 92) + "%";
          v.style.left = "-12%";
          if (!right) v.style.transform = "scaleX(-1)";
          v.style.animation = `${right ? "pkWalk" : "pkWalkR"} ${rnd(13, 26).toFixed(1)}s linear ${(-rnd(0, 26)).toFixed(1)}s infinite`;
          scene.appendChild(v); visitors.push(v);
        }
      }

      /* --- Pièces d'or --- */
      let coin = null, coinT = rnd(5, 10);
      function spawnCoin() {
        if (wrap.querySelector(".pk-ov")) { coinT = 3; return; }
        const el = document.createElement("button");
        el.className = "pk-a pk-coin"; el.textContent = "🪙";
        el.style.top = rnd(17, 40) + "%"; el.style.left = "-14%";
        el.addEventListener("click", (e) => { e.stopPropagation(); takeCoin(el); });
        park.appendChild(el);
        coin = { el, x: -14, v: 128 / 9, life: 9.5 };
      }
      function dropCoin() { if (coin) { coin.el.remove(); coin = null; } coinT = rnd(35, 70) / (1 + 0.5 * save.perks.golden); }
      function takeCoin(el) {
        if (!coin || coin.el !== el) return;
        const lvl = save.perks.golden;
        const r = el.getBoundingClientRect(), p = park.getBoundingClientRect();
        const x = r.left - p.left + r.width / 2, y = r.top - p.top;
        const roll = Math.random();
        if (roll < 0.5) { frenzyT = Math.max(frenzyT, 25 * (1 + 0.2 * lvl)); toast("🔥 Frénésie ×" + FRENZY + " !"); }
        else if (roll < 0.8) {
          const amt = Math.max(rawSec() * 45, tapBase() * 60) * (1 + 0.4 * lvl) + 30;
          earn(amt); pop(x, y, "+" + fmt(amt)); toast("🪙 +" + fmt(amt) + " 🎟️ !");
        } else if (roll < 0.92) { save.gold += 1; toast("🎫 +1 billet d'or !"); }
        else {
          const owned = ATTR.map((a, i) => i).filter(built);
          if (owned.length) { boostI = owned[(Math.random() * owned.length) | 0]; boostT = 45; toast("🔥 " + ATTR[boostI].name + " ×3 · 45 s"); }
          else { earn(50); }
        }
        api.soundGood(); dropCoin(); refresh();
      }
      function updateCoin(dt) {
        if (coin) {
          coin.x += coin.v * dt; coin.life -= dt;
          coin.el.style.left = coin.x + "%";
          if (coin.x > 105 || coin.life <= 0) dropCoin();
        } else { coinT -= dt; if (coinT <= 0) spawnCoin(); }
      }

      /* ================= Actions ================= */
      function award(gain) {   // billets d'or gagnés aux paliers
        save.gold += gain * (1 + save.perks.ticket);
      }
      function levelUp(i, n) {
        n = Math.max(0, Math.min(n, MAXL - save.lv[i]));
        if (!n) return false;
        if (save.lv[i] === 0 && !canBuild(i)) return false;
        const c = costN(i, n);
        if (save.tokens < c) return false;
        const before = msCount(save.lv[i]), wasNew = save.lv[i] === 0;
        save.tokens -= c; save.lv[i] += n;
        const gained = msCount(save.lv[i]) - before;
        if (gained > 0) { award(gained); toast("⭐ Palier ! 🎫 +" + gained * (1 + save.perks.ticket)); api.soundGood(); }
        if (wasNew) {
          award(3); api.soundWin(); api.confetti();
          toast("🎉 " + ATTR[i].name + " ouvre ses portes !");
          syncVisitors();
        } else { api.beep(300 + Math.min(500, save.lv[i] * 14), 0.05, "square", 0.06); api.vibrate(10); }
        if (complete()) doneTimer = setTimeout(seasonDone, 600);
        refresh(); persist();
        return true;
      }
      function hireChef(i) {
        const c = chefCost(i);
        if (save.chef[i] || save.gold < c || !built(i)) return false;
        save.gold -= c; save.chef[i] = 1;
        api.soundWin(); toast("🧑‍🔧 Chef embauché sur " + ATTR[i].name + " !");
        refresh(); persist(); return true;
      }
      scene.addEventListener("click", (e) => {
        const g = tapGain(); earn(g);
        const p = park.getBoundingClientRect();
        pop(e.clientX - p.left, e.clientY - p.top, "+" + fmt(g));
        api.beep(640, 0.035, "sine", 0.045); api.vibrate(5);
        if (hintEl) hintEl.style.display = "none";
        refresh();
      });

      /* ================= Objectif courant ================= */
      function goal() {
        for (let i = 0; i < ATTR.length; i++) if (canBuild(i)) return { t: "build", i };
        let last = -1; for (let i = 0; i < ATTR.length; i++) if (built(i)) last = i;
        if (last >= 0 && last < ATTR.length - 1 && save.lv[last] < GATE) return { t: "gate", i: last };
        // tout construit : on pousse l'attraction la moins avancée vers son prochain palier
        let bi = -1;
        for (let i = 0; i < ATTR.length; i++) if (save.lv[i] < MAXL && (bi < 0 || save.lv[i] < save.lv[bi])) bi = i;
        if (bi >= 0) return { t: "level", i: bi, to: nextMs(save.lv[bi]) || MAXL };
        return { t: "done" };
      }
      function goalText(g) {
        if (g.t === "build") return "🎯 Construis " + ATTR[g.i].emoji + " " + ATTR[g.i].name;
        if (g.t === "gate") return "🎯 " + ATTR[g.i].name + " niv. " + save.lv[g.i] + "/" + GATE + " → ouvre " + ATTR[g.i + 1].emoji + " " + ATTR[g.i + 1].name;
        if (g.t === "level") return "🎯 " + ATTR[g.i].emoji + " " + ATTR[g.i].name + " niv. " + save.lv[g.i] + " → ⭐ " + g.to;
        return "🎊 Parc complet ! Lance une nouvelle saison";
      }

      /* ================= Fiche attraction ================= */
      function overlay(html) {
        const ov = document.createElement("div"); ov.className = "pk-ov";
        if (dead) return ov;
        ov.innerHTML = `<div class="pk-card">${html}</div>`;
        ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
        wrap.appendChild(ov); return ov;
      }
      let sheetI = -1, sheetOv = null, sheetMode = 1;
      function openSheet(i) {
        if (wrap.querySelector(".pk-ov")) return;
        sheetI = i; sheetMode = 1;
        sheetOv = overlay(`<div id="pkSheet"></div>`);
        drawSheet();
        sheetOv.addEventListener("click", (e) => {
          const b = e.target.closest("[data-act]"); if (!b) return;
          const act = b.dataset.act;
          if (act === "close") { sheetOv.remove(); sheetOv = null; sheetI = -1; return; }
          if (act === "mode") { sheetMode = b.dataset.n; drawSheet(); return; }
          if (act === "buy") { levelUp(sheetI, buyN()); drawSheet(); return; }
          if (act === "chef") { hireChef(sheetI); drawSheet(); return; }
        });
      }
      const buyN = () => (sheetMode === "max" ? Math.max(1, maxAff(sheetI)) : parseInt(sheetMode, 10) || 1);
      function drawSheet() {
        if (!sheetOv) return;
        const i = sheetI, a = ATTR[i], lv = save.lv[i], box = sheetOv.querySelector("#pkSheet");
        if (!built(i)) {
          if (canBuild(i)) {
            const c = cost1(i), can = save.tokens >= c;
            box.innerHTML = `
              <h2>${a.emoji} ${a.name}</h2>
              <img class="pk-thumb" src="assets/park/att/${a.id}.jpg" alt="${a.name}" style="opacity:.45;filter:grayscale(.6)">
              <p>Prête à être construite !<br>Elle produira <b>${fmt(a.base * note().m * prodPerk())} 🎟️/s</b> au niveau 1.</p>
              <button class="pk-btn ${can ? "g" : "off"}" data-act="buy">🔨 Construire · 🎟️ ${fmt(c)}</button>
              <button class="pk-btn sm neutral" data-act="close">Fermer</button>`;
          } else {
            const p = ATTR[i - 1];
            box.innerHTML = `
              <h2>🔒 ${a.name}</h2>
              <img class="pk-thumb" src="assets/park/att/${a.id}.jpg" alt="" style="opacity:.2;filter:grayscale(1)">
              <p>Emplacement verrouillé.<br>Monte <b>${p.emoji} ${p.name}</b> au <b>niveau ${GATE}</b><br>(actuellement ${save.lv[i - 1]}/${GATE}) pour l'ouvrir.</p>
              <div class="pk-bar"><i style="width:${Math.min(100, (save.lv[i - 1] / GATE) * 100)}%"></i></div>
              <button class="pk-btn sm neutral" data-act="close">Fermer</button>`;
          }
          return;
        }
        const nm = nextMs(lv), n = buyN(), maxed = lv >= MAXL;
        const c = maxed ? 0 : costN(i, Math.min(n, MAXL - lv));
        const can = !maxed && save.tokens >= c;
        const realN = Math.min(n, MAXL - lv);
        const chefOk = save.chef[i], cc = chefCost(i);
        box.innerHTML = `
          <h2>${a.emoji} ${a.name}</h2>
          <img class="pk-thumb" src="assets/park/att/${a.id}.jpg" alt="${a.name}">
          <div style="font-weight:700;font-size:1.05rem">Niveau ${lv} / ${MAXL} ${"⭐".repeat(msCount(lv))}</div>
          <div class="pk-bar"><i style="width:${(lv / MAXL) * 100}%"></i></div>
          <p>Produit <b>${fmt(attrRate(i) * prodPerk() * note().m)} 🎟️/s</b>${save.chef[i] ? " · chef +50 %" : ""}<br>
             ${nm ? "Prochain palier ⭐ ×2 au niveau <b>" + nm + "</b> (dans " + (nm - lv) + ")" : "Tous les paliers ⭐ atteints !"}</p>
          ${maxed ? `<div class="pk-btn off">🏆 Niveau maximum</div>` : `
          <div class="pk-grid3">
            ${["1", "5", "max"].map((m) => `<button class="pk-btn sm ${sheetMode == m ? "" : "neutral"}" data-act="mode" data-n="${m}">${m === "max" ? "Max" : "×" + m}</button>`).join("")}
          </div>
          <button class="pk-btn ${can ? "g" : "off"}" data-act="buy">⬆️ Améliorer ×${realN} · 🎟️ ${fmt(c)}</button>`}
          <button class="pk-btn ${chefOk ? "off" : (save.gold >= cc ? "" : "off")}" data-act="chef">
            ${chefOk ? "🧑‍🔧 Chef embauché (+50 %)" : "🧑‍🔧 Embaucher un chef · 🎫 " + cc}</button>
          <button class="pk-btn sm neutral" data-act="close">Fermer</button>`;
      }

      /* ================= Boutique VIP ================= */
      function openShop() {
        if (wrap.querySelector(".pk-ov")) return;
        const ov = overlay(`<h2>🛍️ Boutique VIP</h2><p>Bonus <b>permanents</b>, conservés d'une saison à l'autre.<br>Tu as <b id="pkSv">${fmt(save.vip)}</b> ⭐</p><div id="pkPerks" style="display:flex;flex-direction:column;gap:8px"></div><button class="pk-btn sm neutral" data-act="close">Fermer</button>`);
        const list = ov.querySelector("#pkPerks");
        function draw() {
          list.innerHTML = "";
          PERKS.forEach((p) => {
            const l = save.perks[p.id], top = l >= p.max, cost = p.cost(l), can = !top && save.vip >= cost;
            const row = document.createElement("div"); row.className = "pk-perk";
            row.innerHTML = `<span class="pe">${p.emoji}</span><div class="pm"><div class="pn">${p.name} <span style="opacity:.5">niv.${l}</span></div><div class="pd">${top ? "Niveau maximum" : p.desc(l + 1)}</div></div><button class="pk-btn sm ${can ? "" : "off"}">${top ? "🏆" : "⭐ " + fmt(cost)}</button>`;
            row.querySelector("button").addEventListener("click", () => {
              const c = p.cost(save.perks[p.id]);
              if (save.perks[p.id] >= p.max || save.vip < c) return;
              save.vip -= c; save.perks[p.id]++;
              api.beep(740, 0.05, "triangle", 0.07);
              ov.querySelector("#pkSv").textContent = fmt(save.vip);
              draw(); refresh(); persist();
            });
            list.appendChild(row);
          });
        }
        draw();
        ov.addEventListener("click", (e) => { if (e.target.closest("[data-act='close']")) ov.remove(); });
      }

      /* ================= Fin de saison / prestige ================= */
      function openSeason() {
        if (wrap.querySelector(".pk-ov")) return;
        const g = vipGain(), done = complete();
        const ov = overlay(`
          <h2>${done ? "🎊 Parc complet !" : "🎪 Saison " + save.season}</h2>
          <p>${done ? "Tu as tout construit et tout amélioré. Bravo !" : "Tu peux clore la saison quand tu veux."}<br>
             Progression : <b>${totalLv()} / ${ATTR.length * MAXL}</b> niveaux<br>
             Note du parc : <b>${"⭐".repeat(note().s) || "—"}</b> (×${note().m})</p>
          <p>Une nouvelle saison remet le parc à zéro<br>(jetons, attractions, chefs)<br>
             et te donne <b>+${g} ⭐ VIP</b> à dépenser dans la boutique.<br>
             Les bonus VIP, eux, sont <b>gardés pour toujours</b>.</p>
          <button class="pk-btn ${g >= 1 ? "p" : "off"}" data-act="go">${g >= 1 ? "🎪 Nouvelle saison · +" + g + " ⭐" : "Atteins un palier ⭐ d'abord"}</button>
          <button class="pk-btn sm neutral" data-act="close">Continuer à jouer</button>`);
        ov.addEventListener("click", (e) => {
          if (e.target.closest("[data-act='close']")) ov.remove();
          if (e.target.closest("[data-act='go']") && vipGain() >= 1) { newSeason(); ov.remove(); }
        });
      }
      function seasonDone() { doneTimer = 0; if (dead) return; api.win(); openSeason(); }
      function newSeason() {
        const g = vipGain();
        save.vip += g; save.vipTotal += g; save.season++;
        save.tokens = 0; save.gold = 0;
        save.lv = ATTR.map(() => 0); save.chef = ATTR.map(() => 0);
        for (let i = 0; i < Math.min(save.perks.head, ATTR.length); i++) save.lv[i] = 10;   // 🚀 Grande ouverture
        frenzyT = 0; boostI = -1; boostT = 0; dropCoin(); coinT = rnd(5, 10);
        api.soundWin(); api.confetti();
        toast("🎪 Saison " + save.season + " · +" + g + " ⭐ VIP");
        syncVisitors(); refresh(); persist();
      }

      $("#pkShop").addEventListener("click", openShop);
      seasonEl.addEventListener("click", openSeason);
      actEl.addEventListener("click", () => {
        const g = goal();
        if (g.t === "done") { openSeason(); return; }
        if (g.t === "build") { if (!levelUp(g.i, 1)) api.soundBad(); return; }
        if (!levelUp(g.i, 1)) api.soundBad();
      });

      /* ================= Rendu ================= */
      let lastAct = "", lastGoal = "", lastStatus = "";
      function refresh() {
        tokEl.textContent = fmt(save.tokens);
        rateEl.textContent = fmt(perSec()) + (frenzyT > 0 ? " 🔥" : "");
        const nt = note();
        noteEl.textContent = "⭐".repeat(nt.s) + "☆".repeat(5 - nt.s);
        noteEl.title = "Note du parc — multiplicateur ×" + nt.m;
        goldEl.textContent = "🎫 " + save.gold;
        seasonEl.textContent = "Saison " + save.season;
        seasonEl.classList.toggle("hot", vipGain() >= 1 && complete());

        // frénésie
        let frz = wrap.querySelector(".pk-frz");
        if (frenzyT > 0) {
          if (!frz) { frz = document.createElement("div"); frz.className = "pk-frz"; park.appendChild(frz); }
          frz.textContent = "🔥 ×" + FRENZY + " · " + Math.ceil(frenzyT) + " s";
        } else if (frz) frz.remove();

        // emplacements
        ATTR.forEach((a, i) => {
          const s = slots[i], lv = save.lv[i];
          let sig;
          if (!built(i)) sig = canBuild(i) ? "n" + (save.tokens >= cost1(i) ? 1 : 0) : "l" + save.lv[i - 1];
          else sig = "b" + lv + (save.chef[i] ? "c" : "") + (lv < MAXL && save.tokens >= cost1(i) ? "+" : "");
          if (sig === s.sig) return;
          s.sig = sig;
          if (!built(i)) {
            s.el.innerHTML = canBuild(i)
              ? `<div class="ph pk-new">🔨<small>🎟️ ${fmt(cost1(i))}</small></div>`
              : `<div class="ph pk-lock">🔒<small>niv. ${save.lv[i - 1]}/${GATE}</small></div>`;
          } else {
            s.el.innerHTML =
              `<img src="assets/park/att/${a.id}.jpg" alt="${a.name}">` +
              (lv >= MAXL ? `<div class="pk-max"></div>` : "") +
              `<div class="pk-badge">${lv}</div>` +
              (msCount(lv) ? `<div class="pk-stars">${"⭐".repeat(msCount(lv))}</div>` : "") +
              (save.chef[i] ? `<div class="pk-chefb">🧑‍🔧</div>` : "") +
              (lv < MAXL && save.tokens >= cost1(i) ? `<div class="pk-up">↑</div>` : "");
          }
        });

        // objectif + bouton d'action
        const g = goal(), gt = goalText(g);
        if (gt !== lastGoal) { lastGoal = gt; goalEl.textContent = gt; }
        let txt, off = false, party = false;
        if (g.t === "done") { txt = "🎪 Nouvelle saison · +" + vipGain() + " ⭐"; party = true; }
        else {
          const c = cost1(g.i);
          off = save.tokens < c;
          const ps = perSec();
          const eta = off && ps > 0 ? " (dans " + dur((c - save.tokens) / ps) + ")" : "";
          txt = (g.t === "build" ? "🔨 Construire " + ATTR[g.i].name : "⬆️ " + ATTR[g.i].name + " niv. " + (save.lv[g.i] + 1)) + " · 🎟️ " + fmt(c) + eta;
        }
        if (txt !== lastAct) { lastAct = txt; actEl.textContent = txt; }
        actEl.classList.toggle("off", off && !party);
        actEl.classList.toggle("party", party);

        if (sheetOv) drawSheet();
        const st = fmt(perSec()) + " 🎟️/s";
        if (st !== lastStatus) { lastStatus = st; api.setStatus(st); }
      }

      /* ================= Hors-ligne ================= */
      function offlineGain(seconds) {
        const dt = Math.min(Math.max(0, seconds), offlineCap());
        return { dt, gain: rawSec() * dt * offlineEff() };
      }
      (function bootOffline() {
        const now = Date.now();
        const { dt, gain } = offlineGain((now - (save.lastSeen || now)) / 1000);
        if (dt > 20 && gain > 0) {
          earn(gain);
          const ov = overlay(`<h2>Re-bonjour ! 👋</h2>
            <p>Ta fête foraine a tourné pendant<br><b>${dur(dt)}</b></p>
            <div style="font-size:1.5rem;font-weight:700">+${fmt(gain)} 🎟️</div>
            <p style="opacity:.7">rendement hors-ligne : ${Math.round(offlineEff() * 100)} %<br>(améliorable avec 🌙 Gardien de nuit)</p>
            <button class="pk-btn g" data-act="close">Encaisser</button>`);
          ov.addEventListener("click", (e) => { if (e.target.closest("[data-act='close']")) { ov.remove(); refresh(); } });
        }
      })();

      /* ================= Boucle ================= */
      syncVisitors();
      if (totalLv() > 0 && hintEl) hintEl.style.display = "none";
      refresh();
      let last = Date.now(), acc = 0;
      const iv = setInterval(() => {
        if (document.hidden) return;
        const now = Date.now(), dt = Math.min(1, (now - last) / 1000); last = now;
        if (frenzyT > 0) frenzyT = Math.max(0, frenzyT - dt);
        if (boostT > 0) { boostT = Math.max(0, boostT - dt); if (!boostT) boostI = -1; }
        earn(perSec() * dt);
        updateCoin(dt);
        refresh();
        acc += dt; if (acc >= 4) { acc = 0; persist(); }
      }, 200);

      function onVis() {
        if (document.hidden) { persist(); return; }
        const now = Date.now(), away = (now - (save.lastSeen || now)) / 1000;
        last = now;
        if (away > 20) {
          const { gain } = offlineGain(away);
          if (gain > 0) { earn(gain); toast("+" + fmt(gain) + " 🎟️ pendant ton absence"); api.soundGood(); }
          refresh(); persist();
        }
      }
      document.addEventListener("visibilitychange", onVis);

      api.onExit(() => {
        dead = true;
        if (doneTimer) { clearTimeout(doneTimer); doneTimer = 0; }
        clearInterval(iv);
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("resize", layout);
        window.removeEventListener("orientationchange", layout);
        if (ro) { ro.disconnect(); ro = null; }
        dropCoin();
        visitors.forEach((v) => v.remove()); visitors = [];
        persist();
      });
    },
  });
})();
