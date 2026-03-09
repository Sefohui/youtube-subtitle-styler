/**
 * YT Subtitle Styler — background script
 * Forwards settings changes to all active YouTube tabs.
 */

// Chrome/Firefox compatibility polyfill
if (typeof browser === "undefined") var browser = chrome;

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.settings) return;

  browser.tabs.query({ url: "*://*.youtube.com/*" }).then((tabs) => {
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, {
        type: "settingsUpdated",
        settings: changes.settings.newValue,
      }).catch(() => {
        // Silently ignore if the content script is not yet injected
      });
    }
  });
});
