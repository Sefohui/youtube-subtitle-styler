# YouTube Subtitle Styler

A Firefox extension that lets you set your preferred subtitle style on YouTube and keeps it locked in — even when YouTube tries to reset your preferences.

![Extension popup](https://i.imgur.com/placeholder.png)

## Features

- **Font size** — set a custom size between 10px and 60px
- **Font family** — choose from 8 fonts
- **Text color** — all 8 colors available in YouTube's own subtitle settings
- **Bold, italic, text shadow** — toggleable
- **Background color & opacity** — pick a color and control transparency
- **Enable/disable** — toggle all custom styles on or off with one click
- **Persistent** — styles survive page reloads and YouTube's preference resets, enforced via `!important` and a `MutationObserver`

## Installation

### Option A — Load temporarily (for testing)

This method works without signing and is ideal for development or personal use. The extension is removed when Firefox restarts.

1. Open Firefox and go to `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on…**
4. Navigate to the project folder and select `manifest.json`
5. The extension icon will appear in your toolbar

### Option B — Install as a permanent unsigned extension

This requires Firefox **Nightly** or **Developer Edition** with signature enforcement disabled.

1. Open `about:config` in Firefox
2. Search for `xpinstall.signatures.required` and set it to `false`
3. Package the extension:
   ```bash
   cd yt-subtitles-styler
   zip -r youtube-subtitle-styler.xpi . -x "*.git*" -x "*.DS_Store"
   ```
4. Open `about:addons` in Firefox
5. Click the gear icon → **Install Add-on From File…**
6. Select the `.xpi` file

### Option C — Publish to Firefox Add-ons (AMO)

To distribute publicly or install permanently in standard Firefox:

1. Create an account at [addons.mozilla.org](https://addons.mozilla.org/developers/)
2. Package the extension as a `.zip`:
   ```bash
   zip -r youtube-subtitle-styler.zip . -x "*.git*" -x "*.DS_Store" -x "*.xpi"
   ```
3. Submit the `.zip` via the AMO developer hub
4. Once reviewed and signed, users can install it directly from AMO

## Usage

1. Go to any YouTube video
2. Enable subtitles on the video
3. Click the **YouTube Subtitle Styler** icon in your toolbar
4. Adjust your settings — the live preview updates as you change things
5. Click **Save settings**

Your preferences are saved locally and applied automatically on every YouTube page.

## Project structure

```
yt-subtitles-styler/
├── manifest.json     # Extension manifest (Firefox WebExtension MV2)
├── content.js        # Injects CSS into YouTube pages, keeps styles enforced
├── background.js     # Forwards settings changes to open YouTube tabs
├── popup.html        # Settings UI
├── popup.js          # Settings UI logic
└── icons/
    └── icon.svg      # Extension icon (scales to 16/32/48/128px)
```

## How it works

`content.js` injects a `<style>` tag with `!important` rules targeting YouTube's subtitle elements (`.ytp-caption-segment`). A `MutationObserver` watches the DOM and re-injects the style tag if YouTube removes it. Settings are stored in `browser.storage.local` and synced to all open YouTube tabs instantly on save.

## License

MIT
