/**
 * Rekolto Browser Relay — Chrome Extension Service Worker (MV3)
 *
 * Connects to the local WebSocket server and handles fetch commands by
 * opening a tab, attaching the debugger, grabbing the rendered HTML,
 * and returning it through the WebSocket.
 *
 * Uses chrome.alarms to keep the service worker alive (MV3 kills idle
 * service workers after ~30 seconds).
 */

const WS_URL = "ws://localhost:9333";
const RECONNECT_INTERVAL_MS = 5000;
const KEEPALIVE_ALARM = "rekolto-keepalive";

let ws = null;
let connected = false;

// --- Keep-alive: MV3 service workers die after ~30s of inactivity ---

chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 }); // ~24 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    // Ping to keep alive; reconnect if needed
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connect();
    }
  }
});

// --- WebSocket lifecycle ---

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  // Clean up previous socket
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    console.error("[Rekolto] WebSocket creation failed:", err);
    return;
  }

  ws.onopen = () => {
    connected = true;
    console.log("[Rekolto] Connected to relay server");
  };

  ws.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      console.error("[Rekolto] Failed to parse message:", event.data);
      return;
    }

    if (msg.action === "fetch" && msg.url) {
      try {
        const result = await fetchPage(msg.url);
        send({ id: msg.id, html: result.html, title: result.title });
      } catch (err) {
        send({ id: msg.id, error: String(err) });
      }
    }
  };

  ws.onerror = (err) => {
    console.error("[Rekolto] WebSocket error:", err);
  };

  ws.onclose = () => {
    connected = false;
    ws = null;
    console.log("[Rekolto] Disconnected from relay server");
  };
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// --- Page fetching via chrome.debugger ---

async function fetchPage(url) {
  // Create a new tab (not active so it stays in the background)
  const tab = await chrome.tabs.create({ url, active: false });
  const tabId = tab.id;

  try {
    // Wait for the page to finish loading
    await waitForTabLoad(tabId);

    // Attach debugger
    await chrome.debugger.attach({ tabId }, "1.3");

    // Get the outer HTML of the document
    const result = await chrome.debugger.sendCommand(
      { tabId },
      "Runtime.evaluate",
      { expression: "document.documentElement.outerHTML", returnByValue: true }
    );

    const html = result?.result?.value ?? "";

    // Get the page title
    const titleResult = await chrome.debugger.sendCommand(
      { tabId },
      "Runtime.evaluate",
      { expression: "document.title", returnByValue: true }
    );

    const title = titleResult?.result?.value ?? undefined;

    // Detach debugger
    await chrome.debugger.detach({ tabId });

    return { html, title };
  } finally {
    // Always close the tab
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      // Tab may already be closed
    }
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, 20000);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        // Give the page a moment to finish JS rendering
        setTimeout(resolve, 1500);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "status") {
    sendResponse({ connected });
    return false; // synchronous response
  }
});

// Start connecting on extension load
connect();
