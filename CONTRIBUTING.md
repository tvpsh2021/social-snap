# Contributing Guidelines

Thank you for your interest in contributing to the Threads Image Downloader project! This document outlines the development standards and practices that all contributors must follow.

## 📋 Development Standards

### Language Requirements

**All project content must be in English, including:**
- Source code (variables, functions, classes, etc.)
- Comments and documentation
- Commit messages
- Issue descriptions and pull requests
- File names and directory names
- README and other documentation files

**Examples:**

✅ **Good:**
```javascript
// Extract images from the current page
function extractImagesFromPage() {
    const imageElements = document.querySelectorAll('picture img');
    return imageElements;
}
```

❌ **Bad:**
```javascript
// 從當前頁面提取圖片
function 提取頁面圖片() {
    const 圖片元素 = document.querySelectorAll('picture img');
    return 圖片元素;
}
```

### Code Style Guidelines

1. **JavaScript Standards:**
   - Use modern ES6+ syntax
   - Prefer `const` and `let` over `var`
   - Use meaningful and descriptive variable names
   - Follow camelCase naming convention
   - Add JSDoc comments for functions

2. **Code Formatting:**
   - **Indentation:** Use 2 spaces (no tabs)
   - **Line endings:** Use LF (Unix-style)
   - **Quotes:** Use single quotes for strings
   - **Semicolons:** Always use semicolons
   - **Max line length:** 120 characters (soft limit)

3. **File Organization:**
   - Keep files focused on a single responsibility
   - Use consistent file naming (kebab-case for files)
   - Organize imports at the top of files
   - Always include final newline in files

4. **Comments:**
   - Write clear, concise comments explaining the "why", not the "what"
   - Use JSDoc format for function documentation
   - Keep comments up-to-date with code changes

### Development Tools

This project uses multiple tools for code quality and formatting consistency:

#### JavaScript Linting (ESLint)
```bash
# Run JavaScript linting
npm run lint:js

# Auto-fix JavaScript linting issues
npm run lint:js:fix
```

#### HTML Linting (HTMLHint + Prettier)
```bash
# Run HTML linting
npm run lint:html

# Format HTML files
npm run format:html
```

#### Combined Commands
```bash
# Install dependencies
npm install

# Run all linting (JS + HTML)
npm run lint

# Auto-fix all issues (JS + HTML)
npm run lint:fix
```

**Configuration Files:**
- `.eslintrc.js` - JavaScript linting rules
- `.htmlhintrc` - HTML linting rules
- `.prettierrc` - HTML/CSS formatting rules
- `.editorconfig` - Editor formatting consistency

**HTML Standards:**
- Use kebab-case for IDs and classes (e.g., `image-count`, not `imageCount`)
- Use double quotes for attributes
- Use 2-space indentation
- Ensure proper DOCTYPE and semantic HTML structure

### Commit Message Format

