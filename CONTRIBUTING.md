# Contributing

## Code Style

- ES6+ JavaScript, `const`/`let` only
- 2-space indentation, single quotes, semicolons
- camelCase for variables and functions, PascalCase for classes, kebab-case for file names
- Max line length: 120 characters (soft limit)
- JSDoc comments for non-trivial functions

ESLint is configured in `eslint.config.mjs`. Run `npm run lint` before submitting.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example: `feat(popup): add image preview functionality`

## Pull Requests

- Test changes manually in Chrome on all affected platforms
- Update README.md if adding or changing user-visible behavior
- Write a clear PR description explaining what changed and why

## Adding New Platform Support

This is the most error-prone task in this project. Follow all four steps — step 2 is the most commonly forgotten.

**1. Content script** (`src/content/content.js`)
- Add platform constants (hostname, URL patterns)
- Implement extraction logic
- Register the platform in the detection function

**2. Background script** (`src/background/background.js`) — easy to forget
- Update platform name detection in both `downloadAllImages()` and `downloadSingleImage()`
- Without this, filenames will be `unknown_xxxxx.jpg` instead of `platformname_xxxxx.jpg`

```javascript
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
// Add new platform here
```

**3. Manifest** (`manifest.json`)
- Add `host_permissions` for the platform domain and any CDN domains
- Add URL match patterns to `content_scripts`

**4. Documentation**
- Update README.md: supported URLs, platform notes in Architecture section

**Testing checklist**
- Filenames use the correct platform prefix (not "unknown")
- Single image and multi-image posts both work
- Carousel/gallery navigation works if applicable
- Extension does not activate on feed or profile pages
