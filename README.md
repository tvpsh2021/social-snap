# Threads Image Downloader

A Chrome extension that allows you to download all images from Threads.com posts with a single click.

## Features

- 🖼️ Automatically detect all images in Threads posts
- 🔍 Display image thumbnail previews
- 📊 Show total count of downloadable images
- ⬇️ Batch download all images with one click
- 🎯 Automatically select highest resolution images
- 📁 Auto-generate filenames for downloaded images
- 🖱️ Click thumbnails to download individual images
- 🛡️ Smart filtering of comment section images
- 📱 Support for Instagram CDN security parameters

## Installation

1. Download or clone this project to your local machine
2. Open Chrome browser
3. Navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked"
6. Select this project's folder
7. The extension will appear in your browser toolbar

## Usage

1. Navigate to any Threads.com post page
2. Click the extension icon in your browser toolbar
3. Wait for the extension to analyze images on the page
4. View thumbnail previews and total image count
5. **Batch download**: Click "Download All Images" button
6. **Single download**: Click any thumbnail to download that image
7. Images will be automatically downloaded to your default download folder

## Technical Implementation

### Image Detection
- Uses Content Script to analyze page DOM structure
- Identifies images based on `<picture>` tags
- Recognizes post images through `alt` attribute patterns
- Parses `srcset` attribute to find highest resolution versions
- Smart filtering of comment section and irrelevant images

### Download Mechanism
- Uses Chrome Downloads API for batch downloading
- Auto-generates timestamped filenames
- Smart file extension detection
- Adds download intervals to avoid server stress
- Supports Instagram CDN security parameters

### File Structure
```
threads-downloader/
├── manifest.json          # Extension configuration
├── content.js             # Content script (page image extraction)
├── background.js          # Background service (download handling)
├── popup.html            # Popup window interface
├── popup.js              # Popup window logic
├── icon.svg              # Extension icon
└── README.md             # Documentation
```

## Notes

- Only supports Chrome browser (Manifest V3)
- Must be used on Threads.com website
- Downloaded images are saved to browser's default download location
- Please respect copyright laws and only download images you have permission to use

## Troubleshooting

### Cannot Detect Images
- Ensure you are on a Threads post page
- Wait for the page to fully load before opening the extension
- Try refreshing the page and retry

### Download Failed
- Check browser download permissions
- Ensure sufficient disk space
- Check network connection

## Documentation

This project maintains several documentation files to help developers and contributors. Please read the relevant documentation before starting development:

### 📚 Documentation Index

| File | Purpose | When to Read |
|------|---------|--------------|
| **[README.md](./README.md)** | Project overview, installation, and usage instructions | First time users and general project information |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Development guidelines, code standards, and contribution process | **Required reading before any development work** |
| **[.cursorrules](./.cursorrules)** | Cursor IDE specific development rules and standards | When using Cursor IDE for development |

### 🛠️ Development Setup

Before starting development, ensure you have the necessary tools:

```bash
# Install development dependencies
npm install

# Run code linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## Contributing

If you want to contribute to this project, please read our development guidelines first:

📖 **[CONTRIBUTING.md](./CONTRIBUTING.md)** - **REQUIRED READING** for all developers

**Key development standards summary:**
- All code, comments, documentation, and commit messages must be in English
- Use 2-space indentation (no tabs)
- Follow modern JavaScript development standards
- Use ESLint for code quality and consistency
- Use Conventional Commits format for commit messages
- Ensure code is tested before submission

**We welcome all forms of contributions:**
- 🐛 Bug reports and error reporting
- 💡 New feature suggestions
- 🔧 Fixing existing issues
- 📝 Documentation improvements
- 🧪 Adding test coverage

**For AI Assistants and Automated Tools:**
Please ensure you read and follow all documentation files listed above, especially CONTRIBUTING.md and .cursorrules, before making any code changes.

## Developer Information

This extension is developed using Chrome Extension Manifest V3, with main technologies including:
- Chrome Extensions API
- DOM manipulation and image analysis
- Chrome Downloads API
- Modern JavaScript (ES6+)
- Smart image filtering algorithms
