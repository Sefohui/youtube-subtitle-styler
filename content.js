/**
 * YT Subtitle Styler — content script
 * Injects and enforces custom styles on YouTube subtitle elements.
 */

// Chrome/Firefox compatibility polyfill
if (typeof browser === "undefined") var browser = chrome;

const STYLE_ID = "yt-subtitle-styler-styles";

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
  enabled: true,
};

let currentSettings = { ...DEFAULTS };

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function buildCSS(s) {
  if (!s.enabled) return "";

  const fg = hexToRgb(s.color);
  const bg = hexToRgb(s.bgColor);
  const fgAlpha = s.fontOpacity / 100;
  const bgAlpha = s.bgOpacity / 100;
  const shadows = [];
  if (s.shadow) shadows.push("1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000");
  if (s.dropShadow) shadows.push("3px 4px 8px rgba(0,0,0,0.9)");
  const textShadow = shadows.length
    ? `text-shadow: ${shadows.join(", ")} !important;`
    : "text-shadow: none !important;";

  return `
    /* YT Subtitle Styler */
    .ytp-caption-segment,
    .captions-text .captions-text-span,
    span.ytp-caption-segment {
      font-size: ${s.fontSize}px !important;
      font-family: ${s.fontFamily}, sans-serif !important;
      color: rgba(${fg.r}, ${fg.g}, ${fg.b}, ${fgAlpha}) !important;
      background-color: rgba(${bg.r}, ${bg.g}, ${bg.b}, ${bgAlpha}) !important;
      font-weight: ${s.bold ? "bold" : "normal"} !important;
      font-style: ${s.italic ? "italic" : "normal"} !important;
      line-height: 1.4 !important;
      padding: 2px 6px !important;
      border-radius: 2px !important;
      ${textShadow}
    }

    .ytp-caption-window-container .caption-window,
    .ytp-caption-window-top,
    .ytp-caption-window-bottom {
      background: transparent !important;
    }
  `;
}

function injectStyles(css) {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function applySettings(settings) {
  currentSettings = { ...DEFAULTS, ...settings };
  const css = buildCSS(currentSettings);
  if (css) {
    injectStyles(css);
  } else {
    const el = document.getElementById(STYLE_ID);
    if (el) el.textContent = "";
  }
}

// Listen for storage changes from the popup
browser.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    applySettings(changes.settings.newValue);
  }
});

// Listen for direct messages from the background script
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "settingsUpdated") {
    applySettings(msg.settings);
  }
});

// Re-inject styles if YouTube removes our style tag
const observer = new MutationObserver(() => {
  if (!document.getElementById(STYLE_ID)) {
    const css = buildCSS(currentSettings);
    if (css && currentSettings.enabled) {
      injectStyles(css);
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// Load saved settings and apply immediately
browser.storage.local.get("settings").then((result) => {
  applySettings(result.settings || DEFAULTS);
});
