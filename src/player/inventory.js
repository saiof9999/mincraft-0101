export function emptySlot() {
  return { id: 0, count: 0 };
}

export class Inventory {
  constructor() {
    this.hotbar = Array.from({ length: 9 }, emptySlot);
    this.main = Array.from({ length: 27 }, emptySlot);
    this.craft = Array.from({ length: 9 }, emptySlot);
    this.craftOut = emptySlot();
    this.armor = Array.from({ length: 4 }, emptySlot);
    this.selected = 0;
    this.cursor = emptySlot();
  }

  allSlots() {
    return [...this.hotbar, ...this.main];
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
    if (!id || n <= 0) return n;
    const stack = 64;
    for (const s of this.allSlots()) {
      if (s.id === id && s.count < stack) {
        const t = Math.min(stack - s.count, n);
        s.count += t;
        n -= t;
        if (!n) return 0;
      }
    }
    for (const s of this.allSlots()) {
      if (!s.id) {
        const t = Math.min(stack, n);
        s.id = id;
        s.count = t;
        n -= t;
        if (!n) return 0;
      }
    }
    return n;
  }

  take(id, n) {
    for (const s of this.allSlots()) {
      if (s.id === id) {
        const t = Math.min(s.count, n);
        s.count -= t;
        n -= t;
        if (!s.count) s.id = 0;
        if (!n) return true;
      }
    }
    return n <= 0;
  }

  consumeHeld(n = 1) {
    const s = this.held();
    if (!s.id) return;
    s.count -= n;
    if (s.count <= 0) {
      s.id = 0;
      s.count = 0;
    }
  }

  clickSlot(slot, right) {
    const c = this.cursor;
    if (right) {
      if (!c.id && slot.id) {
        const half = Math.ceil(slot.count / 2);
        c.id = slot.id;
        c.count = half;
        slot.count -= half;
        if (!slot.count) slot.id = 0;
      } else if (c.id && (!slot.id || slot.id === c.id)) {
        slot.id = c.id;
        slot.count += 1;
        c.count -= 1;
        if (!c.count) c.id = 0;
      }
      return;
    }
    if (!c.id) {
      this.cursor = { ...slot };
      slot.id = 0;
      slot.count = 0;
    } else if (!slot.id) {
      slot.id = c.id;
      slot.count = c.count;
      c.id = 0;
      c.count = 0;
    } else if (slot.id === c.id) {
      const t = Math.min(64 - slot.count, c.count);
      slot.count += t;
      c.count -= t;
      if (!c.count) c.id = 0;
    } else {
      const tmp = { ...slot };
      slot.id = c.id;
      slot.count = c.count;
      this.cursor = tmp;
    }
  }

  giveCreative(id) {
    this.hotbar[this.selected] = { id, count: 64 };
  }
}
