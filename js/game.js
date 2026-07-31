/* =========================================================
   TRIAGE — jeu de tri d'emojis
   HTML/CSS/JS pur · drag & drop + tap-tap · mobile
   ========================================================= */

/* ---------- Données : catégories d'emojis ---------- */
const CATEGORIES = {
  fruits:     { label: "Fruits",    icon: "🧺", emojis: ["🍎","🍌","🍓","🍊","🍇","🍉","🍑","🍐","🥝","🍍","🍒","🥭"] },
  animaux:    { label: "Animaux",   icon: "🐾", emojis: ["🐶","🐱","🐰","🦊","🐻","🐼","🐨","🦁","🐯","🐮","🐷","🐸"] },
  vehicules:  { label: "Véhicules", icon: "🛣️", emojis: ["🚗","🚌","🚕","🚙","🚲","🏍️","🚚","✈️","🚀","🚂","🚁","⛵"] },
  sports:     { label: "Sports",    icon: "🏅", emojis: ["⚽","🏀","🎾","🏈","⚾","🏐","🏓","🥎","🏉","🎱","🏸","🥅"] },
  nourriture: { label: "À manger",  icon: "🍽️", emojis: ["🍕","🍔","🌭","🍟","🌮","🍣","🍩","🍪","🧁","🍰","🥐","🥨"] },
  meteo:      { label: "Météo",     icon: "🌤️", emojis: ["☀️","🌧️","⛈️","❄️","🌈","🌪️","🌙","⭐","☁️","⚡","🌊","💧"] },
};

/* ---------- Catégories couleur (niveau spécial) ---------- */
const COLORS = {
  rouge:  { label: "Rouge",  icon: "🔴", emojis: ["🍎","❤️","🌹","🍓","🎈","🚒","🌶️","🍅"] },
  jaune:  { label: "Jaune",  icon: "🟡", emojis: ["🍌","⭐","🌻","🧀","🐤","🌙","🍋","🏵️"] },
  vert:   { label: "Vert",   icon: "🟢", emojis: ["🥝","🐸","🌲","🥦","🍀","🐢","🥬","🫑"] },
  bleu:   { label: "Bleu",   icon: "🔵", emojis: ["💙","🐋","🌊","🫐","🧊","🐬","💎","🌀"] },
  orange: { label: "Orange", icon: "🟠", emojis: ["🍊","🥕","🦊","🏀","🔶","🎃","📙","🧡"] },
  violet: { label: "Violet", icon: "🟣", emojis: ["🍇","🍆","🔮","💜","🪀","☂️","👾","🟪"] },
  rose:   { label: "Rose",   icon: "🌸", emojis: ["🐷","💗","🎀","🦩","💖","🌷","🩰","🌺"] },
};

/* ---------- Définition des niveaux ---------- */
const LEVELS = [
  { name: "Niveau 1 · Découverte",     cats: ["fruits", "animaux", "vehicules"],              perCat: 6 },
  { name: "Niveau 2 · Ça s'anime",     cats: ["fruits", "animaux", "vehicules", "sports"],    perCat: 6 },
  { name: "Niveau 3 · Gourmandise",    cats: ["nourriture", "fruits", "sports", "animaux"],   perCat: 7 },
  { name: "Niveau 4 · Les couleurs",   color: true,                                           perCat: 7 },
  { name: "Niveau 5 · Grand ciel",     cats: ["meteo", "animaux", "vehicules", "sports"],     perCat: 8 },
  { name: "Niveau 6 · Le grand tri",   cats: ["fruits", "animaux", "vehicules", "sports", "nourriture"], perCat: 9 },
];

/* ---------- Mode "couleurs" : trier tout le tas par teinte ---------- */
const COULEURS_LEVELS = [
  { name: "Couleurs · Arc-en-ciel",   perCat: 6 },
  { name: "Couleurs · Palette",       perCat: 8 },
  { name: "Couleurs · Grand mélange", perCat: 10 },
];

/* ---------- Mode "jumeaux" : regrouper les emojis identiques ---------- */
const ALL_EMOJIS = [...new Set(Object.values(CATEGORIES).flatMap((c) => c.emojis))];
const JUMEAUX = [
  { name: "Jumeaux · 15 sortes",   types: 15, copies: 2 }, // 30 emojis
  { name: "Jumeaux · l'amas",      types: 15, copies: 3 }, // 45 emojis
  { name: "Jumeaux · le grand tas", types: 15, copies: 4 }, // 60 emojis
];

/* ---------- Mode "match3" : taper 3 emojis identiques pour les éliminer ---------- */
// copies TOUJOURS multiples de 3 → le tas se vide entièrement
const MATCH3 = [
  { name: "Match 3 · Trio",    types: 6,  copies: 3 },  // 18
  { name: "Match 3 · Combo",   types: 8,  copies: 6 },  // 48
  { name: "Match 3 · Cascade", types: 10, copies: 6 },  // 60
];

/* ---------- Niveaux de difficulté ----------
   La difficulté ne change plus SEULEMENT la quantité, mais aussi le NOMBRE DE
   BACS (= le vrai défi) :
   - binDelta : bacs ajoutés/retirés par rapport au thème du niveau (familles/couleurs).
   - jTypes   : nb de sortes (= nb de cases) en mode jumeaux.
   - m3Types  : nb de sortes différentes en mode match3 (plus = trios plus durs à repérer).
   - perCat(base) : nb d'emojis par case (familles/couleurs).
   - jCopies(base): nb d'exemplaires par sorte (jumeaux).
   EXTREME_TARGET : nombre TOTAL d'emojis visé en Extrême. */
const EXTREME_TARGET = 1000;
const DIFFICULTY = {
  facile:    { label: "Facile",    binDelta: -1, perCat: (b) => Math.max(3, b - 2), jTypes: 6,  m3Types: 5,  jCopies: (c) => c },
  moyen:     { label: "Moyen",     binDelta: 0,  perCat: (b) => b,                  jTypes: 10, m3Types: 8,  jCopies: (c) => c },
  difficile: { label: "Difficile", binDelta: 2,  perCat: (b) => b + 3,              jTypes: 16, m3Types: 12, jCopies: (c) => c + 2 },
  // Extrême : un maximum de bacs + un énorme tas (piloté par EXTREME_TARGET).
  extreme:   { label: "Extrême",   binDelta: 6,  perCat: (b) => b * 4 + 18,         jTypes: 24, m3Types: 15, jCopies: (c) => c + 9, target: EXTREME_TARGET },
};

/* ---------- Fonds d'écran personnalisables ---------- */
const BACKGROUNDS = [
  "linear-gradient(160deg, #7f9cff, #b78cff 55%, #ff9ecf)",
  "linear-gradient(160deg, #43cea2, #185a9d)",
  "linear-gradient(160deg, #ff9a9e, #fad0c4 55%, #ffd1a9)",
  "linear-gradient(160deg, #2b5876, #4e4376)",
  "linear-gradient(160deg, #f6d365, #fda085)",
  "radial-gradient(circle at 30% 20%, #1a2a6c, #0f1226 70%)",
  "linear-gradient(160deg, #00c6fb, #005bea)",
  "linear-gradient(160deg, #a8edea, #fed6e3)",
  "linear-gradient(160deg, #30cfd0, #330867)",
];

/* ---------- État ---------- */
const state = {
  mode: "familles",       // "familles" | "couleurs" | "jumeaux" | "match3"
  difficulty: "moyen",    // "facile" | "moyen" | "difficile" | "extreme"
  level: 0,           // index dans LEVELS (mode familles)
  clevel: 0,          // index dans COULEURS_LEVELS (mode couleurs)
  jlevel: 0,          // index dans JUMEAUX (mode jumeaux)
  m3level: 0,         // index dans MATCH3 (mode match3)
  score: 0,
  levelStartScore: 0,   // score au début du niveau (↺ ne garde pas les points du niveau abandonné)
  remaining: 0,
  total: 0,
  mistakes: 0,
  t0: 0,              // début du niveau (objectif « rapide »)
  daily: false,       // partie « défi du jour » en cours
  combo: 0,           // série de bons rangements consécutifs
  maxCombo: 0,        // meilleure série du niveau
  selected: null,
  bgIndex: 0,
  sound: true,
  vibrate: true,
  locked: false,
};

/* ---------- Vibration (haptique) — respecte le réglage, anti-spam ----------
   Android/Chrome : Vibration API (navigator.vibrate).
   iPhone : pas d'API vibration → on utilise l'astuce du <input switch> dont le
   basculement déclenche un retour haptique léger sur iOS 17.4+ (best effort). */
