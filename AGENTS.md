# Project Context: Social Snap

This file contains project-specific context for AI agents. General coding style, workflow, and conventions are defined in the global `AGENTS.md`.

## What This Project Is

Social Snap is a Chrome Extension (Manifest V3) that lets users download images and videos from social media posts with a single click.

Supported platforms:
- Threads (`threads.com`)
- Instagram (`instagram.com`)
- Facebook (`facebook.com`)
- X / Twitter (`x.com`)

## Project Structure

```
src/
  background/   # Service worker (background.js)
  content/      # Content script injected into supported pages (content.js)
  popup/        # Extension popup UI
assets/
  icons/        # Extension icons (16, 32, 48, 128px)
manifest.json   # Chrome Extension manifest
```

## Chrome Extension Specifics

- Follows **Manifest V3** standards. Do not suggest or use Manifest V2 patterns.
- Service worker replaces background pages — no persistent background scripts.
- Permissions in use: `activeTab`, `downloads`, `storage`.
- Host permissions cover CDN domains (cdninstagram, fbcdn, twimg) needed to fetch media.
- Use `chrome.downloads`, `chrome.tabs`, `chrome.storage`, and `chrome.scripting` APIs where appropriate.
- Content scripts are injected only on matched post URLs (see `manifest.json` for patterns).

## Architecture Notes

- The content script (`content.js`) is responsible for scraping media URLs from the DOM.
- The background service worker (`background.js`) handles download orchestration via `chrome.downloads`.
- The popup (`popup/`) presents the UI and coordinates between the content script and background worker via `chrome.tabs.sendMessage` / `chrome.runtime.sendMessage`.

## Documentation Maintenance

When making changes to extraction logic in `content.js`, always check whether the following files need to be updated:

- `docs/` - platform-specific extraction logic documentation (e.g., `docs/instagram-extraction.md`, `docs/threads-extraction.md`)
- `README.md` - user-facing feature descriptions and supported platforms

## Design System

The UI design is governed by `docs/design-system.md`. Before making any changes to `src/popup/`:

- Read `docs/design-system.md` to understand the color palette, typography, component rules, and what to avoid.
- All colors must use the CSS custom properties defined in the popup (e.g., `--color-text-primary`, `--color-surf-1`). Do not hardcode hex values.
- If new UI states or components are added, update `docs/design-system.md` in the same task.
- The live UI reference is `design/ui-demo.html`. The icon generator is `design/icon-generator.html`.
