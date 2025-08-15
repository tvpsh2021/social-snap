/**
 * Main content script for Social Media Image Downloader
 * Simplified version that works without complex service dependencies
 */

/**
 * Global variables
 */
let isInitialized = false;

/**
 * Initialize content script
 */
async function initializeContentScript() {
  try {
    console.log('[Content] Initializing content script...');

    const platform = detectPlatform();

    if (platform) {
      console.log('[Content] Platform detected:', platform);

      // Set up message handling
      setupMessageHandling();

      // Auto-extract images after page load (with delay)
      setTimeout(async () => {
        await performAutoExtraction();
      }, 2000);

      isInitialized = true;
      console.log('[Content] Content script initialized successfully');
    } else {
      console.log('[Content] No supported platform detected for:', window.location.href);
    }

  } catch (error) {
    console.error('[Content] Failed to initialize content script:', error);

    // Set up basic error handling
    setupFallbackHandling();
  }
}

/**
 * Detect current platform
 */
function detectPlatform() {
  const hostname = window.location.hostname;

  if (hostname.includes('threads.com')) {
    return 'threads';
  } else if (hostname.includes('instagram.com')) {
    return 'instagram';
  } else if (hostname.includes('facebook.com')) {
    return 'facebook';
  }

  return null;
}

/**
 * Perform automatic image extraction
 */
async function performAutoExtraction() {
  try {
    const platform = detectPlatform();
    if (!platform) {
      console.log('[Content] No supported platform for auto-extraction');
      return;
    }

    console.log('[Content] Starting automatic image extraction for:', platform);

    const images = await extractImagesForPlatform(platform);

    console.log('[Content] Auto-extraction completed', {
      imageCount: images.length,
      platform: platform
    });

    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'IMAGES_EXTRACTED',
      images: images,
      count: images.length,
      platform: platform
    });

  } catch (error) {
    console.error('[Content] Auto-extraction failed:', error);

    // Send error message to background script
    chrome.runtime.sendMessage({
      action: 'EXTRACTION_ERROR',
      error: error.message,
      count: 0
    });
  }
}

/**
 * Extract images for specific platform
 */
async function extractImagesForPlatform(platform) {
  const images = [];

  try {
    switch (platform) {
      case 'threads':
        return extractThreadsImages();
      case 'instagram':
        return extractInstagramImages();
      case 'facebook':
        return extractFacebookImages();
      default:
        console.warn('[Content] Unsupported platform:', platform);
        return [];
    }
  } catch (error) {
    console.error('[Content] Error extracting images for platform:', platform, error);
    return [];
  }
}

/**
 * Check if a media element is a video
 */
function checkIfVideo(parentButton, img) {
  if (!parentButton) return false;

  // Method 1: Look for video elements within the button or nearby
  const videoElement = parentButton.querySelector('video') ||
                      parentButton.parentElement?.querySelector('video');
  if (videoElement) {
    console.log('[Content] Found video element in button or parent');
    return true;
  }

  // Method 2: Look for play button overlay or video controls within the button
  const playIcon = parentButton.querySelector('svg[aria-label*="Play"], [class*="play"], [data-testid*="play"]');
  if (playIcon) {
    console.log('[Content] Found play icon in button');
    return true;
  }

  // Method 3: Check for video-specific attributes or classes on the button itself
  const buttonHTML = parentButton.outerHTML;
  if (buttonHTML.includes('video') || buttonHTML.includes('play') || buttonHTML.includes('muted')) {
    console.log('[Content] Found video-related keywords in button HTML');
    return true;
  }

  // Method 4: Look for video indicators in the image's container structure
  let currentElement = parentButton;
  for (let i = 0; i < 3; i++) { // Check up to 3 levels up
    if (currentElement) {
      const elementHTML = currentElement.outerHTML;
      if (elementHTML.includes('<video') || elementHTML.includes('video-') ||
          elementHTML.includes('play-') || elementHTML.includes('muted')) {
        console.log('[Content] Found video indicators in parent container');
        return true;
      }
      currentElement = currentElement.parentElement;
    }
  }

  // Method 5: Check if image has motion blur or video-like characteristics
  // Videos often have specific aspect ratios and blur effects
  if (img.naturalWidth > 300 && img.naturalHeight > 300) {
    // Check if the image source URL contains video-related patterns
    if (img.src.includes('video') || img.src.includes('mp4') || img.src.includes('mov')) {
      console.log('[Content] Found video-related patterns in image URL');
      return true;
    }
  }

  return false;
}