let _lastVib = 0, _hapticLabel = null, _hapticInput = null;
function _iosHaptic() {
  try {
    if (!_hapticLabel) {
      _hapticInput = document.createElement("input");
      _hapticInput.type = "checkbox";
      _hapticInput.setAttribute("switch", "");
      _hapticLabel = document.createElement("label");
      _hapticLabel.setAttribute("aria-hidden", "true");
      _hapticLabel.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden;";
      _hapticLabel.appendChild(_hapticInput);
      document.body.appendChild(_hapticLabel);
    }
    _hapticLabel.click();   // bascule le switch → tap haptique sur iOS récents
  } catch (e) {}
}
function vibrate(pattern) {
  if (!state.vibrate) return;
  const now = Date.now();
  if (now - _lastVib < 28) return;          // évite de mitrailler le moteur
  _lastVib = now;
  if ("vibrate" in navigator) { try { navigator.vibrate(pattern); return; } catch (e) {} }
  _iosHaptic();                              // repli iPhone
}

/* Helpers de progression selon le mode courant */
const modeList = () => (state.mode === "jumeaux" ? JUMEAUX : state.mode === "match3" ? MATCH3 : state.mode === "couleurs" ? COULEURS_LEVELS : LEVELS);
const modeIdx = () => (state.mode === "jumeaux" ? state.jlevel : state.mode === "match3" ? state.m3level : state.mode === "couleurs" ? state.clevel : state.level);
const setModeIdx = (i) => {
  if (state.mode === "jumeaux") state.jlevel = i;
  else if (state.mode === "match3") state.m3level = i;
  else if (state.mode === "couleurs") state.clevel = i;
  else state.level = i;
};

/* ---------- Raccourcis DOM ---------- */
const $ = (id) => document.getElementById(id);
const pool = $("pool");
const stage = $("stage");
const binsEl = $("bins");

/* ---------- Stockage (best effort) ---------- */
function save() {
  try {
    localStorage.setItem("triage", JSON.stringify({
      bgIndex: state.bgIndex, sound: state.sound, vibrate: state.vibrate, mode: state.mode, difficulty: state.difficulty,
      level: state.level, clevel: state.clevel, jlevel: state.jlevel, m3level: state.m3level, score: state.score,
    }));
  } catch (e) { /* stockage indisponible : on continue sans */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem("triage") || "{}");
    if (typeof d.bgIndex === "number") state.bgIndex = d.bgIndex;
    if (typeof d.sound === "boolean") state.sound = d.sound;
    if (typeof d.vibrate === "boolean") state.vibrate = d.vibrate;
    if (["familles", "couleurs", "jumeaux", "match3"].includes(d.mode)) state.mode = d.mode;
    if (DIFFICULTY[d.difficulty]) state.difficulty = d.difficulty;
    if (typeof d.level === "number") state.level = Math.min(d.level, LEVELS.length - 1);
    if (typeof d.clevel === "number") state.clevel = Math.min(d.clevel, COULEURS_LEVELS.length - 1);
    if (typeof d.jlevel === "number") state.jlevel = Math.min(d.jlevel, JUMEAUX.length - 1);
    if (typeof d.m3level === "number") state.m3level = Math.min(d.m3level, MATCH3.length - 1);
    if (typeof d.score === "number") state.score = d.score;
    state.levelStartScore = state.score;
  } catch (e) { /* rien à charger */ }
}

/* ---------- Méta persistée : étoiles, progression, trésor, défi du jour ----------
   - stars    : meilleures étoiles par mode|difficulté et par niveau
   - reached  : plus haut niveau atteint par mode (déblocage de la carte)
   - wallet   : trésor cumulé (⭐) — monnaie pour débloquer les fonds d'écran
   - daily    : vraie série du défi du jour (last = dernier jour réussi) */
const META_KEY = "triage_meta";
const meta = { stars: {}, reached: {}, wallet: 0, bgUnlocked: [0, 1, 2], daily: { last: "", streak: 0, doneDay: "" } };
function loadMeta() {
  try {
    const d = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    if (d.stars && typeof d.stars === "object") meta.stars = d.stars;
    if (d.reached && typeof d.reached === "object") meta.reached = d.reached;
    if (typeof d.wallet === "number" && d.wallet >= 0) meta.wallet = d.wallet;
    if (Array.isArray(d.bgUnlocked)) meta.bgUnlocked = [...new Set([0, 1, 2, ...d.bgUnlocked])];
    if (d.daily) meta.daily = { last: d.daily.last || "", streak: Math.max(0, d.daily.streak | 0), doneDay: d.daily.doneDay || "" };
  } catch (e) { /* rien */ }
}
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {} }
function getStars(mode, diff, idx) { return ((meta.stars[mode + "|" + diff] || [])[idx]) || 0; }
function setStars(idx, n) {
  const k = state.mode + "|" + state.difficulty;
  const a = meta.stars[k] || (meta.stars[k] = []);
  if (n > (a[idx] || 0)) a[idx] = n;
}
function getReached(mode) { return meta.reached[mode] || 0; }
function bumpReached(mode, idx) { if (idx > getReached(mode)) meta.reached[mode] = idx; }

/* Jour local AAAA-MM-JJ + petit PRNG seedé (défi du jour identique pour tous) */
const dayStr = (d = new Date()) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Sauvegarde de la PARTIE EN COURS (reprise après avoir quitté) ---------- */
const SAVE_KEY = "triage_save";
function saveGame() {
  try {
    if (state.daily) { localStorage.removeItem(SAVE_KEY); return; }   // le défi du jour ne se reprend pas
    if (!state.total || state.remaining <= 0) { localStorage.removeItem(SAVE_KEY); return; }
    const tokens = [];
    stage.querySelectorAll(".token").forEach((el) => {
      if (el.dataset.placed) return;
      tokens.push({
        e: el.textContent,
        c: el.dataset.cat,
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
        s: el.style.getPropertyValue("--size"),
        r: el.dataset.rot || "0",
        a: el.dataset.alt || "",
        g: el.dataset.gold || "",
        f: el.dataset.frozen || "",
      });
    });
    const bins = [...binsEl.querySelectorAll(".bin")].map((b) => ({
      cat: b.dataset.cat,
      icon: b.querySelector(".bin-icon").textContent,
      label: b.querySelector(".bin-label").textContent,
      count: b.querySelector(".bin-count").dataset.count || "0",
      exp: b.dataset.expected || "0",
    }));
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 2, mode: state.mode, difficulty: state.difficulty,
      level: state.level, clevel: state.clevel, jlevel: state.jlevel, m3level: state.m3level,
      score: state.score, lss: state.levelStartScore,
      total: state.total, remaining: state.remaining, mistakes: state.mistakes, maxCombo: state.maxCombo,
      name: $("levelName").textContent, hint: $("hint").textContent,
      gridMany: binsEl.classList.contains("grid-many"),
      bins, tokens,
    }));
  } catch (e) { /* stockage plein/indispo : tant pis */ }
}
function loadGame() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { return null; }
}
function clearGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

function restoreGame(snap) {
  state.mode = snap.mode; state.difficulty = snap.difficulty;
  state.level = snap.level || 0; state.clevel = snap.clevel || 0; state.jlevel = snap.jlevel || 0; state.m3level = snap.m3level || 0;
  state.score = snap.score || 0; state.total = snap.total || 0; state.remaining = snap.remaining || 0;
  state.levelStartScore = (typeof snap.lss === "number") ? snap.lss : (snap.score || 0);
  state.mistakes = snap.mistakes || 0;   // sinon les étoiles de fin étaient faussées après une reprise
  state.combo = 0; state.maxCombo = snap.maxCombo || 0;
  state.t0 = Date.now(); state.daily = false;
  state.locked = false; state.selected = null; m3sel = [];
  stage.innerHTML = ""; binsEl.innerHTML = ""; hoverBin = null;
  pool.classList.remove("dragging"); resetZoom();
  binsEl.classList.toggle("grid-many", !!snap.gridMany);

  (snap.bins || []).forEach((b) => {
    const bin = document.createElement("div");
    bin.className = "bin";
    bin.dataset.cat = b.cat;
    bin.dataset.expected = b.exp || "0";
    bin.innerHTML =
      `<span class="bin-icon">${b.icon}</span>` +
      `<span class="bin-label">${b.label}</span>` +
      `<span class="bin-count" data-count="${b.count}">${b.count}</span>`;
    if (+b.exp) bin.style.setProperty("--fillp", Math.min(100, (+b.count / +b.exp) * 100) + "%");
    bin.addEventListener("click", () => { if (state.selected) attempt(state.selected, bin); });
    binsEl.appendChild(bin);
  });

  pool.classList.toggle("lite", state.total > 250);
  const frag = document.createDocumentFragment();
  (snap.tokens || []).forEach((t) => {
    const el = document.createElement("div");
    el.className = "token";
    el.dataset.cat = t.c;
    el.textContent = t.e;
    if (t.s) el.style.setProperty("--size", t.s);
    el.dataset.rot = t.r || "0";
    el.style.left = t.x + "px";
    el.style.top = t.y + "px";
    el.style.transform = `rotate(${t.r || 0}deg)`;
    if (t.a) { el.dataset.alt = t.a; el.classList.add("dual"); }
    if (t.g) { el.dataset.gold = "1"; el.classList.add("gold"); }
    if (t.f) { el.dataset.frozen = "1"; el.classList.add("frozen"); }
    frag.appendChild(el);
  });
  stage.appendChild(frag);

  $("levelName").textContent = snap.name || "";
  $("hint").textContent = snap.hint || "";
  updateHud();
  // Les positions sauvegardées datent d'un AUTRE viewport (rotation, barre du
  // navigateur, autre appareil) : sans recadrage, des emojis restaient hors
  // écran → niveau infinissable. On recadre après le layout.
  requestAnimationFrame(() => reflowTokens());
}

