// Content Script: Extract image information from Threads pages

function extractThreadsImages() {
  console.log('=== Starting Threads image extraction ===');

  // Strategy 1: Find images in picture tags
  const pictureImages = document.querySelectorAll('picture img');
  console.log('Strategy 1 - Images in picture tags:', pictureImages.length);

  // Strategy 2: Find images with descriptive alt text
  const chineseImages = document.querySelectorAll('img[alt*="可能是"]');
  console.log('Strategy 2 - Images with descriptive alt text:', chineseImages.length);

  // Strategy 3: Combination - images with descriptive alt text in picture tags
  const pictureChineseImages = document.querySelectorAll('picture img[alt*="可能是"]');
  console.log('Strategy 3 - Descriptive images in picture tags:', pictureChineseImages.length);

  // Try to distinguish main post from comment section
  // Main posts are usually in the upper part of the page or in specific containers
  let mainPostImages = [];

  // Method 1: Find main post container
  const possibleMainContainers = [
    'article[role="article"]:first-of-type',
    '[data-testid*="post"]:first-of-type',
    '[data-testid*="thread"]:first-of-type',
    'main > div:first-child',
    '[role="main"] > div:first-child'
  ];

  for (const selector of possibleMainContainers) {
    const container = document.querySelector(selector);
    if (container) {
      const containerImages = container.querySelectorAll('picture img[alt*="可能是"]');
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
      const isInComment =
                // Check if in comment-related containers
                img.closest('[data-testid*="comment"]') ||
                img.closest('[data-testid*="reply"]') ||
                img.closest('[role="article"]')?.querySelector('[data-testid*="reply"]') ||
                // Check if parent elements contain comment-related class names or attributes
                img.closest('div[class*="comment"]') ||
                img.closest('div[class*="reply"]') ||
                // Check if near username links (comments usually follow usernames)
                (() => {
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
                })() ||
                // Check if image is after the main post area (by DOM order)
                (() => {
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
                })();

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
      const alt = item.alt.toLowerCase();

      // Only exclude very clear comment section image characteristics
      const isDefiniteComment =
                // News images (usually shared in comments)
                (alt.includes('연합뉴스') || alt.includes('news')) ||
                // Obviously multi-person news images
                (alt.includes('4 個人') && alt.includes('顯示的文字')) ||
                // News screenshots containing lots of text
                (alt.includes('文字') && alt.includes('4 個人') && alt.includes('顯示'));

      const shouldKeep = !isDefiniteComment;

      if (!shouldKeep) {
        console.log(`Filtered out image: ${alt.substring(0, 60)}...`);
      }

      return shouldKeep;
    });

    console.log('Content filtering results:', {
      original: filteredImages.length,
      afterContentFiltering: contentFilteredImages.length
    });

    // Select final image collection
    if (contentFilteredImages.length >= 1) {
      // Prioritize content-filtered results (use as long as there are images)
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

    // If image count is abnormally high (might include comment images), give warning but still use
    if (mainPostImages.length > 20) {
      console.warn(`Abnormally high image count (${mainPostImages.length} images), might include comment section images`);
    }
  }

  console.log(`Final selected main post image count: ${mainPostImages.length}`);

  const imageData = [];
  const images = mainPostImages;

  images.forEach((img, index) => {
    // Get all sizes from srcset
    const srcset = img.srcset;
    const src = img.src;
    const alt = img.alt;

    // Parse srcset to find maximum size
    let maxSizeUrl = src;
    let maxWidth = 0;

    if (srcset) {
      const sources = srcset.split(',').map(s => s.trim());
      console.log(`Image ${index + 1} srcset options:`, sources);

      sources.forEach(source => {
        const parts = source.split(' ');
        if (parts.length >= 2) {
          const url = parts[0];
          const descriptor = parts[1];
          if (descriptor.endsWith('w')) {
            const width = parseInt(descriptor.slice(0, -1));
            console.log(`  - ${width}w: ${url.substring(0, 80)}...`);
            if (width > maxWidth) {
              maxWidth = width;
              maxSizeUrl = url;
            }
          }
        }
      });

      if (maxWidth > 0) {
        console.log(`Selected maximum size: ${maxWidth}w`);
      }
    }

    // Handle Instagram/Meta image URLs - preserve all necessary security parameters
    let thumbnailUrl = src;

    // If no larger size found, use original src
    if (maxWidth === 0) {
      maxSizeUrl = src; // Use original URL directly, preserving all parameters
    }

    // For thumbnails, try to modify size parameters without breaking other parameters
    if (src.includes('instagram.') || src.includes('fbcdn.net')) {
      // Instagram/Facebook CDN images, keep original URL as thumbnail
      // Don't modify parameters as it would break security validation
      thumbnailUrl = src;

      // For download, also use original URL
      if (maxWidth === 0) {
        maxSizeUrl = src;
      }
    } else {
      // Non-Instagram images, can safely modify size parameters
      if (thumbnailUrl.includes('?')) {
        const baseUrl = thumbnailUrl.split('?')[0];
        thumbnailUrl = baseUrl + '?width=150&height=150';
      }
    }

    console.log(`Image ${index + 1}:`, {
      alt: alt.substring(0, 30) + '...',
      thumbnailUrl,
      fullSizeUrl: maxSizeUrl,
      maxWidth
    });

    imageData.push({
      index: index + 1,
      alt,
      thumbnailUrl, // For displaying thumbnails
      fullSizeUrl: maxSizeUrl, // For downloading
      maxWidth
    });
  });

  console.log('Extracted image information:', imageData);
  return imageData;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractImages') {
    const images = extractThreadsImages();
    sendResponse({ images, count: images.length });
  }
});

// Automatically extract image information after page load
window.addEventListener('load', () => {
  setTimeout(() => {
    const images = extractThreadsImages();
    // Store image information in chrome.storage for popup use
    chrome.runtime.sendMessage({
      action: 'imagesExtracted',
      images,
      count: images.length
    });
  }, 2000); // Wait 2 seconds to ensure images are loaded
});
