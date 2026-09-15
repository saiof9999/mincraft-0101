import { createServer } from "http";
import { WebSocketServer } from "ws";
import { attachMultiplayer } from "./mp.js";

const port = Number(process.env.PORT || 8081);
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Free Craft server. Connect the game to ws://HOST:" + port + "/mp\n");
});
const wss = new WebSocketServer({ server, path: "/mp" });
attachMultiplayer(wss);
server.listen(port, "0.0.0.0", () => {
  console.log("Free Craft multiplayer on ws://0.0.0.0:" + port + "/mp");
});
