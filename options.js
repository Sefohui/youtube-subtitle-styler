/**
 * YT Subtitle Styler — options page script
 * Import / Export only.
 */

// Chrome/Firefox compatibility polyfill
if (typeof browser === "undefined") var browser = chrome;

const DEFAULTS = {
  fontSize: 20,
  fontFamily: "Arial",
  color: "#ffffff",
  fontOpacity: 100,
  bgColor: "#000000",
  bgOpacity: 75,
  bold: false,
  italic: false,
  shadow: true,
  dropShadow: false,
  dropShadowStrength: 50,
  enabled: true,
};

function get(id) { return document.getElementById(id); }

function showStatus(msg, isError = false) {
  const status = get("status");
  status.textContent = msg;
  status.className = "status " + (isError ? "error" : "saved");
  setTimeout(() => {
    status.textContent = "";
    status.className = "status";
  }, 2000);
}

function broadcastSettings(settings) {
  browser.tabs.query({ url: "*://*.youtube.com/*" }).then((tabs) => {
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, {
        type: "settingsUpdated",
        settings,
      }).catch(() => {});
    }
  });
}

// Export current settings to a JSON file
get("exportBtn").addEventListener("click", () => {
  browser.storage.local.get("settings").then((result) => {
    const settings = { ...DEFAULTS, ...result.settings };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yt-subtitle-styler-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }).catch(() => showStatus("Failed to read settings.", true));
});

// Import settings from a JSON file
get("importBtn").addEventListener("click", () => get("importFile").click());

get("importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      const merged = { ...DEFAULTS, ...imported };
      browser.storage.local.set({ settings: merged }).then(() => {
        broadcastSettings(merged);
        showStatus("Settings imported!");
      });
    } catch {
      showStatus("Invalid file.", true);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});
