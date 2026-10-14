// Background service worker (MV3).
// Connects to the local relay server as a WebSocket client and forwards
// commands to the content script running in the active tab.
//
// NOTE: MV3 service workers are not persistent - the OS/browser can kill them
// after ~30s of inactivity. The socket keeps the worker alive while open, but
// if it's ever killed, `ensureConnection()` re-runs on the next event
// (alarm, message, tab update) and reconnects. This is a known Faz 1
// limitation; a persistent background page is not available under MV3.

const SERVER_URL = "ws://localhost:8787";
const RECONNECT_ALARM = "vrc-reconnect";

let socket = null;
let connected = false;

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function ensureConnection() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(SERVER_URL);

  socket.addEventListener("open", () => {
    connected = true;
    setBadge("ON", "#2e7d32");
    socket.send(JSON.stringify({ role: "extension", type: "hello" }));
  });

  socket.addEventListener("message", async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (err) {
      console.warn("[VRC] Invalid message from server:", event.data);
      return;
    }
    await forwardCommandToActiveTab(msg);
  });

  socket.addEventListener("close", () => {
    connected = false;
    setBadge("OFF", "#c62828");
  });

  socket.addEventListener("error", () => {
    connected = false;
    setBadge("ERR", "#c62828");
  });
}

async function forwardCommandToActiveTab(command) {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab || !activeTab.id) return;

  try {
    await chrome.tabs.sendMessage(activeTab.id, { source: "vrc-background", command });
  } catch (err) {
    console.warn("[VRC] Could not deliver command to tab (no content script?)", err);
  }
}

// Kick off on install/startup, and periodically check via alarm in case the
// service worker was suspended and the socket silently dropped.
chrome.runtime.onInstalled.addListener(ensureConnection);
chrome.runtime.onStartup.addListener(ensureConnection);
chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM) ensureConnection();
});

// Let the popup query connection status.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "vrc-get-status") {
    sendResponse({ connected });
  }
});

ensureConnection();