/* ---------- Sons (WebAudio, sans fichier) ---------- */
let audioCtx = null;
function beep(freq, dur, type = "sine", vol = 0.15) {
  if (!state.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();   // iOS/Safari démarre le contexte suspendu
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  } catch (e) { /* audio bloqué */ }
}
// steps = série en cours : la hauteur grimpe d'un demi-ton par bon coup (gamme
// montante très satisfaisante), plafonnée à l'octave.
const soundGood = (steps = 0) => {
  const m = Math.pow(2, Math.min(steps, 12) / 12);
  beep(660 * m, 0.12, "triangle");
  setTimeout(() => beep(880 * m, 0.14, "triangle"), 90);
};
const soundBad  = () => beep(160, 0.22, "sawtooth", 0.12);
const soundWin  = () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle"), i * 110)); };
// Les mini-jeux (arcade.js) consomment ces sons via window.* — un `const`
// top-level ne crée PAS de propriété window, on les expose explicitement
// (sans ça, les 14 mini-jeux étaient muets).
window.soundGood = soundGood;
window.soundBad = soundBad;
window.soundWin = soundWin;

/* ---------- Utilitaires ---------- */
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr, n) => shuffle([...arr]).slice(0, n);
// pioche n emojis ; autorise les répétitions quand n dépasse le stock (mode Extrême)
const pickRepeat = (arr, n) => Array.from({ length: n }, () => arr[Math.floor(Math.random() * arr.length)]);
const emojisFor = (arr, n) => (n <= arr.length ? pick(arr, n) : pickRepeat(arr, n));

/* ---------- Construction d'un niveau ---------- */
function buildLevel() {
  clearWinTimers();               // annule un éventuel overlay de victoire en attente
  state.locked = false;
  state.selected = null;
  state.mistakes = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.score = state.levelStartScore || 0;   // rejouer un niveau rend les points pris dedans
  state.t0 = Date.now();
  updateCombo();
  stage.innerHTML = "";
  binsEl.innerHTML = "";
  hoverBin = null;
  pool.classList.remove("dragging");
  resetZoom();                 // chaque niveau repart en vue normale
  binsEl.classList.toggle("grid-many", state.mode === "jumeaux");

  m3sel = [];
  const spec = state.daily ? genDaily()
    : state.mode === "jumeaux" ? genJumeaux()
    : state.mode === "match3" ? genMatch3()
    : state.mode === "couleurs" ? genCouleurs()
    : genFamilles();

  // Combien d'emojis attend chaque bac (pour le remplissage visuel)
  const counts = {};
  spec.tokens.forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; });

  // Cases cibles
  spec.bins.forEach((b) => {
    const bin = document.createElement("div");
    bin.className = "bin";
    bin.dataset.cat = b.cat;
    bin.dataset.expected = counts[b.cat] || 0;
    bin.innerHTML =
      `<span class="bin-icon">${b.icon}</span>` +
      `<span class="bin-label">${b.label}</span>` +
      `<span class="bin-count" data-count="0">0</span>`;
    bin.addEventListener("click", () => { if (state.selected) attempt(state.selected, bin); });
    binsEl.appendChild(bin);
  });

  // Jetons emojis
  const tokens = shuffle(spec.tokens.slice());
  state.total = tokens.length;
  state.remaining = tokens.length;

  // au-delà de ~250 emojis : ombre simplifiée pour ne pas faire ramer le rendu
  pool.classList.toggle("lite", state.total > 250);

  // tailles adaptées au nombre : plus il y en a, plus ils sont petits.
  // (en Extrême, scatter() recalcule la taille pour remplir toute la surface.)
  const huge = state.total > 70;
  const big = state.total > 26;
  const baseSize = huge ? 22 : big ? 30 : 40;
  const spanSize = huge ? 13 : big ? 18 : 24;

  // assemblage groupé (DocumentFragment) → un seul insert, bien plus rapide à 1000+
  const frag = document.createDocumentFragment();
  tokens.forEach((t) => {
    const el = document.createElement("div");
    el.className = "token";
    el.dataset.cat = t.cat;
    el.textContent = t.emoji;
    const size = baseSize + Math.floor(Math.random() * spanSize);
    el.style.setProperty("--size", size + "px");
    const rot = Math.floor(Math.random() * 46 - 23);
    el.dataset.rot = rot;
    el.style.transform = `rotate(${rot}deg)`;
    // Jetons spéciaux : ambigus (2 bacs valides), dorés (points ×2),
    // gelés (le bon geste brise d'abord la glace)
    if (t.alt) {
      el.dataset.alt = t.alt;
      el.classList.add("dual");
    } else if (state.mode !== "match3") {
      const r = Math.random();
      if (r < 0.025) { el.dataset.gold = "1"; el.classList.add("gold"); }
      else if (r < 0.055) { el.dataset.frozen = "1"; el.classList.add("frozen"); }
    }
    frag.appendChild(el);
  });
  stage.appendChild(frag);

  requestAnimationFrame(() => { scatter(); saveGame(); });

  $("levelName").textContent = spec.name;
  $("hint").textContent = spec.hint;
  updateHud();
}

/* ---------- Générateurs de niveaux ---------- */
/* Ajuste le nombre de bacs selon la difficulté : on part des cases du thème
   du niveau, puis on en ajoute (Difficile/Extrême) ou on en retire (Facile),
   dans la limite des catégories disponibles. Plus de bacs = plus dur. */
function scaleKeys(baseKeys, allKeys, binDelta) {
  const target = Math.min(allKeys.length, Math.max(2, baseKeys.length + binDelta));
  let keys = baseKeys.slice(0, target);
  if (keys.length < target) {
    const extra = shuffle(allKeys.filter((k) => !keys.includes(k)));
    keys = keys.concat(extra.slice(0, target - keys.length));
  }
  return keys;
}
function buildBinsTokens(source, keys, n) {
  const bins = keys.map((k) => ({ cat: k, icon: source[k].icon, label: source[k].label }));
  const tokens = [];
  keys.forEach((k) => { emojisFor(source[k].emojis, n).forEach((e) => tokens.push({ emoji: e, cat: k })); });
  return { bins, tokens };
}

/* ---------- Emojis ambigus : valides dans DEUX bacs (petite décision) ----------
   Quand les deux catégories d'un duo sont présentes dans le niveau, ~10 % des
   jetons deviennent « ambigus » (halo doré pointillé) : acceptés dans les deux
   bacs, et ils rapportent un peu plus (+15 de base au lieu de +10). */
const DUAL_EMOJIS = [
  { e: "🍅", cats: ["fruits", "nourriture"] },
  { e: "🥑", cats: ["fruits", "nourriture"] },
  { e: "🫒", cats: ["fruits", "nourriture"] },
  { e: "🐟", cats: ["animaux", "nourriture"] },
  { e: "🦀", cats: ["animaux", "nourriture"] },
  { e: "🛹", cats: ["sports", "vehicules"] },
  { e: "🛼", cats: ["sports", "vehicules"] },
  { e: "🛶", cats: ["sports", "vehicules"] },
];
function injectDuals(tokens, keys) {
  const options = DUAL_EMOJIS.filter((d) => keys.includes(d.cats[0]) && keys.includes(d.cats[1]));
  if (!options.length || tokens.length < 8) return;
  const n = Math.min(6, Math.max(1, Math.round(tokens.length * 0.1)));
  const idxs = shuffle(tokens.map((_, i) => i)).slice(0, n);
  idxs.forEach((i) => {
    const d = options[Math.floor(Math.random() * options.length)];
    const flip = Math.random() < 0.5;
    tokens[i] = { emoji: d.e, cat: d.cats[flip ? 0 : 1], alt: d.cats[flip ? 1 : 0] };
  });
}

