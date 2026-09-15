export class NetClient {
  constructor(url, name) {
    this.url = url;
    this.name = name || "Crafty";
    this.ws = null;
    this.id = null;
    this.seed = null;
    this.handlers = {};
    this.ready = false;
  }

  on(type, fn) {
    this.handlers[type] = fn;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const t = setTimeout(() => reject(new Error("Server timed out")), 8000);
      ws.onopen = () => {
        this.send({ t: "join", name: this.name });
      };
      ws.onerror = () => {
        clearTimeout(t);
        reject(new Error("Could not reach " + this.url));
      };
      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.t === "welcome") {
          clearTimeout(t);
          this.id = msg.id;
          this.seed = msg.seed;
          this.ready = true;
          resolve(msg);
        }
        this.handlers[msg.t]?.(msg);
        this.handlers.any?.(msg);
      };
      ws.onclose = () => {
        this.ready = false;
        this.handlers.close?.();
      };
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}
