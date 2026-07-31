(function () {
  "use strict";

  window.ARCADE.register({
    id: "pairs",
    title: "Paires",
    emoji: "🃏",
    mount(board, api) {
      const C = api.colors;

      const EMOJIS = ["🍎", "🐶", "🚗", "⚽", "🍕", "🌈", "🐸", "🎈", "🐱", "🍩", "🚀", "🎸"];

      // Mode progressif : 4x4 (8 paires) puis 6x4 (12 paires) après victoire.
      let PAIRS = 8;
      let COLS = 4;
      let ROWS = 4;

      let cards = [];        // {emoji, matched, flipped, el, inner}
      let first = null;
      let second = null;
      let busy = false;
      let moves = 0;
      let foundPairs = 0;
      const timers = [];

      // Chrono
      let startTime = 0; // démarre au 1er retournement
      let endTime = 0;
      let clockId = 0;

      function elapsedSec() {
        if (!startTime) return 0;
        const end = endTime || Date.now();
        return Math.floor((end - startTime) / 1000);
      }
      function fmtTime(s) {
        const m = Math.floor(s / 60);
        const r = s % 60;
        return m + ":" + (r < 10 ? "0" : "") + r;
      }

      // dos (back) colors cycle
      const backColors = [C.coral, C.turq, C.sun, C.grape, C.lime, C.bubble, C.sky, C.tang];

      // ---- layout ----
      const W = board.clientWidth || api.W || 360;
      const H = board.clientHeight || api.H || 560;
      const gap = 10;
      let cardSz = 80; // recalculé par mode dans startGame()

      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:relative;display:flex;align-items:center;justify-content:center;" +
        "width:100%;height:100%;";
      board.appendChild(wrap);

      const gridEl = document.createElement("div");
      gridEl.style.cssText = "position:relative;display:grid;" +
        "touch-action:manipulation;user-select:none;";
      wrap.appendChild(gridEl);

      // petit saut des paires trouvées
      const styleEl = document.createElement("style");
      styleEl.textContent =
        "@keyframes prJump{0%{transform:translateY(0) scale(1)}" +
        "40%{transform:translateY(-12px) scale(1.1)}" +
        "100%{transform:translateY(0) scale(1)}}";
      board.appendChild(styleEl);

      let overlay = null;

      function updateStatus() {
        const b = (PAIRS === 8 && api.hasBest("pairs"))
          ? " · Best <b>" + api.getBest("pairs") + "</b>"
          : "";
        api.setStatus(
          "Paires <b>" + foundPairs + "/" + PAIRS + "</b>" +
          " · Coups <b>" + moves + "</b>" +
          " · ⏱ " + fmtTime(elapsedSec()) + b
        );
      }

      function buildCard(card, idx) {
        const el = document.createElement("div");
        el.style.cssText =
          "position:relative;width:" + cardSz + "px;height:" + cardSz + "px;" +
          "cursor:pointer;perspective:600px;touch-action:manipulation;";

        const inner = document.createElement("div");
        inner.style.cssText =
          "position:absolute;inset:0;transition:transform .35s,filter .4s,opacity .4s;" +
          "transform-style:preserve-3d;";

        const backC = backColors[idx % backColors.length];

        const back = document.createElement("div");
        back.textContent = "?";
        back.style.cssText =
          "position:absolute;inset:0;backface-visibility:hidden;" +
          "display:flex;align-items:center;justify-content:center;" +
          "font-size:" + Math.floor(cardSz * 0.4) + "px;font-weight:700;color:" + C.ink + ";" +
          "background:" + backC + ";border:3px solid " + C.ink + ";" +
          "border-radius:14px;box-shadow:3px 3px 0 " + C.ink + ";";

        const face = document.createElement("div");
        face.textContent = card.emoji;
        face.style.cssText =
          "position:absolute;inset:0;backface-visibility:hidden;" +
          "transform:rotateY(180deg);" +
          "display:flex;align-items:center;justify-content:center;" +
          "font-size:" + Math.floor(cardSz * 0.5) + "px;" +
          "background:" + C.paper + ";border:3px solid " + C.ink + ";" +
          "border-radius:14px;box-shadow:3px 3px 0 " + C.ink + ";";

        inner.appendChild(back);
        inner.appendChild(face);
        el.appendChild(inner);

        card.el = el;
        card.inner = inner;
        card.idx = idx;

        el.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          onFlip(card);
        });

        return el;
      }

      function setFlipped(card, flipped) {
        card.flipped = flipped;
        card.inner.style.transform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";
      }

      function celebratePair(card) {
        card.el.style.animation = "prJump .5s ease";
        const tm = setTimeout(function () {
          card.el.style.animation = "";
          // grisage léger une fois la paire rangée
          card.inner.style.filter = "grayscale(.55)";
          card.inner.style.opacity = ".72";
        }, 500);
        timers.push(tm);
      }

      function onFlip(card) {
        if (busy) return;
        if (card.matched || card.flipped) return;

        if (!startTime) startTime = Date.now();

        setFlipped(card, true);
        api.beep(440, 0.05, "sine", 0.2);

        if (!first) {
          first = card;
          return;
        }
        // second card
        second = card;
        moves++;
        updateStatus();
        busy = true;

        if (first.emoji === second.emoji) {
          // match
          const a = first, b = second;
          const tm = setTimeout(function () {
            a.matched = true;
            b.matched = true;
            celebratePair(a);
            celebratePair(b);
            api.soundGood();
            first = null; second = null; busy = false;
            foundPairs++;
            updateStatus();
            if (foundPairs === PAIRS) finish();
          }, 300);
          timers.push(tm);
        } else {
          // no match -> flip back
          const a = first, b = second;
          const tm = setTimeout(function () {
            setFlipped(a, false);
            setFlipped(b, false);
            first = null; second = null; busy = false;
          }, 750);
          timers.push(tm);
        }
      }

      // 3⭐ si peu de coups, 2⭐ si correct, 1⭐ sinon
      function starCount() {
        if (moves <= PAIRS + Math.ceil(PAIRS / 2)) return 3;
        if (moves <= PAIRS * 2) return 2;
        return 1;
      }

      function finish() {
        endTime = Date.now();
        // moins de coups = mieux ; record réservé à la grille 4x4 (comparable)
        let res = null;
        if (PAIRS === 8) {
          res = api.setBest("pairs", moves, true);
        }
        updateStatus();
        api.win();
        if (res && res.isNew) api.confetti();
        showEnd(res);
      }

      function makeButton(label, bg) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.cssText =
          "font:inherit;font-size:19px;font-weight:700;cursor:pointer;" +
          "padding:12px 26px;background:" + (bg || C.sun) + ";color:" + C.ink + ";" +
          "border:3px solid " + C.ink + ";border-radius:16px;" +
          "box-shadow:3px 3px 0 " + C.ink + ";";
        return btn;
      }

      function showEnd(res) {
        overlay = document.createElement("div");
        overlay.style.cssText =
          "position:absolute;inset:0;background:#fff8ecdd;" +
          "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
          "gap:14px;z-index:10;border-radius:18px;";

        const stars = document.createElement("div");
        const n = starCount();
        stars.textContent = "⭐".repeat(n) + "☆".repeat(3 - n);
        stars.style.cssText = "font-size:38px;letter-spacing:4px;";
        overlay.appendChild(stars);

        const msg = document.createElement("div");
        msg.innerHTML =
          "Bravo ! <b>" + moves + "</b> coups · ⏱ " + fmtTime(elapsedSec());
        msg.style.cssText =
          "font-size:24px;font-weight:700;color:" + C.ink + ";text-align:center;";
        overlay.appendChild(msg);

        if (res) {
          const rec = document.createElement("div");
          rec.textContent = res.isNew
            ? "🎉 Nouveau record !"
            : "Meilleur : " + res.best + " coups";
          rec.style.cssText = "font-size:16px;color:" + C.ink + ";";
          overlay.appendChild(rec);
        }

        const btn = makeButton("Rejouer");
        btn.addEventListener("click", function () { restart(PAIRS); });
        overlay.appendChild(btn);

        // mode progressif : proposer la grande grille après une victoire 4x4
        if (PAIRS === 8) {
          const big = makeButton("Grille 6×4 ▶", C.lime);
          big.addEventListener("click", function () { restart(12); });
          overlay.appendChild(big);
        } else {
          const small = makeButton("◀ Grille 4×4", C.turq);
          small.addEventListener("click", function () { restart(8); });
          overlay.appendChild(small);
        }

        wrap.appendChild(overlay);
      }

      function restart(pairs) {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
        PAIRS = pairs;
        ROWS = PAIRS === 8 ? 4 : 6;
        COLS = 4;
        startGame();
      }

      function startGame() {
        // clear timers/state
        timers.forEach(function (t) { clearTimeout(t); });
        timers.length = 0;
        first = null; second = null; busy = false;
        moves = 0; foundPairs = 0;
        startTime = 0; endTime = 0;

        // layout du mode courant (cartes carrées)
        cardSz = Math.floor(Math.min(
          (W - 20 - gap * (COLS - 1)) / COLS,
          (H - 20 - gap * (ROWS - 1)) / ROWS,
          92
        ));
        const boardW = cardSz * COLS + gap * (COLS - 1);
        gridEl.style.gridTemplateColumns = "repeat(" + COLS + "," + cardSz + "px)";
        gridEl.style.gridTemplateRows = "repeat(" + ROWS + "," + cardSz + "px)";
        gridEl.style.gap = gap + "px";
        gridEl.style.width = boardW + "px";

        // pick emojis, make pairs, shuffle
        const pool = api.shuffle(EMOJIS.slice()).slice(0, PAIRS);
        let deck = [];
        pool.forEach(function (em) {
          deck.push({ emoji: em, matched: false, flipped: false });
          deck.push({ emoji: em, matched: false, flipped: false });
        });
        api.shuffle(deck);
        cards = deck;

        gridEl.innerHTML = "";
        cards.forEach(function (card, i) {
          gridEl.appendChild(buildCard(card, i));
        });

        updateStatus();
      }

      // tick chrono
      clockId = setInterval(function () {
        if (startTime && !endTime) updateStatus();
      }, 500);

      // ---- cleanup ----
      api.onExit(function () {
        clearInterval(clockId);
        timers.forEach(function (t) { clearTimeout(t); });
      });

      startGame();
    }
  });
})();
