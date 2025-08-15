/**
 * @fileoverview Modular status display component with better state management
 */

/**
 * Status display component for managing different UI states
 */
export class StatusDisplayComponent {
  /**
   * @param {HTMLElement} container - Container element for status display
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.showImageCount=true] - Show image count in header
   * @param {boolean} [options.autoHideSuccess=true] - Auto-hide success messages
   * @param {number} [options.successHideDelay=3000] - Success message hide delay
   * @param {Function} [options.onStateChange] - Callback for state changes
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showImageCount: true,
      autoHideSuccess: true,
      successHideDelay: 3000,
      onStateChange: null,
      ...options
    };

    this.currentState = 'loading';
    this.imageCount = 0;
    this.successTimer = null;

    this.createElements();
    this.addStyles();
  }

  /**
   * Create status display elements
   * @private
   */
  createElements() {
    this.container.innerHTML = '';
    this.container.className = 'status-display-container';

    // Header section
    this.headerSection = document.createElement('div');
    this.headerSection.className = 'status-header';

    this.titleElement = document.createElement('h1');
    this.titleElement.className = 'status-title';
    this.titleElement.textContent = 'Social Media Image Downloader';
    this.titleElement.style.color = '#1877f2'; // Force blue color for visibility in all modes

    // Status count element removed - no more "Initializing..." text

    this.headerSection.appendChild(this.titleElement);

    // Status sections
    this.loadingSection = this.createLoadingSection();
    this.errorSection = this.createErrorSection();
    this.successSection = this.createSuccessSection();
    this.contentSection = this.createContentSection();

    // Append all sections
    this.container.appendChild(this.headerSection);
    this.container.appendChild(this.loadingSection);
    this.container.appendChild(this.errorSection);
    this.container.appendChild(this.successSection);
    this.container.appendChild(this.contentSection);

    // Set initial state
    this.setState('loading');
  }

  /**
   * Create loading section
   * @returns {HTMLElement} Loading section element
   * @private
   */
  createLoadingSection() {
    const section = document.createElement('div');
    section.className = 'status-section loading-section';

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';

    const message = document.createElement('p');
    message.className = 'loading-message';
    message.textContent = 'Analyzing images on the page...';

    section.appendChild(spinner);
    section.appendChild(message);

    return section;
  }

  /**
   * Create error section
   * @returns {HTMLElement} Error section element
   * @private
   */
  createErrorSection() {
    const section = document.createElement('div');
    section.className = 'status-section error-section';

    const icon = document.createElement('div');
    icon.className = 'error-icon';
    icon.textContent = '⚠';

    const message = document.createElement('p');
    message.className = 'error-message';
    message.textContent = 'No images found. Please ensure you are on a supported social media post page.';

    const details = document.createElement('div');
    details.className = 'error-details';

    section.appendChild(icon);
    section.appendChild(message);
    section.appendChild(details);

    return section;
  }

  /**
   * Create success section
   * @returns {HTMLElement} Success section element
   * @private
   */
  createSuccessSection() {
    const section = document.createElement('div');
    section.className = 'status-section success-section';

    const icon = document.createElement('div');
    icon.className = 'success-icon';
    icon.textContent = '✓';

    const message = document.createElement('p');
    message.className = 'success-message';
    message.textContent = 'Image download started! Please check your browser\'s download list.';

    section.appendChild(icon);
    section.appendChild(message);

    return section;
  }

  /**
   * Create content section
   * @returns {HTMLElement} Content section element
   * @private
   */
  createContentSection() {
    const section = document.createElement('div');
    section.className = 'status-section content-section';

    return section;
  }

