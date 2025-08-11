/**
 * Status display component for popup UI
 */

export class StatusDisplay {
  constructor() {
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error');
    this.successEl = document.getElementById('success');
    this.contentEl = document.getElementById('content');
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.loadingEl.style.display = 'block';
    this.errorEl.style.display = 'none';
    this.successEl.style.display = 'none';
    this.contentEl.style.display = 'none';
  }

  /**
   * Show error state
   * @param {string} message - Error message to display
   */
  showError(message = 'No images found. Please ensure you are on a supported social media post page.') {
    this.loadingEl.style.display = 'none';
    this.errorEl.style.display = 'block';
    this.contentEl.style.display = 'none';

    // Update error message if custom message provided
    const errorTextEl = this.errorEl.querySelector('p');
    if (errorTextEl && message) {
      errorTextEl.textContent = message;
    }
  }

  /**
   * Show success state
   * @param {string} message - Success message to display
   */
  showSuccess(message = 'Image download started! Please check your browser\'s download list.') {
    this.successEl.style.display = 'block';

    const successTextEl = this.successEl.querySelector('p');
    if (successTextEl && message) {
      successTextEl.textContent = message;
    }

    setTimeout(() => {
      this.successEl.style.display = 'none';
    }, 3000);
  }

  /**
   * Show content state (images loaded)
   */
  showContent() {
    this.loadingEl.style.display = 'none';
    this.errorEl.style.display = 'none';
    this.contentEl.style.display = 'block';
  }

  /**
   * Update image count display
   * @param {number} count - Number of images found
   */
  updateImageCount(count) {
    const imageCountEl = document.getElementById('image-count');
    if (imageCountEl) {
      imageCountEl.textContent = `Found ${count} images`;
    }
  }
}