function genFamilles() {
  const cfg = LEVELS[state.level];
  const d = DIFFICULTY[state.difficulty];
  const source = cfg.color ? COLORS : CATEGORIES;
  const allKeys = Object.keys(source);
  // thème de base du niveau ; pour le niveau "couleurs" on part de 4 teintes
  const baseKeys = cfg.color ? allKeys.slice(0, 4) : cfg.cats;
  const keys = scaleKeys(baseKeys, allKeys, d.binDelta);
  const n = Math.max(2, d.target ? Math.ceil(d.target / keys.length) : d.perCat(cfg.perCat));
  const { bins, tokens } = buildBinsTokens(source, keys, n);
  if (!cfg.color) injectDuals(tokens, keys);
  return {
    bins, tokens, name: `${cfg.name} · ${d.label}`,
    hint: cfg.color ? "Trie chaque emoji par sa couleur" : "Range chaque emoji dans sa case",
  };
}

function genCouleurs() {
  const cfg = COULEURS_LEVELS[state.clevel];
  const d = DIFFICULTY[state.difficulty];
  const allKeys = Object.keys(COLORS);
  // le niveau donne une base de teintes (3, 4, 5…) ; la difficulté ajuste
  const baseKeys = shuffle(allKeys.slice()).slice(0, Math.min(allKeys.length, 3 + state.clevel));
  const keys = scaleKeys(baseKeys, allKeys, d.binDelta);
  const n = Math.max(2, d.target ? Math.ceil(d.target / keys.length) : d.perCat(cfg.perCat));
  const { bins, tokens } = buildBinsTokens(COLORS, keys, n);
  return { bins, tokens, name: `${cfg.name} · ${d.label}`, hint: "Trie chaque emoji par sa couleur" };
}

function genJumeaux() {
  const cfg = JUMEAUX[state.jlevel];
  const d = DIFFICULTY[state.difficulty];
  const types = Math.min(d.jTypes, ALL_EMOJIS.length);
  const copies = Math.max(2, d.target ? Math.ceil(d.target / types) : d.jCopies(cfg.copies));
  const distinct = pick(ALL_EMOJIS, types);
  const bins = distinct.map((e) => ({ cat: e, icon: e, label: "" }));
  const tokens = [];
  distinct.forEach((e) => { for (let i = 0; i < copies; i++) tokens.push({ emoji: e, cat: e }); });
  return { bins, tokens, name: `${cfg.name} · ${d.label}`, hint: "Regroupe les emojis identiques (les jumeaux ensemble)" };
}

function genMatch3() {
  const cfg = MATCH3[state.m3level];
  const d = DIFFICULTY[state.difficulty];
  // plus de sortes différentes = trios plus durs à repérer dans le tas
  const types = Math.min(d.m3Types, ALL_EMOJIS.length);
  // nb d'exemplaires par sorte, forcé en multiple de 3 (sinon on ne peut pas tout vider)
  let per = d.target ? Math.round((d.target / types) / 3) * 3 : cfg.copies;
  per = Math.max(3, per);
  const distinct = pick(ALL_EMOJIS, types);
  const tokens = [];
  distinct.forEach((e) => { for (let i = 0; i < per; i++) tokens.push({ emoji: e, cat: e }); });
  // pas de cases dans ce mode
  return { bins: [], tokens, name: `${cfg.name} · ${d.label}`, hint: "Tape 3 emojis identiques pour les faire exploser" };
}

/* ---------- Défi du jour : niveau seedé par la date (le même pour tous) ---------- */
function genDaily() {
  const seed = +dayStr().replace(/-/g, "");
  const rng = mulberry32(seed);
  const srng = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const keys = srng([...Object.keys(CATEGORIES)]).slice(0, 4);
  const bins = keys.map((k) => ({ cat: k, icon: CATEGORIES[k].icon, label: CATEGORIES[k].label }));
  const tokens = [];
  keys.forEach((k) => { srng([...CATEGORIES[k].emojis]).slice(0, 8).forEach((e) => tokens.push({ emoji: e, cat: k })); });
  injectDuals(tokens, keys);
  return { bins, tokens, name: "🎯 Défi du jour", hint: "Le même défi pour tous · réussis-le pour garder ta série 🔥" };
}

/* ---------- Dispersion en vrac ---------- */
function scatter() {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const toks = [...stage.querySelectorAll(".token")].filter((t) => !t.dataset.placed);
  if (!toks.length) return;

  // En Extrême : GRILLE PERTURBÉE (jittered grid) → couvre TOUTE la surface,
  // une cellule par emoji + décalage aléatoire, emojis assez gros pour se chevaucher.
  if (state.difficulty === "extreme") {
    const N = toks.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt((N * W) / H) * 1.05));
    const rows = Math.ceil(N / cols);
    const cellW = W / cols, cellH = H / rows;
    // chaque emoji COUVRE sa cellule (et déborde un peu) → toute la surface est
    // remplie, quel que soit le nombre. Taille calculée, SANS lire le layout
    // (pas de offsetWidth par élément → reste rapide même à 1000+).
    const fill = Math.max(12, Math.min(58, Math.ceil(Math.max(cellW, cellH))));
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
    shuffle(cells); // évite d'aligner les types
    toks.forEach((el, i) => {
      const sizeVal = fill + Math.floor(Math.random() * 5);
      el.style.setProperty("--size", sizeVal + "px");
      const s = sizeVal * 1.12; // largeur réelle = --size * 1.12 (voir .token en CSS)
      const [c, r] = cells[i];
      const cx = (c + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.5;
      const cy = (r + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.5;
      const x = Math.min(Math.max(cx - s / 2, 0), Math.max(0, W - s));
      const y = Math.min(Math.max(cy - s / 2, 0), Math.max(0, H - s));
      el.style.left = x + "px";
      el.style.top = y + "px";
    });
    return;
  }

  // Autres difficultés : placement aéré (on garde la position la plus dégagée)
  const placed = [];
  toks.forEach((el) => {
    const s = el.offsetWidth || 52;
    const maxX = Math.max(1, W - s), maxY = Math.max(1, H - s);
    let best = { x: Math.random() * maxX, y: Math.random() * maxY };
    let bestMin = -1;
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * maxX;
      const y = Math.random() * maxY;
      let md = Infinity;
      for (const p of placed) { const d = Math.hypot(x - p.x, y - p.y); if (d < md) md = d; }
      if (md > bestMin) { bestMin = md; best = { x, y }; }
      if (md > s * 0.7) break;
    }
    el.style.left = best.x + "px";
    el.style.top = best.y + "px";
    placed.push({ x: best.x, y: best.y });
  });
}

/* Recadrage NON destructif : ramène chaque emoji restant dans les limites du
   plateau après un changement de taille d'écran (barre du navigateur qui
   apparaît/disparaît, rotation, redimensionnement). Sans ça, un emoji poussé
   sous le bord bas était rogné par overflow:hidden → injouable, niveau bloqué. */
function reflowTokens() {
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return;
  stage.querySelectorAll(".token").forEach((el) => {
    if (el.dataset.placed) return;
    const s = (parseFloat(el.style.getPropertyValue("--size")) || 44) * 1.12;
    const maxX = Math.max(0, W - s), maxY = Math.max(0, H - s);
    const x = Math.min(Math.max(parseFloat(el.style.left) || 0, 0), maxX);
    const y = Math.min(Math.max(parseFloat(el.style.top) || 0, 0), maxY);
    el.style.left = x + "px";
    el.style.top = y + "px";
  });
  clampPan(); applyZoom();
}
let reflowTimer = 0;

/* ---------- HUD ---------- */
function updateHud() {
  $("score").textContent = state.score;
  const done = state.total - state.remaining;
  $("progressBar").style.width = (state.total ? (done / state.total) * 100 : 0) + "%";
}

