/**
 * Threads platform image extractor
 */

import { BasePlatform } from './base-platform.js';
import { PLATFORMS, SELECTORS } from '../../shared/constants.js';

export class ThreadsPlatform extends BasePlatform {
  constructor() {
    super();
    this.platformName = PLATFORMS.THREADS;
  }

  isCurrentPlatform() {
    return window.location.hostname.includes('threads.com');
  }

  extractImages() {
    console.log('=== Starting Threads image extraction ===');

    // Strategy 1: Find images in picture tags
    const pictureImages = document.querySelectorAll(SELECTORS.THREADS.PICTURE_IMAGES);
    console.log('Strategy 1 - Images in picture tags:', pictureImages.length);

    // Strategy 2: Find images with descriptive alt text
    const chineseImages = document.querySelectorAll(SELECTORS.THREADS.DESCRIPTIVE_IMAGES);
    console.log('Strategy 2 - Images with descriptive alt text:', chineseImages.length);

    // Strategy 3: Combination - images with descriptive alt text in picture tags
    const pictureChineseImages = document.querySelectorAll(SELECTORS.THREADS.PICTURE_DESCRIPTIVE);
    console.log('Strategy 3 - Descriptive images in picture tags:', pictureChineseImages.length);

    // Try to distinguish main post from comment section
    let mainPostImages = [];

    // Method 1: Find main post container
    const possibleMainContainers = SELECTORS.THREADS.MAIN_CONTAINERS;

    for (const selector of possibleMainContainers) {
      const container = document.querySelector(selector);
      if (container) {
        const containerImages = container.querySelectorAll(SELECTORS.THREADS.PICTURE_DESCRIPTIVE);
        if (containerImages.length > 0) {
          console.log(`Found ${containerImages.length} images in container "${selector}"`);
          mainPostImages = Array.from(containerImages);
          break;
        }
      }
    }

    // Method 2: If no container found, use position-based detection
    if (mainPostImages.length === 0) {
      console.log('Using position-based detection method...');
      const allPictureImages = Array.from(pictureChineseImages);

      // Analyze each image's context to determine if it's from the main post
      const imagesWithPosition = allPictureImages.map(img => {
        const rect = img.getBoundingClientRect();

        // More precise comment detection logic
        const isInComment = this._isImageInComment(img);

        return {
          img,
          y: rect.top,
          isInComment: !!isInComment,
          domIndex: Array.from(document.querySelectorAll('img')).indexOf(img),
          alt: img.alt
        };
      });

      // Sort and take earlier images (assumed to be from main post)
      imagesWithPosition.sort((a, b) => a.domIndex - b.domIndex);

      // Filter out images that are clearly from comment section
      const filteredImages = imagesWithPosition.filter(item => !item.isInComment);

      console.log('Position analysis results:', {
        totalImages: imagesWithPosition.length,
        afterFiltering: filteredImages.length,
        commentImages: imagesWithPosition.length - filteredImages.length
      });

      // Display detailed analysis results for each image
      console.log('Image analysis details:');
      imagesWithPosition.forEach((item, index) => {
        console.log(`Image ${index + 1}:`, {
          alt: item.alt.substring(0, 50) + '...',
          isInComment: item.isInComment,
          domIndex: item.domIndex,
          keep: !item.isInComment ? '✓' : '✗'
        });
      });

      // Additional content filtering: only exclude clearly identified comment images
      const contentFilteredImages = filteredImages.filter(item => {
        return this._shouldKeepImage(item.alt);
      });

      console.log('Content filtering results:', {
        original: filteredImages.length,
        afterContentFiltering: contentFilteredImages.length
      });

      // Select final image collection
      if (contentFilteredImages.length >= 1) {
        // Prioritize content-filtered results
        mainPostImages = contentFilteredImages.map(item => item.img);
        console.log('Using content-filtered results');
      } else if (filteredImages.length >= 1) {
        // Use position-filtered results
        mainPostImages = filteredImages.map(item => item.img);
        console.log('Using position-filtered results');
      } else {
        // Last resort: use all found images
        mainPostImages = imagesWithPosition.map(item => item.img);
        console.log('Using all found images (no filtering)');
      }

      // If image count is abnormally high, give warning but still use
      if (mainPostImages.length > 20) {
        console.warn(`Abnormally high image count (${mainPostImages.length} images), might include comment section images`);
      }
    }

    console.log(`Final selected main post image count: ${mainPostImages.length}`);

    const imageData = [];
    mainPostImages.forEach((img, index) => {
      imageData.push(this.createImageData(img, index));
    });

    console.log('Extracted image information:', imageData);
    return imageData;
  }