Follow the conventional commit format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(popup): add image preview functionality
fix(content): resolve image detection on dynamic content
docs(readme): update installation instructions
refactor(background): improve download error handling
```

### Pull Request Guidelines

1. **Before submitting:**
   - Ensure all code follows the language requirements (English only)
   - Test your changes thoroughly
   - Update documentation if necessary
   - Write clear commit messages

2. **PR Description:**
   - Write in English
   - Describe what changes were made and why
   - Include screenshots for UI changes
   - Reference any related issues

3. **Code Review:**
   - Be respectful and constructive in reviews
   - All discussions should be in English
   - Address feedback promptly

### Testing

- Test all changes manually in Chrome browser
- Verify functionality on different Threads.com pages
- Ensure the extension works with various image formats and layouts
- Test download functionality with different file sizes

### Documentation

- Keep README.md updated with new features
- Document any new configuration options
- Update installation instructions if needed
- Maintain clear and accurate technical documentation

## 🔧 Adding New Platform Support

When adding support for a new social media platform, follow this checklist to ensure all components are properly updated:

### ⚠️ **CRITICAL: Common Issue - Filename Prefix**

**The most commonly forgotten step when adding new platform support is updating the download manager filename generation in `background.js`. This results in downloaded files being named `unknown_xxxxx.jpg` instead of `platformname_xxxxx.jpg`.**

### New Platform Development Checklist

**1. Content Script (src/content/content.js):**
- [ ] Add platform to `PLATFORMS` constant
- [ ] Add hostname to `PLATFORM_HOSTNAMES` constant
- [ ] Add URL patterns to `SINGLE_POST_PATTERNS`
- [ ] Add homepage patterns to `HOMEPAGE_PATTERNS` (if needed)
- [ ] Add selectors to `SELECTORS` constant
- [ ] Create new Platform class (e.g., `TwitterPlatform extends BasePlatform`)
- [ ] Update `getPlatformFromUrl()` function
- [ ] Update `PlatformFactory.createPlatform()` method

**2. Background Script (src/background/background.js) - ⚠️ DON'T FORGET:**
- [ ] **Update `downloadAllImages()` method** - Add platform detection for filename generation
- [ ] **Update `downloadSingleImage()` method** - Add platform detection for filename generation

**3. Manifest (manifest.json):**
- [ ] Add host permissions for the new platform
- [ ] Add content script matches for the new platform URLs
- [ ] Update description to include the new platform

**4. Documentation:**
- [ ] Update README.md with new platform information
- [ ] Update supported URL patterns
- [ ] Update usage examples
- [ ] Update troubleshooting section

### Example: Adding X.com Support

**Step 1: Content Script Updates**
```javascript
// Add to PLATFORMS constant
const PLATFORMS = {
  THREADS: 'threads',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  X: 'x'  // ← Add this
};

// Update getPlatformFromUrl()
function getPlatformFromUrl(url) {
  // ... existing code ...
  } else if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.X])) {
    return PLATFORMS.X;  // ← Add this
  }
  return null;
}
```

**Step 2: Background Script Updates** ⚠️ **CRITICAL STEP**
```javascript
// In downloadAllImages() method:
if (tab.url.includes('threads.com')) {
  platformName = 'threads';
} else if (tab.url.includes('instagram.com')) {
  platformName = 'instagram';
} else if (tab.url.includes('facebook.com')) {
  platformName = 'facebook';
} else if (tab.url.includes('x.com')) {  // ← Add this
  platformName = 'x';
}

// ALSO update downloadSingleImage() method with the same logic!
```

**Step 3: Manifest Updates**
```json
{
  "host_permissions": [
    "https://x.com/*",  // ← Add this
    "https://*.twimg.com/*"  // ← Add CDN if needed
  ],
  "content_scripts": [{
    "matches": [
      "https://x.com/*/status/*/photo/*"  // ← Add this
    ]
  }]
}
```

### Testing New Platform Support

1. **Filename Test**: Download an image and verify filename starts with correct platform name
2. **Functionality Test**: Test image detection and extraction
3. **Boundary Test**: Test any boundary filtering logic
4. **Multi-image Test**: Test carousel/gallery navigation if applicable

### Debugging Tools

When developing new platform support, use these debugging functions:

```javascript
// For general platform testing
testXExtraction()

// For boundary filtering testing
testXBoundary()

// Check platform detection
console.log('Platform detected:', getPlatformFromUrl(window.location.href));
```

## 🚀 Getting Started

1. **Fork and Clone:**
   ```bash
   git clone https://github.com/your-username/threads-downloader.git
   cd threads-downloader
   ```

2. **Load Extension:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project folder

3. **Make Changes:**
   - Create a new branch for your feature
   - Follow the coding standards outlined above
   - Test your changes thoroughly

4. **Submit PR:**
   - Push your changes to your fork
   - Create a pull request with a clear description
   - Wait for review and address any feedback

## 📞 Questions?

If you have any questions about these guidelines or need clarification on any development practices, please open an issue for discussion.

Remember: **All communication and code must be in English** to ensure consistency and accessibility for all contributors.