/* ---------- Combos : récompense les séries sans faute ---------- */
// Multiplicateur qui grimpe avec la série ; une erreur remet le combo à zéro.
function comboMult() {
  const c = state.combo;
  return c >= 12 ? 5 : c >= 8 ? 4 : c >= 5 ? 3 : c >= 3 ? 2 : 1;
}
function updateCombo() {
  const el = $("combo");
  if (!el) return;
  const m = comboMult();
  if (state.combo >= 3 && m > 1) {
    el.textContent = "🔥 x" + m + " · " + state.combo;
    el.hidden = false;
    el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
  } else {
    el.hidden = true;
    el.classList.remove("pulse");
  }
}
// Enregistre un bon coup : incrémente le combo, ajoute score*multiplicateur,
// renvoie le gain (pour l'afficher). base = points de base du coup.
function scoreHit(base) {
  state.combo++;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  const gain = base * comboMult();
  state.score += gain;
  meta.wallet += gain;      // alimente le trésor ⭐ (monnaie des fonds d'écran)
  updateCombo();
  return gain;
}
function breakCombo() { state.combo = 0; updateCombo(); }
// Petit "+N" flottant à l'endroit du rangement (jus visuel)
function floatScore(x, y, txt) {
  const f = document.createElement("div");
  f.className = "score-float";
  f.textContent = txt;
  f.style.left = x + "px";
  f.style.top = y + "px";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 800);
}

/* ---------- Contrôles : drag & drop + tap (batché en rAF pour la fluidité) ---------- */
let hoverBin = null;
function setHover(bin) {
  if (hoverBin === bin) return;
  if (hoverBin) hoverBin.classList.remove("hover");
  hoverBin = bin;
  if (hoverBin) hoverBin.classList.add("hover");
}

/* Détection de la case sous le doigt PAR GÉOMÉTRIE.
   On ne touche jamais à pointer-events → la capture du pointeur n'est
   jamais relâchée en cours de glissement, donc l'emoji suit le doigt
   de façon parfaitement continue (correctif du "bug" au drop). */
function binAtPoint(x, y) {
  const bins = binsEl.querySelectorAll(".bin");
  for (const b of bins) {
    const r = b.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b;
  }
  return null;
}

/* ================= ZOOM & DÉPLACEMENT ================= */
const zoom = { scale: 1, panX: 0, panY: 0 };
const ZOOM_MIN = 1, ZOOM_MAX = 4;
let pinching = false;          // deux doigts en cours → pincement
let activeDrag = null;         // annulation du glissement d'emoji en cours (si pincement)
const pointers = new Map();    // pointeurs actifs sur le plateau
let pinchStart = null;
let panStart = null;

function clampPan() {
  const W = stage.clientWidth, H = stage.clientHeight;
  zoom.panX = Math.min(0, Math.max(W - W * zoom.scale, zoom.panX));
  zoom.panY = Math.min(0, Math.max(H - H * zoom.scale, zoom.panY));
}
function applyZoom() {
  clampPan();
  const neutral = zoom.scale === 1 && zoom.panX === 0 && zoom.panY === 0;
  // .zoomed → pendant un drag zoomé on garde overflow:hidden (sinon la couche
  // agrandie déborde sur toute l'UI et l'emoji dragué passe sous les bacs)
  pool.classList.toggle("zoomed", !neutral);
  if (neutral) {
    stage.style.transform = "";   // vue normale : aucun contexte d'empilement
  } else {
    stage.style.transform = `translate(${zoom.panX}px, ${zoom.panY}px) scale(${zoom.scale})`;
  }
}
function resetZoom() {
  zoom.scale = 1; zoom.panX = 0; zoom.panY = 0;
  pinching = false; pointers.clear(); pinchStart = null; panStart = null;
  applyZoom();
}
function onPoolPointerDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    if (activeDrag) { activeDrag(); activeDrag = null; }   // stoppe le glissement d'emoji
    pinching = true;
    panStart = null;
    const p = [...pointers.values()];
    const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
    const r = stage.getBoundingClientRect();
    pinchStart = {
      dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
      scale0: zoom.scale,
      ox: r.left - zoom.panX, oy: r.top - zoom.panY,
      lx: (cx - r.left) / zoom.scale, ly: (cy - r.top) / zoom.scale,
    };
  } else if (pointers.size === 1 && zoom.scale > 1 && (e.target === stage || e.target === pool)) {
    panStart = { x: e.clientX, y: e.clientY, panX: zoom.panX, panY: zoom.panY };
  }
}
function onPoolPointerMove(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinching && pointers.size >= 2 && pinchStart) {
    const p = [...pointers.values()];
    const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
    const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
    zoom.scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStart.scale0 * dist / pinchStart.dist));
    zoom.panX = cx - pinchStart.ox - pinchStart.lx * zoom.scale;
    zoom.panY = cy - pinchStart.oy - pinchStart.ly * zoom.scale;
    applyZoom();
    e.preventDefault();
  } else if (panStart) {
    zoom.panX = panStart.panX + (e.clientX - panStart.x);
    zoom.panY = panStart.panY + (e.clientY - panStart.y);
    applyZoom();
    e.preventDefault();
  }
}
function onPoolPointerUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) { pinching = false; pinchStart = null; }
  if (pointers.size === 0) panStart = null;
}

function bindZoom() {
  // Zoom au pincement (2 doigts) + déplacement (1 doigt sur le fond quand zoomé)
  pool.addEventListener("pointerdown", onPoolPointerDown);
  pool.addEventListener("pointermove", onPoolPointerMove);
  pool.addEventListener("pointerup", onPoolPointerUp);
  pool.addEventListener("pointercancel", onPoolPointerUp);
}

/* Choisit l'emoji visé PAR PROXIMITÉ DE CENTRE (et non la boîte la plus au-dessus).
   Corrige l'imprécision : parmi les emojis présents sous le doigt, on prend celui
   dont le centre est le plus proche du point touché — celui qu'on visait vraiment. */
function tokenAtPoint(x, y) {
  const els = document.elementsFromPoint(x, y)
    .filter((e) => e.classList && e.classList.contains("token") && !e.dataset.placed);
  if (!els.length) return null;
  let best = els[0], bestD = Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d < bestD) { bestD = d; best = el; }
  }
  return best;
}

/* ---- Contrôleur de glissement/tap DÉLÉGUÉ (un seul jeu d'écouteurs sur #stage) ---- */
let drag = null;               // { el, x, y, moved, raf, pointerId }
let dragLastX = 0, dragLastY = 0;

function dragFrame() {
  if (!drag) return;
  drag.raf = 0;
  const s = zoom.scale || 1;
  const el = drag.el;
  const dx = (dragLastX - drag.x) / s, dy = (dragLastY - drag.y) / s;
  el.style.transform =
    `translate3d(${dx}px, ${dy}px, 0) rotate(${el.dataset.rot || 0}deg) scale(1.12)`;
  setHover(binAtPoint(dragLastX, dragLastY));
}

function cancelDrag() {
  if (!drag) return;
  if (drag.raf) cancelAnimationFrame(drag.raf);
  drag.el.classList.remove("grabbing");
  resetTokenStyle(drag.el);
  pool.classList.remove("dragging");
  setHover(null);
  drag = null;
  activeDrag = null;
}

function stageDown(e) {
  // `drag` déjà actif : un 2e doigt ne doit pas écraser le glissement en cours
  // (sinon l'emoji du 1er doigt restait figé en l'air, position fausse)
  if (state.locked || pinching || drag) return;
  const el = tokenAtPoint(e.clientX, e.clientY);
  if (!el) return;                     // touche le fond → laisser le déplacement (pan) agir
  e.preventDefault();
  drag = { el, x: e.clientX, y: e.clientY, moved: false, raf: 0, pointerId: e.pointerId };
  dragLastX = e.clientX; dragLastY = e.clientY;
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  el.classList.add("grabbing");
  activeDrag = cancelDrag;
}

function stageMove(e) {
  if (!drag || pinching || e.pointerId !== drag.pointerId) return;
  dragLastX = e.clientX; dragLastY = e.clientY;
  if (state.mode === "match3") return;              // match3 : tout est tap
  if (!drag.moved) {
    if (Math.hypot(dragLastX - drag.x, dragLastY - drag.y) <= 7) return;
    drag.moved = true;
    drag.el.style.zIndex = "1000";
    pool.classList.add("dragging");
  }
  if (!drag.raf) drag.raf = requestAnimationFrame(dragFrame);
}

function stageUp(e, cancelled) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  if (drag.raf) { cancelAnimationFrame(drag.raf); drag.raf = 0; }
  try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
  const el = drag.el;
  const moved = drag.moved;
  el.classList.remove("grabbing");
  pool.classList.remove("dragging");
  drag = null;
  activeDrag = null;
  setHover(null);
  if (cancelled || pinching) { resetTokenStyle(el); return; }
  if (moved) {
    const bin = binAtPoint(dragLastX, dragLastY);
    resetTokenStyle(el);
    if (bin) attempt(el, bin);
  } else if (state.mode === "match3") {
    match3Tap(el);
  } else {
    toggleSelect(el);
  }
}

