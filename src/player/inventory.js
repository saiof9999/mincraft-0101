import { DEFS } from "../core/blocks.js";

export function emptySlot() {
  return { id: 0, count: 0 };
}

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeSlot(slot) {
  if (!slot || typeof slot !== "object") return emptySlot();
  const id = Number(slot.id);
  slot.id = Number.isFinite(id) && id > 0 ? Math.floor(id) : 0;
  slot.count = clampCount(slot.count);
  return slot;
}

function stackLimit(id) {
  const d = DEFS[id];
  if (!d) return 64;
  const n = Number(d.stack);
  return Number.isFinite(n) && n > 0 ? n : 64;
}

export class Inventory {
  constructor() {
    this.hotbar = Array.from({ length: 9 }, emptySlot);
    this.main = Array.from({ length: 27 }, emptySlot);
    this.craft = Array.from({ length: 9 }, emptySlot);
    this.craftOut = emptySlot();
    this.armor = Array.from({ length: 4 }, emptySlot);
    this.extra = []; // backpack slots (mods)
    this.selected = 0;
    this.cursor = emptySlot();
  }

  allSlots() {
    return [...this.hotbar, ...this.main, ...this.extra];
  }

  held() {
    return this.hotbar[this.selected];
  }

  counts() {
    const m = new Map();
    for (const s of this.allSlots()) {
      if (s.id) m.set(s.id, (m.get(s.id) || 0) + s.count);
    }
    return m;
  }

  add(id, n = 1) {
    const itemId = Number(id);
    const count = clampCount(n);
    if (!Number.isFinite(itemId) || itemId <= 0 || count <= 0) return count;
    const stack = stackLimit(itemId);
    let remaining = count;
    for (const s of this.allSlots()) {
      const slot = normalizeSlot(s);
      if (slot.id === itemId && slot.count < stack) {
        const t = Math.min(stack - slot.count, remaining);
        slot.count += t;
        remaining -= t;
        if (!remaining) return 0;
      }
    }
    for (const s of this.allSlots()) {
      const slot = normalizeSlot(s);
      if (!slot.id) {
        const t = Math.min(stack, remaining);
        slot.id = itemId;
        slot.count = t;
        remaining -= t;
        if (!remaining) return 0;
      }
    }
    return remaining;
  }

  take(id, n) {
    const itemId = Number(id);
    const count = clampCount(n);
    if (!Number.isFinite(itemId) || itemId <= 0 || count <= 0) return false;
    let remaining = count;
    for (const s of this.allSlots()) {
      const slot = normalizeSlot(s);
      if (slot.id === itemId) {
        const t = Math.min(slot.count, remaining);
        slot.count -= t;
        remaining -= t;
        if (!slot.count) slot.id = 0;
        if (!remaining) return true;
      }
    }
    return remaining <= 0;
  }

  consumeHeld(n = 1) {
    const s = this.held();
    if (!s.id) return;
    s.count = clampCount(s.count - clampCount(n));
    if (s.count <= 0) {
      s.id = 0;
      s.count = 0;
    }
  }

  clickSlot(slot, right) {
    const target = normalizeSlot(slot);
    const c = normalizeSlot(this.cursor);
    if (right) {
      if (!c.id && target.id) {
        const half = Math.ceil(target.count / 2);
        c.id = target.id;
        c.count = half;
        target.count -= half;
        if (!target.count) target.id = 0;
        this.cursor = c;
      } else if (c.id && (!target.id || target.id === c.id)) {
        const stack = stackLimit(c.id);
        const take = Math.min(1, c.count, Math.max(0, stack - (target.count || 0)));
        if (take <= 0) return;
        if (!target.id) target.id = c.id;
        target.count += take;
        c.count -= take;
        if (!c.count) c.id = 0;
        this.cursor = c;
      }
      return;
    }
    if (!c.id) {
      this.cursor = { ...target };
      target.id = 0;
      target.count = 0;
    } else if (!target.id) {
      const part = Math.min(c.count, stackLimit(c.id));
      target.id = c.id;
      target.count = part;
      c.count -= part;
      if (!c.count) c.id = 0;
      this.cursor = c;
    } else if (target.id === c.id) {
      const limit = stackLimit(target.id);
      const t = Math.min(limit - target.count, c.count);
      target.count += t;
      c.count -= t;
      if (!c.count) c.id = 0;
      this.cursor = c;
    } else {
      const tmp = { ...target };
      const limit = stackLimit(c.id);
      const moved = Math.min(c.count, limit);
      target.id = c.id;
      target.count = moved;
      c.count -= moved;
      if (c.count > 0) {
        this.cursor = { id: c.id, count: c.count };
      } else {
        this.cursor = tmp;
        c.id = 0;
        c.count = 0;
      }
    }
    normalizeSlot(this.cursor);
    normalizeSlot(target);
  }

  giveCreative(id) {
    this.hotbar[this.selected] = { id, count: stackLimit(id) };
  }
}
