/**
 * YT Subtitle Styler — popup script
 * Full settings UI with live preview.
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
  enabled: true,
};

const YT_COLORS = [
  { hex: "#ffffff", name: "White" },
  { hex: "#ffff00", name: "Yellow" },
  { hex: "#00ff00", name: "Green" },
  { hex: "#00ffff", name: "Cyan" },
  { hex: "#0000ff", name: "Blue" },
  { hex: "#ff00ff", name: "Magenta" },
  { hex: "#ff0000", name: "Red" },
  { hex: "#000000", name: "Black" },
];

let selectedColor = DEFAULTS.color;
let selectedBgColor = DEFAULTS.bgColor;

function get(id) { return document.getElementById(id); }

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function buildSwatches(containerId, currentHex, onChange) {
  const container = get(containerId);
  container.innerHTML = "";
  for (const c of YT_COLORS) {
    const swatch = document.createElement("div");
    swatch.className = "swatch" + (c.hex === currentHex ? " selected" : "");
    swatch.style.backgroundColor = c.hex;
    swatch.title = c.name;
    if (c.hex === "#000000") swatch.style.outline = "1px solid #444";
    swatch.addEventListener("click", () => {
      container.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
      swatch.classList.add("selected");
      onChange(c.hex);
      onInput();
    });
    container.appendChild(swatch);
  }
}

function updatePreview(s) {
  const preview = get("preview-text");
  const fg = hexToRgb(s.color);
  const bg = hexToRgb(s.bgColor);
  preview.style.fontSize = s.fontSize + "px";
  preview.style.fontFamily = s.fontFamily + ", sans-serif";
  preview.style.color = `rgba(${fg.r}, ${fg.g}, ${fg.b}, ${s.fontOpacity / 100})`;
  preview.style.backgroundColor = `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${s.bgOpacity / 100})`;
  preview.style.fontWeight = s.bold ? "bold" : "normal";
  preview.style.fontStyle = s.italic ? "italic" : "normal";
  const shadows = [];
  if (s.shadow) shadows.push("1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000");
  if (s.dropShadow) shadows.push("3px 4px 8px rgba(0,0,0,0.9)");
  preview.style.textShadow = shadows.length ? shadows.join(", ") : "none";
  preview.style.opacity = s.enabled ? "1" : "0.4";
}

function readForm() {
  return {
    enabled: get("enabled").checked,
    fontSize: parseInt(get("fontSize").value),
    fontFamily: get("fontFamily").value,
    color: selectedColor,
    fontOpacity: parseInt(get("fontOpacity").value),
    bgColor: selectedBgColor,
    bgOpacity: parseInt(get("bgOpacity").value),
    bold: get("bold").checked,
    italic: get("italic").checked,
    shadow: get("shadow").checked,
    dropShadow: get("dropShadow").checked,
  };
}

function populateForm(s) {
  selectedColor = s.color;
  selectedBgColor = s.bgColor;
  get("enabled").checked = s.enabled;
  get("fontSize").value = s.fontSize;
  get("fontSizeVal").textContent = s.fontSize;
  get("fontFamily").value = s.fontFamily;
  get("fontOpacity").value = s.fontOpacity;
  get("fontOpacityVal").textContent = s.fontOpacity;
  get("bgOpacity").value = s.bgOpacity;
  get("bgOpacityVal").textContent = s.bgOpacity;
  get("bold").checked = s.bold;
  get("italic").checked = s.italic;
  get("shadow").checked = s.shadow;
  get("dropShadow").checked = s.dropShadow;
  buildSwatches("colorSwatches", s.color, (hex) => { selectedColor = hex; });
  buildSwatches("bgColorSwatches", s.bgColor, (hex) => { selectedBgColor = hex; });
  updatePreview(s);
}

function onInput() {
  const s = readForm();
  get("fontSizeVal").textContent = s.fontSize;
  get("fontOpacityVal").textContent = s.fontOpacity;
  get("bgOpacityVal").textContent = s.bgOpacity;
  updatePreview(s);
}

function showStatus(msg) {
  const status = get("status");
  status.textContent = msg;
  status.className = "status saved";
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

["fontSize", "fontOpacity", "bgOpacity"].forEach(id => get(id).addEventListener("input", onInput));
["fontFamily"].forEach(id => get(id).addEventListener("change", onInput));
["enabled", "bold", "italic", "shadow", "dropShadow"].forEach(id => get(id).addEventListener("change", onInput));

// Save
get("saveBtn").addEventListener("click", () => {
  const settings = readForm();
  browser.storage.local.set({ settings }).then(() => {
    broadcastSettings(settings);
    showStatus("Saved!");
  }).catch(() => {});
});

// Open import/export page
get("openSettings").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});

// Load saved settings on open
populateForm(DEFAULTS);
browser.storage.local.get("settings").then((result) => {
  if (result.settings) populateForm(result.settings);
}).catch(() => {});
