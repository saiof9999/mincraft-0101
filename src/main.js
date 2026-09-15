import { Game } from "./game.js";

const ui = document.getElementById("ui");

function boot() {
  const menu = document.getElementById("ui");
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-start]");
    if (!b) return;
    const seedEl = document.getElementById("seed");
    const seed = seedEl && seedEl.value ? hashSeed(seedEl.value) : 0;
    start(b.dataset.start, seed);
  });
}

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** @type {Game | null} */
let game = null;

function start(mode, seed) {
  if (game) game.dispose();
  game = new Game(mode, seed, ui);
}

boot();
