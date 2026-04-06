function getFileExtension(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|mp4)$/i);
    if (match) {
      return match[1].toLowerCase();
    }

    const searchParams = urlObj.searchParams;
    if (searchParams.has('format')) {
      return searchParams.get('format');
    }

    if (url.includes('mp4')) return 'mp4';
    if (url.includes('jpg') || url.includes('jpeg')) return 'jpg';
    if (url.includes('png')) return 'png';
    if (url.includes('webp')) return 'webp';
    if (url.includes('gif')) return 'gif';

    return 'jpg';
  } catch {
    console.log('Unable to parse URL, using default extension jpg');
    return 'jpg';
  }
}

function getPlatformFromUrl(url) {
  if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.THREADS])) {
    return PLATFORMS.THREADS;
  } else if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.INSTAGRAM])) {
    return PLATFORMS.INSTAGRAM;
  } else if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.FACEBOOK])) {
    return PLATFORMS.FACEBOOK;
  } else if (url.includes(PLATFORM_HOSTNAMES[PLATFORMS.X])) {
    return PLATFORMS.X;
  }
  return null;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getFileExtension, getPlatformFromUrl, wait };
}
