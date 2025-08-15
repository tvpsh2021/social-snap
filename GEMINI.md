# Gemini Project Context for Social Snap

This file contains project-specific context and instructions for the Gemini CLI agent.

## General Instructions

- All code, comments, documentation, and commit messages must be written in English.
- All communication with me (the user) should be in Traditional Chinese.

## Technical Context

- This is a Chrome Extension project.
- The project follows Manifest V3 standards.
- It utilizes Chrome APIs like `chrome.downloads` and `chrome.tabs`.

## Coding Style Conventions

- **Variable Naming**: Use `const` and `let` instead of `var`. Use camelCase for variables and functions.
- **Class Naming**: Use PascalCase for classes and constructors.
- **File Naming**: Use kebab-case for file names.
- **Commenting**: Add meaningful JSDoc comments for all functions.
- **Error Handling**: Implement proper error handling for all extension APIs.

## Development Workflow

- **File Structure**:
    - Keep content scripts, background scripts, and popup scripts in separate directories (`src/content`, `src/background`, `src/popup`).
    - Maintain a consistent and organized file structure.
- **Documentation**:
    - Keep `README.md` and other documentation files updated with any new features or changes.
- **Commit Messages**:
    - Follow the Conventional Commits specification.
    - Examples:
        - `feat(popup): add image preview functionality`
        - `fix: resolve issue with image downloading`
        - `docs: update README with new instructions`

## AI Development Guidelines

- **Always read all `*.md` files before starting any development work.**
- **Never automatically perform `git commit` or `git push` operations.**
- Always let the developer manually review and commit changes.
- Only suggest commit messages when explicitly asked.
- Do not execute any Git version control commands without an explicit user request.
