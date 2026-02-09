# Archived

Archived is a lightweight browser extension for saving and organizing archived versions of web pages.

## Features
- One-click archive of the current page from the popup.
- Recent, Collections, and History views with search.
- Provider selection (`archive.is`, `archive.today`, `archive.ph`).
- Open in new tab toggle for archived links.
- Light/dark theme toggle.
- History retention controls and one-click clear.
- Rename, add to collection, remove, and delete actions from item menus.

## Install (Unpacked)
### Chromium-based browsers (Chrome, Edge, Brave)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

### Firefox (temporary add-on)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` in this folder.

Note: Manifest V3 support varies by browser. If you run into background script issues in Firefox, consider adapting `background.js` to a service worker or using a Chromium-based browser.

## Usage
- Click the extension icon and press **Archive this page**.
- The page is saved to **Recent** and **History**, and the archive opens according to the **Open in new tab** toggle.
- Click a saved card to open its archived version with the selected provider.
- Use the item menu to rename, add to a collection, remove from a collection, or delete.
- Use **Collections** to group pages, and **History** to browse everything.
- Use the search bar to filter the active tab�s list.

## Keyboard Shortcut
- Default: `Alt+A` (archives the current tab via `archive.is` and replaces the current tab).
- You can change this in your browser�s extension shortcuts settings.

## Permissions
- `tabs`: Open and update tabs when archiving or opening items.
- `storage`: Save recent items, history, collections, preferences, and theme.

## Data & Privacy
All data is stored locally using `chrome.storage.local`. The extension does not send your saved data anywhere.

## Project Structure
- `manifest.json`: Extension metadata and permissions.
- `popup.html`: UI layout.
- `styles.css`: UI styling.
- `popup.js`: Popup behavior and storage.
- `background.js`: Keyboard shortcut handler.
- `icons/`: Extension icons.
