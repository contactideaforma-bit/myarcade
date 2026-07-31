# 🕹️ My Arcade

Un petit arcade dans la poche : **16 mini-jeux** en HTML / CSS / JavaScript pur.
Aucun framework, aucune étape de build, aucune dépendance. On ouvre `index.html` et ça marche.

Pensé mobile d'abord (format portrait, tout au pouce), thème « doodle » coloré.

## Les jeux

| Catégorie | Jeux |
|---|---|
| ⭐ Les grands jeux | **Ma Fête Foraine** (idle tycoon), **Emoji Hole**, Défi du jour |
| 🧺 Tri & rangement | Familles, Jumeaux, Couleurs, Match-3 |
| 🧩 Casse-tête | 2048, Paires, Taquin, Démineur |
| ♟️ Stratégie | Puissance 4 (IA minimax), Morpion (parfait) |
| 🕹️ Arcade & réflexe | Serpent, Casse-briques, Taupes, Séquence |
| 🧘 Zen | Zen, Pop |

## Structure

```
index.html          hub + hôte plein écran des mini-jeux
css/style.css       thème doodle, tout le style du site
js/game.js          moteur de tri d'emojis (les 4 modes « Tri »)
js/arcade.js        hôte : ARCADE.register / open / close
js/games/*.js       un fichier par mini-jeu
assets/park/        décor et vignettes de Ma Fête Foraine
vercel.json         config Vercel (site statique, pas de build, en-têtes de cache)
```

### Ajouter un mini-jeu

Créer `js/games/<id>.js` :

```js
window.ARCADE.register({
  id: "monjeu", title: "Mon Jeu", emoji: "🎲",
  mount(board, api) {
    // ... construire l'UI dans `board`
    api.onExit(() => { /* nettoyage OBLIGATOIRE : timers, listeners, rAF */ });
  },
});
```

puis ajouter le `<script>` dans `index.html` (après `game.js` et `arcade.js`) et une
tuile `<button class="tile" data-game="monjeu">` dans le hub.

L'objet `api` fournit : `board`, `W/H`, `setStatus`, `onExit`, `beep / vibrate /
soundGood / soundBad / soundWin / win / confetti`, `rand / shuffle`, `colors`,
`getBest(id) / setBest(id, v, lower)`.

## Ma Fête Foraine — note de conception

Le tycoon a été refondu pour éviter le travers classique des idle : des nombres
qui explosent jusqu'à devenir illisibles et vider le jeu de son intérêt.

Le principe est une **saison finie** : 9 attractions, 25 niveaux chacune, 4 paliers ⭐
qui doublent la production. L'attraction suivante s'ouvre quand la précédente atteint
le niveau 18. Les constantes sont calibrées (par simulation) pour qu'une saison complète
demande ~33 h de production continue et que **les chiffres ne dépassent jamais le
suffixe G**. Quand le parc est complet, on lance une nouvelle saison : le parc repart
à zéro, les ⭐ VIP et les bonus permanents restent.

⚠️ Toute modification de `MAXL`, `MS`, `GR`, `GATE`, `base` ou `c0` dans
`js/games/tycoon.js` change cet équilibre — à re-simuler avant de publier.

## Développement

Aucun build. Pour un serveur local :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Déploiement

Déployé sur **Vercel** depuis ce dépôt : site statique, aucune commande de build,
répertoire de sortie = racine. Tout est décrit dans `vercel.json`. Chaque `git push`
sur `main` redéploie automatiquement.

Note : les fichiers statiques vivent dans `assets/` et non `public/`, parce que Vercel
traite un dossier `public/` à la racine comme le répertoire de sortie du build et ne
servirait alors plus `index.html`.