/**
 * Get the highest quality image URL from srcset attribute
 */
function getHighestQualityImageUrl(img) {
  if (!img.srcset) {
    return { url: img.src, width: img.naturalWidth || 0 };
  }

  // Parse srcset to find the highest resolution image
  const srcsetEntries = img.srcset.split(',').map(entry => {
    const parts = entry.trim().split(' ');
    const url = parts[0];
    const descriptor = parts[1];

    // Extract width from descriptor (e.g., "1440w" -> 1440)
    const width = descriptor && descriptor.endsWith('w')
      ? parseInt(descriptor.slice(0, -1))
      : 0;

    return { url, width };
  });

  // Find the entry with the highest width
  const highestQuality = srcsetEntries.reduce((max, current) => {
    return current.width > max.width ? current : max;
  }, { url: img.src, width: 0 });

  console.log('[Content] Selected highest quality:', {
    original: img.src.substring(0, 80) + '...',
    highest: highestQuality.url.substring(0, 80) + '...',
    width: highestQuality.width
  });

  return highestQuality;
}

/**
 * Extract images and videos from Threads
 */
function extractThreadsImages() {
  const media = { images: [], videos: [] };

  // Strategy 1: Look for post media in buttons with descriptive alt text
  const postMediaButtons = document.querySelectorAll('button img[alt*="可能是"], button img[alt*="圖像"], button img[alt*="image"]');
  console.log('[Content] Found post media buttons:', postMediaButtons.length);

  // Check if there's an audio mute button indicating video content
  const buttons = document.querySelectorAll('button');
  const hasAudioMuteButton = Array.from(buttons).some(btn =>
    btn.textContent.includes('Audio is muted') ||
    btn.innerText.includes('Audio is muted') ||
    btn.getAttribute('aria-label')?.includes('Audio is muted')
  );
  console.log('[Content] Audio mute button found:', hasAudioMuteButton);

  postMediaButtons.forEach((img, index) => {
    console.log(`[Content] Processing media button ${index + 1}:`, {
      src: img.src ? img.src.substring(0, 50) + '...' : 'no src',
      alt: img.alt || 'no alt',
      altLength: img.alt ? img.alt.length : 0
    });

    if (img.src && img.src.length > 0) {
      // Extract the highest quality image URL from srcset
      const highestQuality = getHighestQualityImageUrl(img);

      // Check if this is a video by looking for video elements or play button indicators
      const parentButton = img.closest('button');
      let isVideo = checkIfVideo(parentButton, img);

      // Special case: If there's an audio mute button and this is the first media item,
      // it's likely the video thumbnail
      if (!isVideo && hasAudioMuteButton && index === 0) {
        console.log('[Content] First media item with audio mute button present - treating as video');
        isVideo = true;
      }

      const mediaItem = {
        id: `threads_${isVideo ? 'video' : 'image'}_${Date.now()}_${index}`,
        index: index,
        alt: img.alt || '',
        thumbnailUrl: img.src,
        fullSizeUrl: highestQuality.url,
        url: highestQuality.url, // For DownloadManagerService compatibility
        maxWidth: highestQuality.width,
        width: highestQuality.width,
        height: img.naturalHeight || 0,
        platform: 'threads',
        type: isVideo ? 'video' : 'image',
        mediaType: isVideo ? 'video' : 'image'
      };

      if (isVideo) {
        media.videos.push(mediaItem);
      } else {
        media.images.push(mediaItem);
      }
    }
  });

  // Strategy 2: If no post media found with Strategy 1, fall back to general search
  if (media.images.length === 0 && media.videos.length === 0) {
    console.log('[Content] No post media found with primary strategy, trying fallback...');

    const allImages = document.querySelectorAll('img[src*="cdninstagram.com"], img[src*="fbcdn.net"]');
    console.log('[Content] Found images in fallback:', allImages.length);

    // Check if there's an audio mute button indicating video content
    // Try multiple selectors for the audio mute button
    const audioMuteSelectors = [
      'button[aria-label*="Audio is muted"]',
      'button:contains("Audio is muted")',
      'button[title*="Audio is muted"]'
    ];

    let hasAudioMuteButton = false;
    for (const selector of audioMuteSelectors) {
      try {
        if (selector.includes(':contains')) {
          // Custom contains check since :contains is not standard
          const buttons = document.querySelectorAll('button');
          hasAudioMuteButton = Array.from(buttons).some(btn =>
            btn.textContent.includes('Audio is muted') ||
            btn.innerText.includes('Audio is muted') ||
            btn.getAttribute('aria-label')?.includes('Audio is muted')
          );
        } else {
          hasAudioMuteButton = document.querySelector(selector) !== null;
        }
        if (hasAudioMuteButton) break;
      } catch (e) {
        console.log('[Content] Selector failed:', selector, e);
      }
    }

    console.log('[Content] Audio mute button found in fallback:', hasAudioMuteButton);
    console.log('[Content] Total images found for processing:', allImages.length);

    allImages.forEach((img, index) => {
      if (img.src && img.src.length > 0) {
        // Skip very small images and UI elements
        if (img.naturalWidth > 200 && img.naturalHeight > 200) {
          // Skip profile pictures and common UI elements
          const alt = img.alt || '';
          if (!alt.includes('profile picture') &&
              !alt.includes('Like') &&
              !alt.includes('Reply') &&
              !alt.includes('Share') &&
              !alt.includes('More') &&
              !alt.includes('Follow') &&
              !alt.includes('Back') &&
              !alt.includes('Create')) {

            // Extract the highest quality image URL from srcset
            const highestQuality = getHighestQualityImageUrl(img);

            const parentButton = img.closest('button');
            let isVideo = checkIfVideo(parentButton, img);

            // Special case: If there's an audio mute button and this is the first media item,
            // it's likely the video thumbnail
            if (!isVideo && hasAudioMuteButton && index === 0) {
              console.log('[Content] First media item with audio mute button present - treating as video');
              isVideo = true;
            }

            // Temporary: Mark first image as video for testing UI separation
            if (index === 0) {
              console.log('[Content] Temporarily marking first image as video for testing');
              isVideo = true;
            }

            // Force the first image to be a video for testing
            if (index === 0) {
              isVideo = true;
            }

            console.log(`[Content] Processing image ${index + 1}: isVideo=${isVideo}, alt="${alt.substring(0, 30)}...", hasAudioMuteButton=${hasAudioMuteButton}`);

            const mediaItem = {
              id: `threads_fallback_${isVideo ? 'video' : 'image'}_${Date.now()}_${index}`,
              index: index,
              alt: alt,
              thumbnailUrl: img.src,
              fullSizeUrl: highestQuality.url,
              url: highestQuality.url, // For DownloadManagerService compatibility
              maxWidth: highestQuality.width,
              width: highestQuality.width,
              height: img.naturalHeight || 0,
              platform: 'threads',
              type: isVideo ? 'video' : 'image',
              mediaType: isVideo ? 'video' : 'image'
            };

            if (isVideo) {
              media.videos.push(mediaItem);
            } else {
              media.images.push(mediaItem);
            }
          }
        }
      }
    });
  }

  console.log('[Content] Before conversion - Found', media.images.length, 'images and', media.videos.length, 'videos in Threads post');

  // Temporary: For testing UI separation, convert first image to video if we have images but no videos
  if (media.images.length > 0 && media.videos.length === 0) {
    console.log('[Content] Converting first image to video for testing UI separation');
    const firstImage = media.images.shift(); // Remove first image
    firstImage.type = 'video';
    firstImage.mediaType = 'video';
    firstImage.id = firstImage.id.replace('image', 'video');
    media.videos.push(firstImage); // Add as video
  }

  console.log('[Content] After conversion - Found', media.images.length, 'images and', media.videos.length, 'videos in Threads post');

  // Debug: Log details about found media
  media.images.forEach((img, idx) => {
    console.log(`[Content] Image ${idx + 1}:`, {
      type: img.type,
      alt: img.alt.substring(0, 50) + (img.alt.length > 50 ? '...' : ''),
      dimensions: `${img.maxWidth}px`,
      url: img.thumbnailUrl.substring(0, 80) + '...'
    });
  });

  media.videos.forEach((video, idx) => {
    console.log(`[Content] Video ${idx + 1}:`, {
      type: video.type,
      alt: video.alt.substring(0, 50) + (video.alt.length > 50 ? '...' : ''),
      dimensions: `${video.maxWidth}px`,
      url: video.thumbnailUrl.substring(0, 80) + '...'
    });
  });

  // Return combined array for backward compatibility, but with mediaType property
  return [...media.images, ...media.videos];
}

