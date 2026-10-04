import { defineConfig } from "vite";
import { spawn } from "node:child_process";

let mpProc = null;

// starts the multiplayer WebSocket server automatically with `npm run dev`
function multiplayerPlugin() {
  return {
    name: "auto-multiplayer-server",
    configureServer() {
      if (mpProc) return;
      mpProc = spawn(process.execPath, ["server/index.js"], {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      });
      mpProc.on("error", () => (mpProc = null));
      mpProc.on("exit", () => (mpProc = null));
      console.log("[vite] multiplayer server auto-starting on ws://localhost:8081/mp");
    },
    buildEnd() {
      try {
        mpProc?.kill();
      } catch {}
      mpProc = null;
    },
  };
}

export default defineConfig({
  server: { port: 5173, host: true, open: true },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks: {
          "three-vendor": ["three"],
        },
      },
    },
  },
  plugins: [multiplayerPlugin()],
});