  /**
   * Check if image is in comment section
   * @param {HTMLImageElement} img - Image element to check
   * @returns {boolean} True if image is in comment section
   */
  _isImageInComment(img) {
    return (
      // Check if in comment-related containers
      img.closest('[data-testid*="comment"]') ||
      img.closest('[data-testid*="reply"]') ||
      img.closest('[role="article"]')?.querySelector('[data-testid*="reply"]') ||
      // Check if parent elements contain comment-related class names or attributes
      img.closest('div[class*="comment"]') ||
      img.closest('div[class*="reply"]') ||
      // Check if near username links (comments usually follow usernames)
      this._isNearUsernameLink(img) ||
      // Check if image is after the main post area (by DOM order)
      this._isAfterMainPost(img)
    );
  }

  /**
   * Check if image is near a username link (indicating comment)
   * @param {HTMLImageElement} img - Image element
   * @returns {boolean} True if near username link
   */
  _isNearUsernameLink(img) {
    const userLink = img.closest('div')?.querySelector('a[href*="/@"]');
    if (userLink) {
      // Check if this user link is in the main post author section
      const mainAuthorSection = document.querySelector('[role="main"], main, .main-content')?.querySelector('a[href*="/@"]');
      if (mainAuthorSection) {
        // If the user link in the image area is not the main author and is far away, it might be a comment
        const isMainAuthor = userLink.href === mainAuthorSection.href;
        const linkIndex = Array.from(document.querySelectorAll('a')).indexOf(userLink);
        const mainLinkIndex = Array.from(document.querySelectorAll('a')).indexOf(mainAuthorSection);

        return !isMainAuthor && (linkIndex > mainLinkIndex + 10);
      }
    }
    return false;
  }

  /**
   * Check if image is after main post area
   * @param {HTMLImageElement} img - Image element
   * @returns {boolean} True if after main post
   */
  _isAfterMainPost(img) {
    // Find main post interaction buttons (Like, Reply, Repost, Share)
    const mainInteractionButtons = document.querySelectorAll('button[aria-label*="Like"], button:has(img[alt="Like"])');
    if (mainInteractionButtons.length > 0) {
      const firstInteractionButton = mainInteractionButtons[0];
      const buttonIndex = Array.from(document.querySelectorAll('*')).indexOf(firstInteractionButton);
      const imgIndex = Array.from(document.querySelectorAll('*')).indexOf(img.closest('div'));

      // If image is many positions after the first interaction button, it might be in comments
      return imgIndex > buttonIndex + 100;
    }
    return false;
  }

  /**
   * Determine if image should be kept based on alt text
   * @param {string} alt - Image alt text
   * @returns {boolean} True if image should be kept
   */
  _shouldKeepImage(alt) {
    const altLower = alt.toLowerCase();

    // Only exclude very clear comment section image characteristics
    const isDefiniteComment =
      // News images (usually shared in comments)
      (altLower.includes('연합뉴스') || altLower.includes('news')) ||
      // Obviously multi-person news images
      (altLower.includes('4 個人') && altLower.includes('顯示的文字')) ||
      // News screenshots containing lots of text
      (altLower.includes('文字') && altLower.includes('4 個人') && altLower.includes('顯示'));

    const shouldKeep = !isDefiniteComment;

    if (!shouldKeep) {
      console.log(`Filtered out image: ${alt.substring(0, 60)}...`);
    }

    return shouldKeep;
  }
}
