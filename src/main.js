import { Game } from "./game.js";
import { listSaves, loadSave, wipeLegacySaves } from "./save.js";
import { makePanorama } from "./ui/panorama.js";
import { MODS, installedMods, setModInstalled } from "./core/mods.js";
import { createAtlas } from "./core/atlas.js";

const ui = typeof document !== "undefined" ? document.getElementById("ui") : null;

/** @type {Game | null} */
let game = null;

const LAST_SEED_KEY = "mincraft0101:last-seed";
const LAST_MODE_KEY = "mincraft0101:last-mode";
const SPLASHES = ["Finally, it's free.", "Boats included!", "Mind the ghasts.", "Shift to sneak.", "The End is near.", "Auto-jump enabled!", "Now with bubbles!", "Punch trees.", "Dragons are friends."];

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function randomSeedValue() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const len = 10;
  const gCrypto = globalThis.crypto;
  if (gCrypto && typeof gCrypto.getRandomValues === "function") {
    const bytes = new Uint32Array(len);
    gCrypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < len; i++) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[(Math.random() * alphabet.length) | 0];
  return out;
}

function syncSeedFields(sourceEl, targetEl) {
  if (!sourceEl || !targetEl || sourceEl === targetEl) return;
  const value = (sourceEl.value || "").trim();
  const next = value || "";
  if (targetEl.value !== next) targetEl.value = next;
}

function readStoredSeed() {
  try {
    return localStorage.getItem(LAST_SEED_KEY) || "";
  } catch {
    return "";
  }
}

function readStoredMode() {
  try {
    const mode = localStorage.getItem(LAST_MODE_KEY);
    return mode === "creative" ? "creative" : "survival";
  } catch {
    return "survival";
  }
}

function rememberSeedPreference(seedText, mode) {
  const value = (seedText || "").trim();
  try {
    if (value) localStorage.setItem(LAST_SEED_KEY, value);
    else localStorage.removeItem(LAST_SEED_KEY);
    localStorage.setItem(LAST_MODE_KEY, mode === "creative" ? "creative" : "survival");
  } catch {}
}

function sanitizeWorldName(value) {
  const formatted = (value || "").replace(/\s+/g, " ").trim();
  return formatted || "New World";
}

function makeUniqueWorldName(baseName, existing = []) {
  const used = new Set(
    (Array.isArray(existing) ? existing : [])
      .map((row) => sanitizeWorldName(row?.name || ""))
      .filter(Boolean)
  );

  const base = sanitizeWorldName(baseName || "New World");
  if (!used.has(base)) return base;

  let i = 2;
  let candidate = `${base} ${i}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base} ${i}`;
  }
  return candidate;
}

function applyWorldDefaults() {
  const nameEl = document.getElementById("wname");
  const mainSeed = document.getElementById("seed");
  const createSeed = document.getElementById("cseed");

  if (nameEl) nameEl.value = sanitizeWorldName(nameEl.value || "New World");
  if (mainSeed && createSeed && !createSeed.value && mainSeed.value) {
    createSeed.value = mainSeed.value;
  }
}

function setContinueStatus(row) {
  const btn = document.getElementById("continueBtn");
  if (!btn || !row) return;

  const when = row.updated ? new Date(row.updated).toLocaleString() : "";
  const title = row.name ? sanitizeWorldName(row.name) : row.mode || "World";
  const subtitle = when ? `Last played ${when}` : "Resume your latest world";

  btn.hidden = false;
  btn.dataset.load = row.id;
  btn.innerHTML = `<span class="button-label">Continue</span><span class="button-sub">${title}${subtitle ? " · " + subtitle : ""}</span>`;
}

function start(mode, seed, saveData = null, opts = {}) {
  if (game) game.dispose();
  game = new Game(mode, seed, ui, saveData, opts);
}