function bindStage() {
  stage.addEventListener("pointerdown", stageDown);
  stage.addEventListener("pointermove", stageMove);
  stage.addEventListener("pointerup", (e) => stageUp(e, false));
  stage.addEventListener("pointercancel", (e) => stageUp(e, true));
}

function resetTokenStyle(el) {
  el.style.zIndex = "";
  el.style.transform = `rotate(${el.dataset.rot || 0}deg)`;
}

function clearSelection() {
  if (!state.selected) return;
  const el = state.selected;
  el.classList.remove("selected");
  el.style.transform = `rotate(${el.dataset.rot || 0}deg)`;
  state.selected = null;
}

function toggleSelect(el) {
  if (state.selected === el) { clearSelection(); return; }
  clearSelection();
  state.selected = el;
  el.classList.add("selected");
  el.style.transform = `rotate(${el.dataset.rot || 0}deg) scale(1.2)`;
  beep(520, 0.05, "sine", 0.08);
}

/* ---------- Mode match3 : sélection de 3 emojis identiques ---------- */
let m3sel = [];
function m3Deselect(el) {
  el.classList.remove("selected");
  el.style.transform = `rotate(${el.dataset.rot || 0}deg)`;
  delete el.dataset.sel;
}
function m3Reset() {
  m3sel.forEach(m3Deselect);
  m3sel = [];
}
function match3Tap(el) {
  if (state.locked || el.dataset.placed) return;

  // re-tap d'un emoji déjà sélectionné → on le retire
  if (el.dataset.sel) {
    m3Deselect(el);
    m3sel = m3sel.filter((t) => t !== el);
    return;
  }
  // sorte différente de la sélection en cours → on repart de zéro
  if (m3sel.length && m3sel[0].dataset.cat !== el.dataset.cat) m3Reset();

  el.dataset.sel = "1";
  el.classList.add("selected");
  el.style.transform = `rotate(${el.dataset.rot || 0}deg) scale(1.2)`;
  m3sel.push(el);
  beep(520 + m3sel.length * 90, 0.05, "sine", 0.09);

  if (m3sel.length === 3) {
    const trio = m3sel;
    m3sel = [];
    trio.forEach((t) => {
      t.dataset.placed = "1";
      t.classList.remove("selected");
      t.classList.add("pop");
    });
    soundGood(state.combo);
    vibrate(15);
    const gain = scoreHit(15);
    const r = trio[0].getBoundingClientRect();
    floatScore(r.left + r.width / 2, r.top + r.height / 2, "+" + gain);
    state.remaining -= 3;
    updateHud();
    setTimeout(() => {
      trio.forEach((t) => t.remove());
      if (state.remaining <= 0) winLevel(); else saveGame();
    }, 360);
  }
}

/* ---------- Tentative de rangement ---------- */
function attempt(el, bin) {
  if (state.locked || el.dataset.placed) return;
  // les emojis ambigus (dual) sont valides dans leurs DEUX bacs
  const ok = el.dataset.cat === bin.dataset.cat ||
             (el.dataset.alt && el.dataset.alt === bin.dataset.cat);

  clearSelection();

  // Jeton gelé : le premier bon geste brise la glace (aucune pénalité)
  if (ok && el.dataset.frozen) {
    delete el.dataset.frozen;
    el.classList.remove("frozen");
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    beep(1040, 0.09, "triangle", 0.12);
    vibrate(10);
    saveGame();
    return;
  }

  if (ok) {
    el.dataset.placed = "1";
    bin.classList.remove("correct"); void bin.offsetWidth; bin.classList.add("correct");
    const counter = bin.querySelector(".bin-count");
    counter.dataset.count = (+counter.dataset.count + 1);
    counter.textContent = counter.dataset.count;
    // remplissage visuel du bac
    const exp = +bin.dataset.expected || 0;
    if (exp) bin.style.setProperty("--fillp", Math.min(100, (+counter.dataset.count / exp) * 100) + "%");

    el.classList.add("pop");
    soundGood(state.combo);
    vibrate(12);
    let base = el.dataset.alt ? 15 : 10;
    if (el.dataset.gold) base *= 2;
    const gain = scoreHit(base);
    const r = el.getBoundingClientRect();
    floatScore(r.left + r.width / 2, r.top + r.height / 2,
      "+" + gain + (el.dataset.gold ? " 🌟" : el.dataset.alt ? " ✨" : ""));
    state.remaining--;
    updateHud();

    setTimeout(() => { el.remove(); if (state.remaining === 0) winLevel(); else saveGame(); }, 360);
  } else {
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    bin.classList.remove("wrong"); void bin.offsetWidth; bin.classList.add("wrong");
    soundBad();
    vibrate([25, 40, 25]);
    state.mistakes++;
    breakCombo();                        // l'enjeu : une faute casse ta série
    state.score = Math.max(0, state.score - 2);
    updateHud();
  }
}

/* ---------- Fin de niveau ---------- */
// Timers de l'écran de victoire (affichage différé + étoiles une à une) —
// tous annulables si le joueur relance/quitte entre-temps.
let winTimers = [];
function clearWinTimers() {
  winTimers.forEach(clearTimeout);
  winTimers = [];
  const ov = $("overlay"); if (ov) ov.hidden = true;
}

function winLevel() {
  if (state.locked) return;   // évite le double déclenchement (2 derniers coups < 360 ms)
  state.locked = true;
  clearGame();          // niveau terminé → plus de partie à reprendre
  soundWin();
  vibrate([10, 30, 10, 30, 25]);
  launchConfetti();

  // plus de bacs en Difficile/Extrême → on tolère quelques fautes de plus pour 3⭐
  const tol3 = { facile: 0, moyen: 0, difficile: 2, extreme: 4 }[state.difficulty] || 0;
  const stars = state.mistakes <= tol3 ? 3 : state.mistakes <= tol3 + 4 ? 2 : 1;

  // Objectifs secondaires (bonus ⭐ dans le trésor)
  const fast = state.t0 ? (Date.now() - state.t0) <= state.total * 3000 : false;
  const objs = [
    ["🎯 Sans faute", state.mistakes === 0],
    ["🔥 Combo ×8", state.maxCombo >= 8],
    ["⚡ Rapide", fast],
  ];
  const objDone = objs.filter((o) => o[1]).length;
  if (objDone) meta.wallet += objDone * 15;
  const objsEl = $("objs");
  if (objsEl) {
    objsEl.hidden = false;
    objsEl.innerHTML = objs.map(([t, ok]) =>
      `<span style="opacity:${ok ? 1 : 0.45}">${ok ? "✅" : "⬜"} ${t}</span>`).join("");
  }

  const idx = modeIdx();
  const last = idx >= modeList().length - 1;

  if (state.daily) {
    // Défi du jour : vraie série (streak), +50 ⭐ la première réussite du jour
    const today = dayStr();
    if (meta.daily.doneDay !== today) {
      const yest = dayStr(new Date(Date.now() - 864e5));
      meta.daily.streak = meta.daily.last === yest ? meta.daily.streak + 1 : 1;
      meta.daily.last = today;
      meta.daily.doneDay = today;
      meta.wallet += 50;
    }
    $("overlayTitle").textContent = "Défi réussi !";
    $("overlaySub").textContent = `Série : 🔥 ${meta.daily.streak} jour${meta.daily.streak > 1 ? "s" : ""} · +50 ⭐`;
    $("nextBtn").textContent = "Retour à l'accueil";
  } else {
    setStars(idx, stars);                                        // étoiles persistées (carte des niveaux)
    bumpReached(state.mode, Math.min(idx + 1, modeList().length - 1));
    $("overlayTitle").textContent = last ? "Terminé !" : "Bravo !";
    const comboLine = state.maxCombo >= 3 ? ` · meilleur combo ×${state.maxCombo}` : "";
    $("overlaySub").textContent = last
      ? `Tu as fini tous les niveaux · ${state.score} pts`
      : (state.mistakes === 0 ? `Sans faute, parfait !${comboLine}` : `Niveau réussi${comboLine}`);
    $("nextBtn").textContent = last ? "Recommencer ↺" : "Niveau suivant →";
  }

  saveMeta();
  save();

  // Étoiles révélées une à une (petit moment de suspense)
  const starsEl = $("stars");
  starsEl.textContent = "";
  winTimers.push(setTimeout(() => {
    $("overlay").hidden = false;
    for (let i = 1; i <= 3; i++) {
      winTimers.push(setTimeout(() => {
        starsEl.textContent = "⭐".repeat(Math.min(i, stars)) + "☆".repeat(Math.max(0, i - stars));
        if (i <= stars) beep(520 + i * 150, 0.12, "triangle", 0.12);
      }, 260 * i));
    }
  }, 500));
}

