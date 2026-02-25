/**
 * Popup script — polls the service worker to display connection status.
 */

async function updateStatus() {
  const dot = document.getElementById("dot");
  const label = document.getElementById("label");

  try {
    // Send a message to the background service worker to ask for status
    const response = await chrome.runtime.sendMessage({ type: "status" });
    if (response && response.connected) {
      dot.className = "dot connected";
      label.textContent = "Connected";
    } else {
      dot.className = "dot disconnected";
      label.textContent = "Disconnected";
    }
  } catch {
    dot.className = "dot disconnected";
    label.textContent = "Disconnected";
  }
}

// Update immediately and refresh every 2 seconds while popup is open
updateStatus();
setInterval(updateStatus, 2000);