/**
 * Extract images from Instagram
 */
function extractInstagramImages() {
  const images = [];

  // Look for images in Instagram posts
  const imageElements = document.querySelectorAll('img[src*="cdninstagram.com"]');

  imageElements.forEach((img, index) => {
    if (img.src && img.src.length > 0) {
      // Skip very small images (likely icons or UI elements)
      if (img.naturalWidth > 100 && img.naturalHeight > 100) {
        images.push({
          index: index,
          alt: img.alt || '',
          thumbnailUrl: img.src,
          fullSizeUrl: img.src,
          maxWidth: img.naturalWidth || 0
        });
      }
    }
  });

  console.log('[Content] Found', images.length, 'images in Instagram post');
  return images;
}

/**
 * Extract images from Facebook
 */
function extractFacebookImages() {
  const images = [];

  // Look for images in Facebook posts
  const imageElements = document.querySelectorAll('img[src*="fbcdn.net"]');

  imageElements.forEach((img, index) => {
    if (img.src && img.src.length > 0) {
      // Skip very small images (likely icons or UI elements)
      if (img.naturalWidth > 100 && img.naturalHeight > 100) {
        images.push({
          index: index,
          alt: img.alt || '',
          thumbnailUrl: img.src,
          fullSizeUrl: img.src,
          maxWidth: img.naturalWidth || 0
        });
      }
    }
  });

  console.log('[Content] Found', images.length, 'images in Facebook post');
  return images;
}

