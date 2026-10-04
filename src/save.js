const DB_NAME = "mincraft0101";
const STORE = "worlds";

/** Wipe all legacy save data from previous versions (old database name). */
export function wipeLegacySaves() {
  if (!globalThis.indexedDB) return;
  try {
    const req = indexedDB.deleteDatabase("freecraft");
    req.onsuccess = () => console.info("[mincraft] old save data deleted");
    req.onerror = () => {};
    req.onblocked = () => {};
  } catch {}
}

function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listSaves() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result || []).sort((a, b) => (b.updated || 0) - (a.updated || 0));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function loadSave(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function writeSave(data) {
  const db = await openDb();
  data.updated = Date.now();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(data);
    req.onsuccess = () => resolve(data);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSave(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function newSaveId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `w_${globalThis.crypto.randomUUID()}`;
  }
  return "w_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function packSlots(slots = []) {
  if (!Array.isArray(slots)) return [];
  return slots.map((s) => {
    if (!s || typeof s !== "object") return [0, 0];
    const id = Number(s.id);
    const count = Number(s.count);
    return [Number.isFinite(id) && id > 0 ? Math.floor(id) : 0, Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0)];
  });
}

export function unpackSlots(arr, fallback = []) {
  if (!Array.isArray(arr)) return Array.isArray(fallback) ? fallback : [];
  return arr.map(([id, count]) => {
    const slotId = Number(id);
    const slotCount = Number(count);
    return {
      id: Number.isFinite(slotId) && slotId > 0 ? Math.floor(slotId) : 0,
      count: Math.max(0, Number.isFinite(slotCount) ? Math.floor(slotCount) : 0),
    };
  });
}