/* ---------- Confettis ---------- */
function launchConfetti() {
  const box = $("confetti");
  const colors = ["#ffd166", "#ff6ba6", "#5b6cff", "#35c98a", "#ff5b6e", "#8be9fd"];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement("i");
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    c.style.animationDelay = Math.random() * 0.4 + "s";
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(c);
    setTimeout(() => c.remove(), 3200);
  }
}

/* ---------- Fonds ---------- */
function applyBackground(i) {
  state.bgIndex = ((i % BACKGROUNDS.length) + BACKGROUNDS.length) % BACKGROUNDS.length;
  $("bgLayer").style.background = BACKGROUNDS[state.bgIndex];
  document.querySelectorAll(".swatch").forEach((s, idx) =>
    s.classList.toggle("active", idx === state.bgIndex));
  save();
}
/* Les 3 premiers fonds sont offerts ; les autres se débloquent avec le trésor ⭐
   (le score sert enfin à quelque chose). */
const BG_COST = [0, 0, 0, 200, 300, 400, 500, 650, 800];
function buildSwatches() {
  const wrap = $("swatches");
  wrap.innerHTML = "";
  BACKGROUNDS.forEach((bg, i) => {
    const s = document.createElement("div");
    s.className = "swatch";
    s.style.background = bg;
    if (!meta.bgUnlocked.includes(i)) {
      s.classList.add("locked");
      s.innerHTML = `<b class="price">🔒 ${BG_COST[i] || 0}</b>`;
    }
    s.addEventListener("click", () => {
      if (meta.bgUnlocked.includes(i)) { applyBackground(i); return; }
      const cost = BG_COST[i] || 0;
      if (meta.wallet >= cost) {
        meta.wallet -= cost;
        meta.bgUnlocked.push(i);
        saveMeta();
        soundGood();
        showToast("Fond débloqué ! 🎨");
        buildSwatches();
        applyBackground(i);
        updateHubMeta();
      } else {
        beep(180, 0.14, "sawtooth", 0.08);
        showToast(`Encore ${fmtShort(cost - meta.wallet)} ⭐ pour ce fond`);
      }
    });
    wrap.appendChild(s);
  });
  updateWalletLine();
}
function updateWalletLine() {
  const w = $("walletLine");
  if (w) w.textContent = `Ton trésor : ⭐ ${fmtShort(meta.wallet)} — trie pour débloquer les fonds verrouillés`;
}

/* ---------- Boutons ---------- */
function bindUI() {
  $("restartBtn").addEventListener("click", buildLevel);

  $("bgBtn").addEventListener("click", () => $("bgSheet").hidden = false);
  $("bgClose").addEventListener("click", () => $("bgSheet").hidden = true);
  $("bgSheet").addEventListener("click", (e) => { if (e.target.id === "bgSheet") $("bgSheet").hidden = true; });

  $("soundBtn").addEventListener("click", () => {
    state.sound = !state.sound;
    $("soundBtn").textContent = state.sound ? "🔊" : "🔇";
    if (state.sound) beep(660, 0.1, "triangle");
    save();
  });

  $("replayBtn").addEventListener("click", () => {
    buildLevel();          // clearWinTimers y masque l'overlay
  });

  $("nextBtn").addEventListener("click", () => {
    clearWinTimers();
    if (state.daily) {     // fin du défi du jour → retour à l'accueil
      state.daily = false;
      updateHubMeta();
      $("homeClose").hidden = true;
      $("home").hidden = false;
      return;
    }
    if (modeIdx() >= modeList().length - 1) { setModeIdx(0); state.score = 0; }
    else setModeIdx(modeIdx() + 1);
    state.levelStartScore = state.score;
    save();
    buildLevel();
  });

  // Bouton 🏠 en jeu → revient au hub
  $("homeBtn").addEventListener("click", () => {
    clearWinTimers();      // annule aussi un overlay de victoire en attente
    updateHubMeta();
    // bouton "reprendre" visible seulement s'il reste des emojis à jouer
    $("homeClose").hidden = !stage.querySelector(".token:not([data-placed])");
    $("home").hidden = false;
  });

  // Tuile 🎯 Défi du jour
  if ($("dailyTile")) $("dailyTile").addEventListener("click", startDaily);
  $("homeClose").addEventListener("click", () => { $("home").hidden = true; });

  // Tuiles de TRI (data-mode) → on demande la difficulté APRÈS le choix du jeu
  document.querySelectorAll(".tile[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => chooseDifficulty(btn.dataset.mode));
  });

  // Barre du bas (dock)
  if ($("dockHome")) $("dockHome").addEventListener("click", () => { try { $("home").scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { $("home").scrollTop = 0; } });
  if ($("dockBg")) $("dockBg").addEventListener("click", () => $("bgSheet").hidden = false);
  if ($("dockTrophies")) $("dockTrophies").addEventListener("click", openTrophies);
  if ($("dockSettings")) $("dockSettings").addEventListener("click", openSettings);

  // repositionne les emojis restants si l'écran change d'orientation
  // (et remet le zoom/pan en cohérence avec la nouvelle taille)
  window.addEventListener("orientationchange", () => {
    setTimeout(() => requestAnimationFrame(() => { scatter(); clampPan(); applyZoom(); }), 300);
  });
  // redimensionnement (barre du navigateur, fenêtre) : on recadre les emojis
  // dans les limites, sans tout re-disperser. Débattu pour ne pas surcharger.
  window.addEventListener("resize", () => {
    clearTimeout(reflowTimer);
    reflowTimer = setTimeout(() => requestAnimationFrame(reflowTokens), 150);
  });
}

function refreshDiff() {
  document.querySelectorAll(".diff-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.diff === state.difficulty));
}

/* Met à jour le bandeau du hub : vraie série du défi du jour + trésor cumulé */
function updateHubMeta() {
  const today = dayStr(), yest = dayStr(new Date(Date.now() - 864e5));
  const alive = meta.daily.last === today || meta.daily.last === yest;
  const sd = $("streakDays"); if (sd) sd.textContent = alive ? meta.daily.streak : 0;
  const s = $("streakScore"); if (s) s.textContent = fmtShort(meta.wallet);
  const badge = $("dailyBadge");
  if (badge) badge.textContent = meta.daily.doneDay === today ? "fait ✓" : "à toi !";
}

/* Lance le défi du jour (niveau seedé par la date, série 🔥) */
function startDaily() {
  state.daily = true;
  state.mode = "familles";       // le défi utilise la mécanique familles
  state.difficulty = "moyen";
  state.levelStartScore = state.score;
  $("home").hidden = true;
  beep(560, 0.06, "sine", 0.08);
  buildLevel();
}

/* Message éphémère (toast) — non bloquant, pour les jeux « bientôt » */
let toastTimer = 0;
function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
}

/* ---------- Choix de la difficulté (après avoir choisi un jeu de TRI) ---------- */
function closeModal(ov) { if (ov && ov.parentNode) ov.remove(); }
function chooseDifficulty(mode) {
  const names = { familles: "🧺 Par familles", couleurs: "🌈 Couleurs", jumeaux: "👯 Jumeaux", match3: "💥 Match 3" };
  const diffs = [["facile", "Facile"], ["moyen", "Moyen"], ["difficile", "Difficile"], ["extreme", "🔥 Extrême"]];
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML =
    `<div class="overlay-card"><div class="stars">🎚️</div><h1>Difficulté</h1>` +
    `<p>${names[mode] || "Jeu"} — choisis ton niveau</p>` +
    `<div class="diff-row">` +
    diffs.map(([d, l]) => `<button class="diff-btn${d === "extreme" ? " xtreme" : ""}${d === state.difficulty ? " active" : ""}" data-diff="${d}">${l}</button>`).join("") +
    `</div><button class="btn ghost" data-cancel style="margin-top:12px;">Annuler</button></div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll(".diff-btn").forEach((b) => b.addEventListener("click", () => {
    state.difficulty = b.dataset.diff;
    if (mode !== state.mode) state.score = 0;
    state.mode = mode;
    closeModal(ov);
    beep(560, 0.06, "sine", 0.08);
    save();
    chooseLevel();                 // puis la carte des niveaux (étoiles ⭐)
  }));
  ov.querySelector("[data-cancel]").addEventListener("click", () => closeModal(ov));
  ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(ov); });
}

/* ---------- Carte des niveaux : étoiles gagnées + déblocage progressif ---------- */
function chooseLevel() {
  const list = modeList();
  const reached = getReached(state.mode);
  const cur = modeIdx();
  const btns = list.map((lv, i) => {
    const locked = i > reached;
    const s = getStars(state.mode, state.difficulty, i);
    const starsTxt = locked ? "🔒" : (s ? "⭐".repeat(s) + "☆".repeat(3 - s) : "☆☆☆");
    return `<button class="lvl-btn${locked ? " locked" : ""}${i === cur ? " current" : ""}" data-i="${i}" ${locked ? "disabled" : ""}>` +
      `<b>${i + 1}</b><span>${starsTxt}</span></button>`;
  }).join("");
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML =
    `<div class="overlay-card"><div class="stars">🗺️</div><h1>Niveaux</h1>` +
    `<p>${DIFFICULTY[state.difficulty].label} — vise les 3 étoiles partout !</p>` +
    `<div class="lvl-grid">${btns}</div>` +
    `<button class="btn ghost" data-cancel style="margin-top:12px;">Annuler</button></div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll(".lvl-btn:not(.locked)").forEach((b) => b.addEventListener("click", () => {
    setModeIdx(+b.dataset.i);
    closeModal(ov);
    $("home").hidden = true;
    state.daily = false;
    state.levelStartScore = state.score;
    beep(560, 0.06, "sine", 0.08);
    save();
    buildLevel();
  }));
  ov.querySelector("[data-cancel]").addEventListener("click", () => closeModal(ov));
  ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(ov); });
}

