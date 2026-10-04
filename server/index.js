import { createServer } from "http";
import { WebSocketServer } from "ws";
import { attachMultiplayer } from "./mp.js";

const port = Number(process.env.PORT || 8081);
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Mincraft 0101 server. Connect the game to ws://HOST:" + port + "/mp\n");
});
const wss = new WebSocketServer({ server, path: "/mp" });
attachMultiplayer(wss);

function handlePortError(err) {
  if (err.code === "EADDRINUSE") {
    console.log(`[mp] multiplayer server already running on port ${port} - reusing it`);
    return;
  }
  throw err;
}

server.on("error", handlePortError);
wss.on("error", handlePortError);

server.listen(port, "0.0.0.0", () => {
  console.log(`Mincraft 0101 multiplayer on ws://0.0.0.0:${port}/mp`);
});
