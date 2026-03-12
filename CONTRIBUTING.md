# Contributing Guidelines

Thank you for your interest in contributing to the Social Snap project! This document outlines the development standards and practices that all contributors must follow.

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

This project uses ESLint for code quality and consistency:

```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

**Configuration:**
- `eslint.config.mjs` - ESLint flat config with modern JavaScript rules

**Code Quality Standards:**
- Follow ESLint rules for consistency
- Use 2-space indentation
- Prefer `const` and `let` over `var`
- Use meaningful variable and function names

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
- Verify functionality on supported social media platforms
- Ensure the extension works with various image formats and layouts
- Test download functionality with single images and multi-image posts
- Test carousel navigation for platforms that support it

### Documentation

- Keep README.md updated with new features
- Document any new configuration options
- Update installation instructions if needed
- Maintain clear and accurate technical documentation

## 🔧 Adding New Platform Support

When adding support for a new social media platform, follow this checklist:

### ⚠️ CRITICAL: Don't Forget Filename Generation

**The most commonly forgotten step is updating platform detection in `src/background/background.js` for filename generation. Forgetting this results in `unknown_xxxxx.jpg` instead of `platformname_xxxxx.jpg`.**

### Development Checklist

**1. Content Script (`src/content/content.js`):**
- Add platform constants (name, hostname, URL patterns)
- Create platform-specific extraction logic
- Update platform detection functions

**2. ⚠️ Background Script (`src/background/background.js`):**
- **Update `downloadAllImages()` method** with platform name detection
- **Update `downloadSingleImage()` method** with platform name detection

**3. Manifest (`manifest.json`):**
- Add host permissions for the platform and its CDN
- Add content script URL match patterns

**4. Documentation:**
- Update README.md with platform information and supported URLs
- Update troubleshooting section if needed

### Code Example: Platform Detection in Background Script

```javascript
// In both downloadAllImages() and downloadSingleImage():
let platformName = 'unknown';

if (tab.url.includes('threads.com')) {
  platformName = 'threads';
} else if (tab.url.includes('instagram.com')) {
  platformName = 'instagram';
} else if (tab.url.includes('facebook.com')) {
  platformName = 'facebook';
} else if (tab.url.includes('x.com')) {
  platformName = 'x';
}
// Add your new platform here ↑

const filename = `${platformName}_image_${timestamp}_${index}.jpg`;
```

### Testing Checklist

- ✅ Verify filenames use correct platform prefix (not "unknown")
- ✅ Test image detection and extraction
- ✅ Test multi-image carousels/galleries if applicable
- ✅ Test on different post types and layouts

## 🚀 Getting Started

1. **Fork and Clone:**
   ```bash
   git clone https://github.com/your-username/social-snap.git
   cd social-snap
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