  /**
   * Add CSS styles for status display
   * @private
   */
  addStyles() {
    if (document.getElementById('status-display-styles')) return;

    const style = document.createElement('style');
    style.id = 'status-display-styles';
    style.textContent = `
      .status-display-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .status-header {
        text-align: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e4e6ea;
      }

      .status-title {
        font-size: 18px;
        font-weight: 600;
        color: #1c1e21;
        margin: 0 0 4px 0;
      }

      /* Status count styles removed */

      .status-section {
        display: none;
        text-align: center;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 16px;
        transition: all 0.3s ease;
      }

      .status-section.active {
        display: block;
        animation: fadeIn 0.3s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Loading section */
      .loading-section {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e9ecef;
        border-top: 3px solid #1877f2;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .loading-message {
        color: #65676b;
        font-size: 14px;
        margin: 0;
      }

      /* Error section */
      .error-section {
        background: #fef7f7;
        border: 1px solid #f5c6cb;
      }

      .error-icon {
        font-size: 32px;
        color: #e41e3f;
        margin-bottom: 12px;
      }

      .error-message {
        color: #721c24;
        font-size: 14px;
        margin: 0 0 8px 0;
        line-height: 1.4;
      }

      .error-details {
        font-size: 12px;
        color: #856404;
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        padding: 8px;
        margin-top: 12px;
        display: none;
      }

      .error-details.visible {
        display: block;
      }

      /* Success section */
      .success-section {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
      }

      .success-icon {
        font-size: 32px;
        color: #42b883;
        margin-bottom: 12px;
      }

      .success-message {
        color: #166534;
        font-size: 14px;
        margin: 0;
        line-height: 1.4;
      }

      /* Content section */
      .content-section {
        background: transparent;
        padding: 0;
      }

      /* Status count styles removed */

      /* Responsive adjustments */
      @media (max-width: 400px) {
        .status-title {
          font-size: 16px;
        }

        .status-section {
          padding: 16px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Set the current state
   * @param {string} state - State name (loading, error, success, content)
   * @param {Object} [options={}] - State-specific options
   */
  setState(state, options = {}) {
    if (this.currentState === state) return;

    const previousState = this.currentState;
    this.currentState = state;

    // Update container class
    this.container.className = `status-display-container ${state}`;

    // Hide all sections
    this.container.querySelectorAll('.status-section').forEach(section => {
      section.classList.remove('active');
    });

    // Show current section
    const currentSection = this.container.querySelector(`.${state}-section`);
    if (currentSection) {
      currentSection.classList.add('active');
    }

    // Handle state-specific logic
    this.handleStateChange(state, options, previousState);

    // Notify state change
    if (this.options.onStateChange) {
      this.options.onStateChange(state, previousState, options);
    }
  }

  /**
   * Handle state change logic
   * @param {string} state - New state
   * @param {Object} options - State options
   * @param {string} previousState - Previous state
   * @private
   */
  handleStateChange(state, options, previousState) {
    switch (state) {
      case 'loading':
        this.updateCountText('Scanning images...');
        if (options.message) {
          this.setLoadingMessage(options.message);
        }
        break;

      case 'error':
        this.updateCountText('No images found');
        if (options.message) {
          this.setErrorMessage(options.message);
        }
        if (options.details) {
          this.setErrorDetails(options.details);
        }
        break;

      case 'success':
        if (options.message) {
          this.setSuccessMessage(options.message);
        }
        if (this.options.autoHideSuccess) {
          this.scheduleSuccessHide();
        }
        break;

      case 'content':
        // Content state is handled externally
        break;
    }
  }

  /**
   * Show loading state
   * @param {string} [message] - Custom loading message
   */
  showLoading(message) {
    this.setState('loading', { message });
  }

  /**
   * Show error state
   * @param {string} [message] - Error message to display
   * @param {string} [details] - Additional error details
   */
  showError(message, details) {
    this.setState('error', { message, details });
  }

  /**
   * Show success state
   * @param {string} [message] - Success message to display
   */
  showSuccess(message) {
    this.setState('success', { message });
  }

  /**
   * Show content state (images loaded)
   */
  showContent() {
    this.setState('content');
  }

  /**
   * Update image count display
   * @param {number} count - Number of images found
   */
  updateImageCount(count) {
    this.imageCount = count;
    if (this.currentState === 'content') {
      this.updateCountText(`Found ${count} images`);
    }
  }

  /**
   * Update count text
   * @param {string} text - Count text to display
   * @private
   */
  updateCountText(text) {
    // Count element removed - no action needed
  }

  /**
   * Set loading message
   * @param {string} message - Loading message
   */
  setLoadingMessage(message) {
    const messageEl = this.loadingSection.querySelector('.loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * Set error message
   * @param {string} message - Error message
   */
  setErrorMessage(message) {
    const messageEl = this.errorSection.querySelector('.error-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * Set error details
   * @param {string} details - Error details
   */
  setErrorDetails(details) {
    const detailsEl = this.errorSection.querySelector('.error-details');
    if (detailsEl) {
      detailsEl.textContent = details;
      detailsEl.classList.add('visible');
    }
  }

  /**
   * Set success message
   * @param {string} message - Success message
   */
  setSuccessMessage(message) {
    const messageEl = this.successSection.querySelector('.success-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * Schedule success message hide
   * @private
   */
  scheduleSuccessHide() {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }

    this.successTimer = setTimeout(() => {
      if (this.currentState === 'success') {
        this.setState('content');
      }
      this.successTimer = null;
    }, this.options.successHideDelay);
  }

  /**
   * Get current state
   * @returns {string} Current state
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Get image count
   * @returns {number} Current image count
   */
  getImageCount() {
    return this.imageCount;
  }

  /**
   * Get content section for external components
   * @returns {HTMLElement} Content section element
   */
  getContentSection() {
    return this.contentSection;
  }

  /**
   * Clear any active timers
   */
  clearTimers() {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  }

  /**
   * Destroy the status display component
   */
  destroy() {
    this.clearTimers();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Maintain backward compatibility
export { StatusDisplayComponent as StatusDisplay };