/* ---------- Trophées : meilleurs scores par jeu ---------- */
function openTrophies() {
  const best = (id) => { try { return +localStorage.getItem("arc_best_" + id) || 0; } catch (e) { return 0; } };
  const GAMES = [
    ["hole", "🕳️ Emoji Hole", "pts"], ["g2048", "🔢 2048", "pts"],
    ["snake", "🐍 Serpent", "pts"], ["breakout", "🧱 Casse-briques", "pts"],
    ["whack", "🔨 Taupes", "pts"], ["simon", "🎵 Séquence", "niv"],
    ["pairs", "🃏 Paires", "coups"], ["slide", "🖼️ Taquin", "coups"],
  ];
  let rows = GAMES.map(([id, label, unit]) => {
    const v = best(id);
    const val = v ? (v + (unit === "pts" ? "" : unit === "niv" ? "" : " coups")) : "—";
    return `<div class="tro-row"><span>${label}</span><b>${val}</b></div>`;
  }).join("");
  // Tycoon
  let ty = 0, tyv = 0; try { const s = JSON.parse(localStorage.getItem("arc_tycoon_v2") || "null"); if (s) { ty = s.lifetime || 0; tyv = s.vip || 0; } } catch (e) {}
  rows += `<div class="tro-row"><span>🎡 Arcade Tycoon</span><b>${ty ? fmtShort(ty) + " 🎟️" : "—"}</b></div>`;
  // Tri : total d'étoiles gagnées + série du défi du jour
  let starTotal = 0;
  try { Object.values(meta.stars).forEach((a) => (a || []).forEach((v) => { starTotal += v || 0; })); } catch (e) {}
  rows += `<div class="tro-row"><span>🧺 Étoiles de tri</span><b>${starTotal ? starTotal + " ⭐" : "—"}</b></div>`;
  rows += `<div class="tro-row"><span>🎯 Défi du jour</span><b>${meta.daily.streak ? "🔥 " + meta.daily.streak + " j" : "—"}</b></div>`;

  const ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML = `<div class="overlay-card"><div class="stars">🏆</div><h1>Trophées</h1><p>Tes meilleurs scores</p><div class="tro-list">${rows}</div><button class="btn ghost" data-cancel style="margin-top:14px;">Fermer</button></div>`;
  document.body.appendChild(ov);
  ov.querySelector("[data-cancel]").addEventListener("click", () => closeModal(ov));
  ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(ov); });
}
function fmtShort(n) {
  const S = ["", "K", "M", "B", "T"]; let i = 0;
  while (n >= 1000 && i < S.length - 1) { n /= 1000; i++; }
  return (i ? n.toFixed(1).replace(/\.0$/, "") : Math.floor(n)) + S[i];
}

/* ---------- Réglages ---------- */
function openSettings() {
  const ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML =
    `<div class="overlay-card"><div class="stars">⚙️</div><h1>Réglages</h1>` +
    `<div class="set-list">` +
    `<button class="set-row" data-sound><span>Son</span><b id="setSound">${state.sound ? "🔊 Activé" : "🔇 Coupé"}</b></button>` +
    `<button class="set-row" data-vibrate><span>Vibration</span><b id="setVibrate">${state.vibrate ? "📳 Activée" : "🚫 Coupée"}</b></button>` +
    `<button class="set-row" data-reset-tri><span>Réinitialiser le tri</span><b>↺</b></button>` +
    `<button class="set-row danger" data-reset-all><span>Tout réinitialiser</span><b>🗑️</b></button>` +
    `</div>` +
    `<p style="margin-top:14px;font-size:.8rem;opacity:.6;">My Arcade · jeux hors-ligne</p>` +
    `<button class="btn ghost" data-cancel style="margin-top:8px;">Fermer</button></div>`;
  document.body.appendChild(ov);
  ov.querySelector("[data-sound]").addEventListener("click", () => {
    state.sound = !state.sound;
    $("soundBtn").textContent = state.sound ? "🔊" : "🔇";
    ov.querySelector("#setSound").textContent = state.sound ? "🔊 Activé" : "🔇 Coupé";
    if (state.sound) beep(660, 0.1, "triangle");
    save();
  });
  ov.querySelector("[data-vibrate]").addEventListener("click", () => {
    state.vibrate = !state.vibrate;
    ov.querySelector("#setVibrate").textContent = state.vibrate ? "📳 Activée" : "🚫 Coupée";
    if (state.vibrate) vibrate(25);
    save();
  });
  ov.querySelector("[data-reset-tri]").addEventListener("click", () => {
    try { localStorage.removeItem("triage_save"); localStorage.removeItem("triage"); } catch (e) {}
    state.level = 0; state.clevel = 0; state.jlevel = 0; state.m3level = 0;
    state.score = 0; state.levelStartScore = 0; state.total = 0; state.remaining = 0;
    state.mistakes = 0; state.combo = 0; state.maxCombo = 0; state.daily = false;
    meta.stars = {}; meta.reached = {}; saveMeta();      // étoiles + carte remises à zéro (trésor conservé)
    clearWinTimers();
    stage.innerHTML = ""; binsEl.innerHTML = "";
    $("levelName").textContent = "Niveau 1"; $("hint").textContent = "";
    $("homeClose").hidden = true;
    updateHud(); updateCombo(); updateHubMeta();
    showToast("Progression de tri réinitialisée ↺");
  });
  ov.querySelector("[data-reset-all]").addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.querySelector("span").textContent = "Confirmer ? (tout effacer)"; return; }
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^arc_|^triage/.test(k)) keys.push(k); }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e2) {}
    location.reload();
  });
  ov.querySelector("[data-cancel]").addEventListener("click", () => closeModal(ov));
  ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(ov); });
}

/* ---------- Démarrage ---------- */
function init() {
  load();
  loadMeta();
  // le fond déjà utilisé avant la mise à jour reste acquis
  if (!meta.bgUnlocked.includes(state.bgIndex)) meta.bgUnlocked.push(state.bgIndex);
  buildSwatches();
  applyBackground(state.bgIndex);
  $("soundBtn").textContent = state.sound ? "🔊" : "🔇";
  bindUI();
  bindZoom();
  bindStage();
  updateHubMeta();

  // Sauvegarde partie + méta quand on quitte / met l'app en arrière-plan
  window.addEventListener("pagehide", () => { saveGame(); saveMeta(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { saveGame(); saveMeta(); } });

  // On ouvre TOUJOURS sur le hub d'accueil. Si une partie de tri était en cours,
  // on la reconstruit derrière et le bouton "reprendre" (✕) devient dispo.
  // Le snapshot est VALIDÉ avant d'être injecté (version, mode, difficulté) —
  // un snapshot corrompu est jeté au lieu de casser le prochain buildLevel.
  const saved = loadGame();
  const validSave = saved && saved.v === 2 &&
    ["familles", "couleurs", "jumeaux", "match3"].includes(saved.mode) &&
    DIFFICULTY[saved.difficulty] &&
    saved.remaining > 0 && Array.isArray(saved.tokens) && saved.tokens.length;
  if (validSave) {
    restoreGame(saved);
    $("homeClose").hidden = false;
  } else if (saved) {
    clearGame();
  }
  $("home").hidden = false;
}

document.addEventListener("DOMContentLoaded", init);
