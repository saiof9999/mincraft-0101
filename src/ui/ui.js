import { DEFS, def, allItems } from "../core/blocks.js";
import { CRAFTS, findCraft, canCraft } from "../core/recipes.js";
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
    this.build();
  }

  icon(id) {
    if (!this.icons.has(id)) this.icons.set(id, iconCanvas(id, this.atlas));
    return this.icons.get(id);
  }

  build() {
    this.root.innerHTML = `
      <div id="menu" class="screen menu">
        <div class="logo">FREE CRAFT</div>
        <div class="splash" id="splash"></div>
        <div class="btn-col">
          <button class="mc" data-start="survival">Survival</button>
          <button class="mc" data-start="creative">Creative</button>
          <div class="row">
            <input class="mc" id="seed" placeholder="Seed (optional)" />
          </div>
        </div>
        <div class="hint">
          WASD move · Space jump · Shift sneak · Ctrl sprint<br/>
          Mouse look · F5 camera · E inventory · 1-9 hotbar · Q drop<br/>
          Left break/attack · Right place/use · C creative items · Esc pause
        </div>
      </div>
      <div id="hud" class="hidden">
        <div id="crosshair"></div>
        <div id="bars">
          <div class="pips" id="hearts"></div>
          <div class="pips" id="hunger"></div>
        </div>
        <div id="xp"><i></i></div>
        <div id="hotbar"></div>
        <div id="debug"></div>
        <div id="chat"></div>
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
    const h = this.root.querySelector("#hearts");
    const u = this.root.querySelector("#hunger");
    h.innerHTML = "";
    u.innerHTML = "";
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
    this.renderInv(player);
  }

  renderInv(player) {
    const p = this.root.querySelector("#invpanel");
    p.classList.remove("hidden");
    const recs = CRAFTS.filter((r) => player.mode === "creative" || canCraft(player.inv.counts(), r));
    p.innerHTML = `
      <h2>${this.table ? "Crafting table" : "Inventory"} ${player.mode === "survival" ? "· Recipe book" : ""}</h2>
      <div class="inv-wrap">
        <div>
          <div class="grid craft" id="craftg"></div>
          <div style="margin:8px 0;text-align:center">→ <span id="cout" class="slot ui" style="display:inline-block"></span></div>
          <div class="grid inv" id="invm"></div>
        </div>
        <div style="${player.mode === "survival" ? "" : "display:none"}">
          <h2>Recipes</h2>
          <div class="grid book" id="book"></div>
        </div>
      </div>
    `;
    const craftSlots = this.table ? player.inv.craft : player.inv.craft.slice(0, 4);
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
      out.onclick = () => {
        this.takeCraft(player, rec, matchGrid);
        this.renderInv(player);
      };
    }
    const invm = p.querySelector("#invm");
    [...player.inv.main, ...player.inv.hotbar].forEach((s) => invm.append(this.slotEl(s, player)));
    const book = p.querySelector("#book");
    if (book) {
      recs.forEach((r) => {
        const el = this.slotEl({ id: r.out[0], count: r.out[1] }, player, true);
        el.title = def(r.out[0]).name;
        el.onclick = () => {
          this.toast(def(r.out[0]).name);
        };
        book.append(el);
      });
    }
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
    const p = this.root.querySelector("#creative");
    p.classList.remove("hidden");
    const items = allItems().filter((d) => d.id && d.name !== "air" && d.id !== 68 && d.id !== 69);
    p.innerHTML = `<h2>Item selector</h2><input class="search" id="q" placeholder="Search..." /><div class="grid inv" id="cg" style="max-height:360px;overflow:auto"></div>`;
    const draw = (q) => {
      const g = p.querySelector("#cg");
      g.innerHTML = "";
      items
        .filter((d) => d.name.includes(q.toLowerCase()))
        .forEach((d) => {
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
