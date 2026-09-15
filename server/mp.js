/** Shared Free Craft multiplayer world (Node WebSocketServer). */

export function attachMultiplayer(wss) {
  let seed = (Math.random() * 1e9) | 0;
  /** @type {Map<string, {ws: import('ws').WebSocket, name: string, x:number, y:number, z:number, yaw:number, pitch:number, dim:string}>} */
  const players = new Map();
  /** @type {Record<string, Record<string, number>>} */
  const edits = { overworld: {}, nether: {}, end: {} };
  let nextId = 1;

  function send(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function broadcast(msg, except) {
    const raw = JSON.stringify(msg);
    for (const p of players.values()) {
      if (p.ws !== except && p.ws.readyState === 1) p.ws.send(raw);
    }
  }

  function roster() {
    return [...players.entries()].map(([id, p]) => ({
      id,
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      dim: p.dim,
    }));
  }

  wss.on("connection", (ws) => {
    const id = String(nextId++);
    ws.on("message", (buf) => {
      let msg;
      try {
        msg = JSON.parse(String(buf));
      } catch {
        return;
      }
      if (msg.t === "join") {
        const name = String(msg.name || "Crafty").slice(0, 16);
        players.set(id, {
          ws,
          name,
          x: 0.5,
          y: 50,
          z: 0.5,
          yaw: 0,
          pitch: 0,
          dim: "overworld",
        });
        send(ws, { t: "welcome", id, seed, players: roster(), edits });
        broadcast({ t: "join", id, name }, ws);
        broadcast({ t: "chat", from: "Server", text: `${name} joined.` });
        return;
      }
      const p = players.get(id);
      if (!p) return;
      if (msg.t === "pos") {
        p.x = +msg.x || 0;
        p.y = +msg.y || 0;
        p.z = +msg.z || 0;
        p.yaw = +msg.yaw || 0;
        p.pitch = +msg.pitch || 0;
        p.dim = msg.dim || p.dim;
        broadcast({ t: "pos", id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, dim: p.dim }, ws);
      } else if (msg.t === "block") {
        const dim = msg.dim || "overworld";
        if (!edits[dim]) edits[dim] = {};
        const key = `${msg.x | 0},${msg.y | 0},${msg.z | 0}`;
        edits[dim][key] = msg.id | 0;
        broadcast({ t: "block", dim, x: msg.x | 0, y: msg.y | 0, z: msg.z | 0, block: msg.id | 0 }, ws);
      } else if (msg.t === "chat") {
        const text = String(msg.text || "").slice(0, 120);
        if (text) broadcast({ t: "chat", from: p.name, text });
      }
    });
    ws.on("close", () => {
      const p = players.get(id);
      players.delete(id);
      if (p) broadcast({ t: "leave", id, name: p.name });
    });
  });

  return { players, getSeed: () => seed };
}
