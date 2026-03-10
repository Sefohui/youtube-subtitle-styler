/**
 * YT Subtitle Styler — popup script
 * Minimal popup: just the enable toggle and a link to the full settings page.
 */

// Chrome/Firefox compatibility polyfill
if (typeof browser === "undefined") var browser = chrome;

function get(id) { return document.getElementById(id); }

function applyEnabled(enabled) {
  browser.storage.local.get("settings").then((result) => {
    const settings = { ...result.settings, enabled };
    browser.storage.local.set({ settings }).then(() => {
      browser.tabs.query({ url: "*://*.youtube.com/*" }).then((tabs) => {
        for (const tab of tabs) {
          browser.tabs.sendMessage(tab.id, {
            type: "settingsUpdated",
            settings,
          }).catch(() => {});
        }
      });
    });
  });
}

// Load current enabled state
browser.storage.local.get("settings").then((result) => {
  get("enabled").checked = result.settings?.enabled ?? true;
}).catch(() => {});

// Toggle enabled instantly without opening settings
get("enabled").addEventListener("change", () => {
  applyEnabled(get("enabled").checked);
});

// Open the full settings page in a new tab
get("openSettings").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});
