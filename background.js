// Background Service Worker

// Store current page's image information
let currentImages = [];

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'imagesExtracted') {
    currentImages = request.images;
    console.log(`Background script received ${request.count} image information`);
  }
});

// Handle download requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImages') {
    downloadAllImages(request.images);
    sendResponse({ success: true });
  } else if (request.action === 'downloadSingleImage') {
    downloadSingleImage(request.image, request.index);
    sendResponse({ success: true });
  }
});

// Infer file type from URL
function getFileExtensionFromUrl(url) {
  try {
    // Try to extract file extension from URL path
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    if (match) {
      return match[1].toLowerCase();
    }

    // Check if URL parameters contain format information
    const searchParams = urlObj.searchParams;
    if (searchParams.has('format')) {
      return searchParams.get('format');
    }

    // Check if URL contains format information
    if (url.includes('jpg') || url.includes('jpeg')) return 'jpg';
    if (url.includes('png')) return 'png';
    if (url.includes('webp')) return 'webp';
    if (url.includes('gif')) return 'gif';

    // Default to jpg
    return 'jpg';
  } catch (error) {
    console.log('Unable to parse URL, using default extension jpg');
    return 'jpg';
  }
}

// Function to download all images
async function downloadAllImages(images) {
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const extension = getFileExtensionFromUrl(image.fullSizeUrl);
      const filename = `threads_image_${timestamp}_${i + 1}.${extension}`;

      // Start download
      await chrome.downloads.download({
        url: image.fullSizeUrl,
        filename
      });

      console.log(`Download image ${i + 1}/${images.length}: ${filename}`);

      // Add small delay to avoid downloading too many files simultaneously
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Download image ${i + 1} failed:`, error);
    }
  }
}

// Function to download single image
async function downloadSingleImage(image, index) {
  try {
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const extension = getFileExtensionFromUrl(image.fullSizeUrl);
    const filename = `threads_image_${timestamp}_${index}.${extension}`;

    // Start download
    await chrome.downloads.download({
      url: image.fullSizeUrl,
      filename
    });

    console.log(`Download single image: ${filename}`);
  } catch (error) {
    console.error('Download single image failed:', error);
  }
}

// Function to get current image information
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentImages') {
    sendResponse({ images: currentImages });
  }
});
