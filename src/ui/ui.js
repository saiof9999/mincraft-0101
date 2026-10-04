import { DEFS, def, allItems } from "../core/blocks.js";
import { CRAFTS, findCraft, canCraft } from "../core/recipes.js";
import { installedMods } from "../core/mods.js";
import { iconCanvas } from "../core/atlas.js";

export class UI {
  constructor(root, atlas) {
    this.root = root;
    this.atlas = atlas;
    this.icons = new Map();
    this.mode = "menu";
    this.invOpen = false;
    this.creativeOpen = false;
    this.pause = false;
    this.bookOpen = true;
    this.recipeFilter = "all";
    this.itemFilter = "all";
    this.build();
  }

  icon(id) {
    if (!this.icons.has(id)) this.icons.set(id, iconCanvas(id, this.atlas));
    return this.icons.get(id);
  }

  build() {
    this.root.innerHTML = `
      <div id="menu" class="screen menu">
        <div class="logo">MINCRAFT <span class="logo2">0101</span></div>
        <div class="splash" id="splash"></div>
        <div class="btn-col">
          <button class="mc" id="continueBtn" data-load hidden>Continue</button>
          <button class="mc" data-create>Create World</button>
          <button class="mc" data-store>Mods &amp; Store <span class="free">(all free)</span></button>
          <div class="row">
            <input class="mc" id="seed" placeholder="Seed (optional)" />
          </div>
        </div>
        <div class="hint">
          Pick <b>Survival</b> or <b>Creative</b> on the Create World screen<br/>
          WASD move · Space jump · Shift sneak · double-tap W or Ctrl to sprint · auto-jump is on<br/>
          Left break (items drop) · Right place · E inventory &amp; recipes · 1-9 hotbar<br/>
          G camera · T chat &amp; commands · Esc pause · watch your air bubbles underwater!
        </div>
        <div class="foot">Mincraft 0101 v3.0 · an original voxel sandbox · fan-made, not affiliated with Mojang</div>
      </div>
      <div id="hud" class="hidden">
        <div id="crosshair"></div>
        <div id="bars">
          <div class="pips" id="hearts"></div>
          <div class="pips" id="hunger"></div>
        </div>
        <div id="xp"><i></i></div>
        <div id="itemname"></div>
        <div id="bubbles"></div>
        <div id="hotbar"></div>
        <div id="debug"></div>
        <div id="chat"></div>
        <div id="chatbox" class="hidden"><input id="chatin" maxlength="120" autocomplete="off" spellcheck="false" placeholder="Chat or type / for commands..." /></div>
        <div id="sculptbar" class="hidden">MINI MODE · you are tiny · LMB remove · RMB place · H hide inside · Z sleep · O exit</div>
        <div class="toast hidden" id="toast"></div>
      </div>
      <div id="invpanel" class="panel hidden"></div>
      <div id="creative" class="panel hidden"></div>
      <div id="pause" class="screen hidden" hidden>
        <div class="pause-list">
          <h2 style="color:#fff;text-align:center">Paused</h2>
          <label class="slider">Camera <select id="camSel" class="mc">
            <option value="0">First person</option>
            <option value="1">Third person</option>
            <option value="2">Front view</option>
          </select></label>
          <label class="slider">Sensitivity <input type="range" id="sens" min="5" max="40" value="22" /></label>
          <label class="slider">FOV <input type="range" id="fov" min="50" max="110" value="75" /></label>
          <label class="slider">Distance <input type="range" id="dist" min="20" max="80" value="42" /></label>
          <label class="slider"><input type="checkbox" id="invy" /> Invert Y</label>
          <button class="mc" id="resume">Back to game</button>
          <button class="mc" id="tomain">Title screen</button>
        </div>
      </div>
      <div id="dead" class="screen hidden">
        <div class="logo" style="font-size:48px">You died</div>
        <button class="mc" id="respawn">Respawn</button>
      </div>
    `;
    const splashes = ["Finally, it's free.", "Boats included!", "Mind the ghasts.", "Shift to sneak.", "The End is near.", "Not a chatbot demo."];
    this.root.querySelector("#splash").textContent = splashes[(Math.random() * splashes.length) | 0];
  }