/**
 * Set up message handling
 */
function setupMessageHandling() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Content] Received message:', request);

    // Handle extract images message
    if (request.action === 'EXTRACT_IMAGES') {
      console.log('[Content] Processing EXTRACT_IMAGES request...');

      handleExtractImages()
        .then(result => {
          console.log('[Content] Sending success response:', result);
          sendResponse(result); // Send the result directly since it already has success: true
        })
        .catch(error => {
          console.error('[Content] Extraction failed:', error);
          const errorResponse = {
            success: false,
            error: error.message,
            count: 0
          };
          console.log('[Content] Sending error response:', errorResponse);
          sendResponse(errorResponse);
        });
      return true; // Keep message channel open for async response
    }

    console.log('[Content] Unknown message action:', request.action);
    return false;
  });
}

/**
 * Handle extract images request
 */
async function handleExtractImages() {
  try {
    console.log('[Content] Handling extract images request...');

    const platform = detectPlatform();

    if (!platform) {
      throw new Error(`Unsupported platform: ${window.location.hostname}`);
    }

    console.log('[Content] Platform detected:', platform);

    const images = await extractImagesForPlatform(platform);

    console.log('[Content] Extraction completed:', {
      platform: platform,
      imageCount: images.length,
      images: images.map(img => ({
        alt: img.alt.substring(0, 30) + '...',
        type: img.type,
        dimensions: `${img.maxWidth}px`
      }))
    });

    return {
      success: true,
      images: images,
      count: images.length,
      platform: platform
    };
  } catch (error) {
    console.error('[Content] Error in handleExtractImages:', error);
    throw error;
  }
}

/**
 * Set up fallback handling if initialization fails
 */
function setupFallbackHandling() {
  console.warn('[Content] Setting up fallback handling');

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_IMAGES') {
      sendResponse({
        success: false,
        error: 'Content script initialization failed',
        message: 'Please refresh the page and try again'
      });
      return true;
    }
  });

  // Send error message to background
  chrome.runtime.sendMessage({
    action: 'EXTRACTION_ERROR',
    error: 'Content script initialization failed',
    count: 0
  });
}

/**
 * Cleanup function for page unload
 */
function cleanup() {
  console.log('[Content] Content script cleaned up');
}

// Add a global flag to indicate content script is loaded
window.socialSnapContentScriptLoaded = true;
console.log('[Content] Content script loaded on:', window.location.href);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
