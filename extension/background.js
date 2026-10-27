// Background service worker (MV3).
// Connects to the local relay server as a WebSocket client and forwards
// commands to the content script running in the tab the remote controls.
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

// The tab the remote controls. Set the first time a tab reports a <video>
// while it's the focused tab, then kept sticky even if the user switches to
// another tab afterward - otherwise the remote would silently follow
// whatever tab happens to be focused, which is what broke control on tab
// switch and made the page seem unresponsive until clicked.
let targetTabId = null;

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
    await forwardCommandToTargetTab(msg);
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

async function pickTargetTab() {
  if (targetTabId != null) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      if (tab) return tab.id;
    } catch {
      targetTabId = null;
    }
  }
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return activeTab?.id ?? null;
}

async function forwardCommandToTargetTab(command) {
  const tabId = await pickTargetTab();
  if (tabId == null) return;

  try {
    await chrome.tabs.sendMessage(tabId, { source: "vrc-background", command });
  } catch (err) {
    console.warn("[VRC] Could not deliver command to tab (no content script?)", err);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === targetTabId) targetTabId = null;
});

// Kick off on install/startup, and periodically check via alarm in case the
// service worker was suspended and the socket silently dropped.
chrome.runtime.onInstalled.addListener(ensureConnection);
chrome.runtime.onStartup.addListener(ensureConnection);
chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM) ensureConnection();
});

// Let the popup query connection status; relay status reports from content
// scripts up to the server so the phone app can display them, and use them
// to pick/confirm which tab is the controlled one.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "vrc-get-status") {
    sendResponse({ connected });
    return;
  }

  if (msg?.source === "vrc-content" && sender?.tab?.id != null) {
    const tabId = sender.tab.id;
    if (msg.hasVideo) {
      if (targetTabId == null) {
        targetTabId = tabId;
      } else {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([activeTab]) => {
          if (activeTab && activeTab.id === tabId) targetTabId = tabId;
        });
      }
    }
    if (msg.status && tabId === targetTabId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "status", ...msg.status }));
    }
  }
});

ensureConnection();
