import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./server.mjs";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
let window;
let gateway;

async function createWindow() {
  process.env.ORBIT_ROOT = appRoot;
  gateway = await startServer();
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: "#07101d",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await window.loadFile(join(appRoot, "dist", "index.html"));
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => { window = null; });
}

app.whenReady().then(createWindow).catch((error) => {
  console.error("Orbit failed to start:", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (gateway) gateway.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!window) createWindow();
});