  showHud() {
    this.root.querySelector("#menu").classList.add("hidden");
    this.root.querySelector("#hud").classList.remove("hidden");
  }

  paintHotbar(inv) {
    const sig = inv.selected + "|" + inv.hotbar.map((s) => `${s.id}:${s.count}`).join(",");
    if (sig === this._hbSig) return;
    this._hbSig = sig;
    const hb = this.root.querySelector("#hotbar");
    hb.innerHTML = "";
    inv.hotbar.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "slot" + (i === inv.selected ? " sel" : "");
      if (s.id) {
        el.append(this.icon(s.id).cloneNode(true));
        if (s.count > 1) {
          const n = document.createElement("div");
          n.className = "n";
          n.textContent = s.count;
          el.append(n);
        }
      }
      hb.append(el);
    });
  }

  paintBars(p) {
    const air = p.air ?? 10;
    const sig = `${p.mode}|${p.health}|${p.hunger}|${Math.ceil(air)}|${p.headInWater ? 1 : 0}`;
    if (sig === this._barSig) return;
    this._barSig = sig;
    const h = this.root.querySelector("#hearts");
    const u = this.root.querySelector("#hunger");
    h.innerHTML = "";
    u.innerHTML = "";
    const bub = this.root.querySelector("#bubbles");
    if (bub) {
      const show = p.mode === "survival" && (p.headInWater || air < p.airMax - 0.01);
      bub.style.display = show ? "flex" : "none";
      bub.classList.toggle("low", air <= 2);
      if (sig === this._bubSig) {
        // bubbles unchanged
      } else {
        this._bubSig = sig;
        bub.innerHTML = "";
        if (show) {
          for (let i = 0; i < 10; i++) {
            const e = document.createElement("div");
            e.className = "bubble" + (i < Math.ceil(air) ? "" : " off");
            bub.append(e);
          }
        }
      }
    }
    if (p.mode === "creative") {
      h.style.display = "none";
      u.style.display = "none";
      return;
    }
    h.style.display = "flex";
    u.style.display = "flex";
    for (let i = 0; i < 10; i++) {
      const e = document.createElement("div");
      e.className = "heart";
      const v = p.health / 2 - i;
      if (v >= 1) e.classList.add("on");
      else if (v >= 0.5) e.classList.add("half");
      h.append(e);
      const g = document.createElement("div");
      g.className = "shank" + (p.hunger / 2 - i >= 1 ? " on" : "");
      u.append(g);
    }
  }

  debug(text, on) {
    const d = this.root.querySelector("#debug");
    d.style.display = on ? "block" : "none";
    d.textContent = text;
  }

  chat(msg) {
    const c = this.root.querySelector("#chat");
    const d = document.createElement("div");
    d.textContent = msg;
    c.append(d);
    while (c.children.length > 6) c.removeChild(c.firstChild);
  }

  showItemName(name) {
    const el = this.root.querySelector("#itemname");
    if (!el || !name) return;
    el.textContent = name;
    el.classList.remove("show");
    void el.offsetWidth; // restart the fade animation
    el.classList.add("show");
  }

  openChat(prefill = "") {
    const box = this.root.querySelector("#chatbox");
    box.classList.remove("hidden");
    const inp = box.querySelector("#chatin");
    inp.value = prefill;
    setTimeout(() => inp.focus(), 0);
    inp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        const v = inp.value;
        inp.value = "";
        this.onChatSubmit?.(v);
      } else if (e.key === "Escape") {
        this.onChatCancel?.();
      }
    };
  }

  closeChat() {
    const box = this.root.querySelector("#chatbox");
    box.classList.add("hidden");
    box.querySelector("#chatin").blur();
  }

  showSculpt(on) {
    this.root.querySelector("#sculptbar").classList.toggle("hidden", !on);
  }

  clearChat() {
    this.root.querySelector("#chat").innerHTML = "";
  }

  normalizeSearch(text) {
    return String(text ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
  }

  itemCategory(defItem) {
    if (!defItem) return "all";
    const name = (defItem.name || "").toLowerCase();
    if (defItem.food || defItem.buff || defItem.boost) return "food";
    if (defItem.damage || defItem.throw || defItem.aoe || defItem.durability || defItem.item === true && /tool|sword|axe|pick|hammer|staff|whistle|shuriken|katana|car|backpack/.test(name)) return "tools";
    if (defItem.mod === "furniture" || /chair|table|lamp|sofa|bench|decor/.test(name)) return "decor";
    if (defItem.mod === "vehicles" || defItem.mod === "dragons" || defItem.mod === "teleport") return "utility";
    if (defItem.mod === "boom" || /tnt|dynamite|explosive/.test(name)) return "explosives";
    if (defItem.item === true) return "items";
    return "blocks";
  }

  filterBar(active = "all", kind = "recipe") {
    const values = [
      { key: "all", label: "All" },
      { key: "craftable", label: "Craftable" },
      { key: "blocks", label: "Blocks" },
      { key: "items", label: "Items" },
      { key: "tools", label: "Tools" },
      { key: "food", label: "Food" },
      { key: "decor", label: "Decor" },
      { key: "utility", label: "Utility" },
      { key: "explosives", label: "Explosives" }
    ];
    const wrap = document.createElement("div");
    wrap.className = "filter-bar";
    values.forEach(({ key, label }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (active === key ? " active" : "");
      btn.textContent = label;
      btn.dataset.filter = key;
      btn.dataset.kind = kind;
      btn.onclick = () => {
        if (kind === "recipe") this.recipeFilter = key;
        else this.itemFilter = key;
        if (this.invOpen) this.renderInv(this._lastPlayer);
        if (this.creativeOpen) this.openCreative(this._lastCreativePlayer);
      };
      wrap.append(btn);
    });
    return wrap;
  }

  scoreSearchEntry(label, query) {
    const normLabel = this.normalizeSearch(label);
    const normQuery = this.normalizeSearch(query);
    if (!normQuery) return { matches: true, score: 0 };
    const tokens = normQuery.split(/\s+/).filter(Boolean);
    if (!tokens.length) return { matches: true, score: 0 };
    const matchesAll = tokens.every((token) => normLabel.includes(token));
    if (!matchesAll && !normLabel.includes(normQuery)) {
      return { matches: false, score: -1 };
    }
    let score = 0;
    if (normLabel === normQuery) score += 100;
    else if (normLabel.startsWith(normQuery)) score += 60;
    score += tokens.reduce((total, token) => total + (normLabel.startsWith(token) ? 20 : 0) + (normLabel.includes(token) ? 10 : 0), 0);
    score += Math.max(0, 15 - tokens.length);
    return { matches: true, score };
  }

  toast(msg) {
    const t = this.root.querySelector("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.add("hidden"), 1400);
  }

  openInv(player, table = false) {
    this.invOpen = true;
    this.table = table;
    this._lastPlayer = player;
    this.renderInv(player);
  }

  recipeIngredients(r) {
    if (r.shapeless) return r.in;
    const need = {};
    for (const ch of r.shape.join("")) {
      const id = r.keys[ch];
      if (id) need[id] = (need[id] || 0) + 1;
    }
    return Object.entries(need);
  }

  renderInv(player) {
    this._lastPlayer = player;
    const p = this.root.querySelector("#invpanel");
    p.classList.remove("hidden");
    const mods = installedMods();
    const counts = player.inv.counts();
    const recs = CRAFTS.filter((r) => !r.mod || mods.has(r.mod));
    const can = new Map(recs.map((r) => [r, canCraft(counts, r)]));
    recs.sort((a, b) => (can.get(b) ? 1 : 0) - (can.get(a) ? 1 : 0));

    const hasBook = player.mode === "survival" || this.table;
    p.innerHTML = `
      <h2>${this.table ? "Crafting Table" : "Inventory"}</h2>
      <div class="filter-bar-wrap">${this.filterBar(this.recipeFilter, "recipe")}</div>
      <div class="inv-wrap">
        <div class="invcol">
          <div class="grouplabel-ui">${this.table ? "Craft 3×3" : "Craft 2×2"}</div>
          <div class="craftrow">
            <div class="grid craft" id="craftg"></div>
            <div class="craftarrow">→</div>
            <div class="slot ui rout" id="cout" title="Crafting result"></div>
          </div>
          <div class="grouplabel-ui">Inventory</div>
          <div class="grid inv" id="invm"></div>
          ${player.inv.extra?.length ? `<div class="grid inv backrow" id="invex"></div><div class="grouplabel-ui">Backpack</div>` : ""}
          <div class="grid inv hotrow" id="invh"></div>
          <div class="grouplabel-ui">Hotbar</div>
        </div>
        ${hasBook ? `
        <div class="invcol bookcol">
          <div class="grouplabel-ui">Recipe book · click to craft</div>
          <input class="search" id="rsearch" placeholder="Search recipes..." />
          <div class="recipelist" id="book"></div>
        </div>` : ""}
      </div>
      <div id="cursoritem" class="hidden"></div>
    `;

    // crafting grid
    const g = p.querySelector("#craftg");
    g.style.gridTemplateColumns = this.table ? "repeat(3,40px)" : "repeat(2,40px)";
    const slots = this.table ? player.inv.craft : [player.inv.craft[0], player.inv.craft[1], player.inv.craft[3], player.inv.craft[4]];
    slots.forEach((s) => g.append(this.slotEl(s, player)));
    const matchGrid = this.table
      ? player.inv.craft
      : [player.inv.craft[0], player.inv.craft[1], 0, player.inv.craft[3], player.inv.craft[4], 0, 0, 0, 0];
    const rec = findCraft(matchGrid);
    const out = p.querySelector("#cout");
    if (rec) {
      out.append(this.icon(rec.out[0]).cloneNode(true));
      if (rec.out[1] > 1) {
        const n = document.createElement("div");
        n.className = "n";
        n.textContent = rec.out[1];
        out.append(n);
      }
      out.onclick = () => {
        this.takeCraft(player, rec, matchGrid);
        this.renderInv(player);
        this.paintHotbar(player.inv);
      };
    }

    // inventory + backpack + hotbar
    const invm = p.querySelector("#invm");
    player.inv.main.forEach((s) => invm.append(this.slotEl(s, player)));
    const ex = p.querySelector("#invex");
    if (ex) player.inv.extra.forEach((s) => ex.append(this.slotEl(s, player)));
    const hb = p.querySelector("#invh");
    player.inv.hotbar.forEach((s) => hb.append(this.slotEl(s, player)));

    // recipe book
    const book = p.querySelector("#book");
    if (book) {
      const drawBook = (q = "") => {
        const query = this.normalizeSearch(q);
        const activeFilter = this.recipeFilter || "all";
        const matches = recs
          .map((r) => {
            const outputName = def(r.out[0]).name;
            const ingredients = this.recipeIngredients(r)
              .map(([ingId]) => def(ingId).name)
              .join(" ");
            const score = this.scoreSearchEntry(`${outputName} ${ingredients}`, query);
            const category = this.itemCategory(def(r.out[0]));
            return { r, outputName, score, category };
          })
          .filter(({ score, category, r }) => {
            const filterOk = activeFilter === "all"
              ? true
              : activeFilter === "craftable"
                ? can.get(r)
                : category === activeFilter;
            return score.matches && filterOk;
          })
          .sort((a, b) => {
            const craftRank = (can.get(b.r) ? 1 : 0) - (can.get(a.r) ? 1 : 0);
            if (craftRank !== 0) return craftRank;
            return b.score.score - a.score.score || a.outputName.localeCompare(b.outputName);
          });

        book.innerHTML = "";
        if (!matches.length) {
          book.innerHTML = `<div class="nores">No recipes found${query ? ` for “${q.trim()}”` : ""}</div>`;
          return;
        }

        for (const { r, outputName } of matches) {
          const card = document.createElement("div");
          card.className = "recipe" + (can.get(r) ? " craftable" : "");
          card.title = outputName + (player.mode !== "creative" ? " - click to craft" : "");
          const outEl = document.createElement("div");
          outEl.className = "slot ui rout";
          outEl.append(this.icon(r.out[0]).cloneNode(true));
          if (r.out[1] > 1) {
            const n = document.createElement("div");
            n.className = "n";
            n.textContent = r.out[1];
            outEl.append(n);
          }
          const info = document.createElement("div");
          info.className = "rinfo";
          const nm = document.createElement("div");
          nm.className = "rname";
          nm.textContent = outputName;
          const ing = document.createElement("div");
          ing.className = "ring";
          for (const [ingId, ingN] of this.recipeIngredients(r)) {
            const s = document.createElement("span");
            s.className = "ringitem";
            s.append(this.icon(ingId).cloneNode(true));
            const c = document.createElement("i");
            c.textContent = "×" + ingN;
            s.append(c);
            ing.append(s);
          }
          info.append(nm, ing);
          card.append(outEl, info);
          card.onclick = () => {
            if (player.mode !== "creative" && !canCraft(player.inv.counts(), r)) {
              this.toast("Missing materials");
              return;
            }
            this.craftFromInventory(player, r);
            this.toast("Crafted " + outputName);
            this.renderInv(player);
          };
          book.append(card);
        }
      };
      p.querySelector("#rsearch").oninput = (e) => drawBook(e.target.value);
      drawBook();
    }

    const filterButtons = p.querySelectorAll(".chip");
    filterButtons.forEach((btn) => {
      btn.onclick = () => {
        this.recipeFilter = btn.dataset.filter;
        this.renderInv(player);
      };
    });

    // held-cursor ghost for dragging items around
    const cur = p.querySelector("#cursoritem");
    const renderCursor = () => {
      cur.innerHTML = "";
      const c = player.inv.cursor;
      if (c && c.id) {
        cur.append(this.icon(c.id).cloneNode(true));
        if (c.count > 1) {
          const n = document.createElement("div");
          n.className = "n";
          n.textContent = c.count;
          cur.append(n);
        }
        cur.classList.remove("hidden");
      } else {
        cur.classList.add("hidden");
      }
    };
    renderCursor();
    p.onmousemove = (e) => {
      cur.style.left = e.clientX + 12 + "px";
      cur.style.top = e.clientY + 12 + "px";
    };
  }

  /** one-click crafting straight from inventory + backpack */
  craftFromInventory(player, rec) {
    if (rec.shapeless) {
      const need = rec.in.map((x) => x.slice());
      for (const s of player.inv.allSlots()) {
        for (const n of need) {
          if (s.id === n[0] && n[1] > 0) {
            const t = Math.min(s.count, n[1]);
            s.count -= t;
            n[1] -= t;
            if (!s.count) s.id = 0;
          }
        }
      }
      if (need.some((n) => n[1] > 0)) return;
    } else {
      const need = {};
      for (const ch of rec.shape.join("")) {
        const id = rec.keys[ch];
        if (id) need[id] = (need[id] || 0) + 1;
      }
      const counts = player.inv.counts();
      for (const [id, n] of Object.entries(need)) if ((counts.get(+id) || 0) < n) return;
      for (const [id, n] of Object.entries(need)) player.inv.take(+id, n);
    }
    player.inv.add(rec.out[0], rec.out[1]);
    this.paintHotbar(player.inv);
  }

  takeCraft(player, rec, grid) {
    if (rec.shapeless) {
      const need = rec.in.map((x) => x.slice());
      for (const s of player.inv.craft) {
        for (const n of need) {
          if (s.id === n[0] && n[1] > 0) {
            const t = Math.min(s.count, n[1]);
            s.count -= t;
            n[1] -= t;
            if (!s.count) s.id = 0;
          }
        }
      }
    } else {
      for (const s of player.inv.craft) {
        if (s.id) {
          s.count -= 1;
          if (s.count <= 0) {
            s.id = 0;
            s.count = 0;
          }
        }
      }
    }
    player.inv.add(rec.out[0], rec.out[1]);
  }

  slotEl(s, player, frozen, onChange) {
    const el = document.createElement("div");
    el.className = "slot ui";
    if (s && s.id) {
      el.append(this.icon(s.id).cloneNode(true));
      if (s.count > 1) {
        const n = document.createElement("div");
        n.className = "n";
        n.textContent = s.count;
        el.append(n);
      }
    }
    if (!frozen) {
      el.onmousedown = (ev) => {
        ev.preventDefault();
        player.inv.clickSlot(s, ev.button === 2);
        if (onChange) onChange();
        else this.renderInv(player);
        this.paintHotbar(player.inv);
      };
      el.oncontextmenu = (e) => e.preventDefault();
    }
    return el;
  }

  closeInv() {
    this.invOpen = false;
    this.root.querySelector("#invpanel").classList.add("hidden");
  }

  openCreative(player) {
    this.creativeOpen = true;
    this._lastCreativePlayer = player;
    const p = this.root.querySelector("#creative");
    p.classList.remove("hidden");
    const mods = installedMods();
    const items = allItems()
      .filter((d) => d.id && d.name !== "air" && d.id !== 68 && d.id !== 69 && (!d.mod || mods.has(d.mod)))
      .sort((a, b) => a.name.localeCompare(b.name));
    p.innerHTML = `<h2>Item selector</h2><div class="filter-bar-wrap">${this.filterBar(this.itemFilter, "creative")}</div><input class="search" id="q" placeholder="Search items..." /><div class="grid inv" id="cg" style="max-height:360px;overflow:auto"></div>`;
    const draw = (q) => {
      const g = p.querySelector("#cg");
      g.innerHTML = "";
      const query = this.normalizeSearch(q);
      const activeFilter = this.itemFilter || "all";
      const matches = items
        .map((d) => ({ d, score: this.scoreSearchEntry(d.name, query), category: this.itemCategory(d) }))
        .filter(({ score, category }) => {
          const filterOk = activeFilter === "all" || activeFilter === "craftable"
            ? true
            : category === activeFilter;
          return score.matches && filterOk;
        })
        .sort((a, b) => b.score.score - a.score.score || a.d.name.localeCompare(b.d.name));

      if (!matches.length) {
        g.innerHTML = `<div class="nores">No items found${query ? ` for “${q.trim()}”` : ""}</div>`;
        return;
      }

      matches.forEach(({ d }) => {
        const el = this.slotEl({ id: d.id, count: 1 }, player, true);
        el.title = d.name;
        el.onclick = () => {
          player.inv.giveCreative(d.id);
          this.paintHotbar(player.inv);
          this.toast(d.name);
        };
        g.append(el);
      });
    };
    p.querySelector("#q").oninput = (e) => draw(e.target.value);
    draw("");
  }

  closeCreative() {
    this.creativeOpen = false;
    this.root.querySelector("#creative").classList.add("hidden");
  }

  setPause(v) {
    this.pause = v;
    const el = this.root.querySelector("#pause");
    el.classList.toggle("hidden", !v);
    el.hidden = !v;
  }

  setDead(v) {
    this.root.querySelector("#dead").classList.toggle("hidden", !v);
  }
}