function tileIcon(atlas, tile) {
  const c = document.createElement("canvas");
  c.width = 40;
  c.height = 40;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const tx = (tile % 16) * 16;
  const ty = Math.floor(tile / 16) * 16;
  g.drawImage(atlas, tx, ty, 16, 16, 0, 0, 40, 40);
  return c;
}

function renderStore() {
  const list = document.getElementById("storelist");
  if (!list) return;
  const atlas = createAtlas();
  const have = installedMods();
  list.innerHTML = "";
  for (const m of MODS) {
    const card = document.createElement("div");
    card.className = "modcard" + (have.has(m.id) ? " installed" : "");
    const icon = tileIcon(atlas, m.tile);
    icon.className = "modicon";
    const info = document.createElement("div");
    info.className = "modinfo";
    const h = document.createElement("h3");
    h.textContent = m.name + (m.builtin ? " (always on)" : "");
    const p = document.createElement("p");
    p.textContent = m.desc;
    info.append(h, p);
    const right = document.createElement("div");
    right.className = "modright";
    const price = document.createElement("div");
    price.className = "free";
    price.textContent = m.builtin ? "" : "FREE";
    const btn = document.createElement("button");
    btn.className = "mc small";
    if (m.builtin) {
      btn.textContent = "Built in";
      btn.disabled = true;
    } else if (have.has(m.id)) {
      btn.textContent = "Installed";
      btn.onclick = () => {
        setModInstalled(m.id, false);
        renderStore();
      };
    } else {
      btn.textContent = "Install";
      btn.onclick = () => {
        setModInstalled(m.id, true);
        renderStore();
      };
    }
    right.append(price, btn);
    card.append(icon, info, right);
    list.append(card);
  }
}

function boot() {
  if (typeof document === "undefined" || !ui) return;
  wipeLegacySaves(); // fresh start: remove all saved worlds from previous versions

  const sp = document.getElementById("splash");
  if (sp) sp.textContent = SPLASHES[(Math.random() * SPLASHES.length) | 0];

  // animated pixel-art panorama behind the title screen
  try {
    const menu = document.getElementById("menu");
    if (menu && !document.getElementById("pano")) {
      const p = makePanorama();
      const el = document.createElement("div");
      el.id = "pano";
      el.style.backgroundImage = `url(${p.url})`;
      el.style.setProperty("--pano-w", `${p.w}px`);
      menu.prepend(el);
    }
  } catch {}

  let createMode = readStoredMode();
  let createNet = "single";

  const storedSeed = readStoredSeed();
  const mainSeed = document.getElementById("seed");
  const createSeed = document.getElementById("cseed");
  if (mainSeed && !mainSeed.value && storedSeed) mainSeed.value = storedSeed;
  if (createSeed && !createSeed.value && storedSeed) createSeed.value = storedSeed;

  const attachSeedSync = () => {
    const mainSeed = document.getElementById("seed");
    const createSeed = document.getElementById("cseed");
    if (!mainSeed || !createSeed) return;
    mainSeed.addEventListener("input", () => syncSeedFields(mainSeed, createSeed));
    createSeed.addEventListener("input", () => syncSeedFields(createSeed, mainSeed));
  };
  attachSeedSync();

  const setMode = (m) => {
    createMode = m;
    document.querySelectorAll(".modetoggle").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    const btn = document.getElementById("docreate");
    if (btn) btn.textContent = m === "creative" ? "Create Creative World" : "Create Survival World";
  };
  setMode(createMode);
  const setNet = (n) => {
    createNet = n;
    document.querySelectorAll(".nettoggle").forEach((b) => b.classList.toggle("active", b.dataset.net === n));
  };

  ui.addEventListener("click", (e) => {
    const t = e.target;

    const randomSeedBtn = t.closest("[data-random-seed]");
    if (randomSeedBtn) {
      const nextSeed = randomSeedValue();
      const mainSeed = document.getElementById("seed");
      const createSeed = document.getElementById("cseed");
      [mainSeed, createSeed].forEach((el) => {
        if (el) el.value = nextSeed;
      });
      rememberSeedPreference(nextSeed, createMode);
      return;
    }

    const startBtn = t.closest("[data-start]");
    if (startBtn) {
      const seedEl = document.getElementById("seed");
      const seedText = seedEl && seedEl.value ? seedEl.value.trim() : "";
      const seed = seedText ? hashSeed(seedText) : 0;
      rememberSeedPreference(seedText, startBtn.dataset.start === "creative" ? "creative" : "survival");
      start(startBtn.dataset.start, seed);
      return;
    }

    const quickStartBtn = t.closest("[data-quickstart]");
    if (quickStartBtn) {
      const seedEl = document.getElementById("seed");
      const seedText = seedEl && seedEl.value ? seedEl.value.trim() : "";
      const seed = seedText ? hashSeed(seedText) : Math.floor(Math.random() * 0xffffffff);
      rememberSeedPreference(seedText, "survival");
      listSaves().then((rows) => {
        const name = makeUniqueWorldName("New World", rows);
        const wname = document.getElementById("wname");
        if (wname) wname.value = name;
        start("survival", seed, null, { name });
      }).catch(() => start("survival", seed, null, { name: "New World" }));
      return;
    }

    const loadBtn = t.closest("[data-load]");
    if (loadBtn) {
      loadSave(loadBtn.dataset.load).then((save) => {
        if (save) start(save.mode, save.seed, save);
      });
      return;
    }

    if (t.closest("[data-store]")) {
      renderStore();
      document.getElementById("store").classList.remove("hidden");
      document.getElementById("menu").classList.add("hidden");
      return;
    }
    if (t.closest("[data-closestore]")) {
      document.getElementById("store").classList.add("hidden");
      document.getElementById("menu").classList.remove("hidden");
      return;
    }

    const createBtn = t.closest("[data-create]");
    if (createBtn) {
      const requestedMode = createBtn.dataset.mode || "survival";
      setMode(requestedMode);
      setNet("single");
      const nm = document.getElementById("wname");
      if (nm) nm.value = "New World";
      const ch = document.getElementById("cheats");
      if (ch) ch.checked = false;
      applyWorldDefaults();
      document.getElementById("create").classList.remove("hidden");
      document.getElementById("menu").classList.add("hidden");
      return;
    }
    if (t.closest("[data-closecreate]")) {
      document.getElementById("create").classList.add("hidden");
      document.getElementById("menu").classList.remove("hidden");
      return;
    }
    const modeBtn = t.closest(".modetoggle");
    if (modeBtn) {
      setMode(modeBtn.dataset.mode);
      return;
    }
    const netBtn = t.closest(".nettoggle");
    if (netBtn) {
      setNet(netBtn.dataset.net);
      return;
    }
    if (t.closest("#docreate")) {
      const baseName = sanitizeWorldName(document.getElementById("wname")?.value);
      const cheats = document.getElementById("cheats")?.checked || false;
      const seedRaw = document.getElementById("cseed")?.value || document.getElementById("seed")?.value || "";
      const seed = seedRaw.trim() ? hashSeed(seedRaw.trim()) : 0;
      rememberSeedPreference(seedRaw, createMode);
      const wname = document.getElementById("wname");
      listSaves()
        .then((rows) => {
          const name = makeUniqueWorldName(baseName, rows);
          if (wname) wname.value = name;
          start(createMode, seed, null, { name, cheats, server: createNet === "server" });
        })
        .catch(() => {
          if (wname) wname.value = baseName;
          start(createMode, seed, null, { name: baseName, cheats, server: createNet === "server" });
        });
    }
  });

  // Enter submits the create screen
  for (const id of ["wname", "cseed"]) {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") document.getElementById("docreate")?.click();
      });
  }

  listSaves()
    .then((rows) => {
      if (!rows.length) return;
      setContinueStatus(rows[0]);
    })
    .catch(() => {});
}

if (typeof document !== "undefined") boot();
