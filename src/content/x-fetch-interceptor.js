/**
 * X.com fetch interceptor (MAIN world)
 * Intercepts Twitter GraphQL API responses to extract direct video MP4 URLs.
 * Communicates with the isolated-world content script via CustomEvent on document.
 */
(function () {
  const videoCache = new Map(); // videoId -> { fullSizeUrl, thumbnailUrl }

  function traverseForVideoInfo(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (obj.video_info && Array.isArray(obj.video_info.variants)) {
      const mp4Variants = obj.video_info.variants
        .filter(v => v.content_type === 'video/mp4' && v.bitrate != null)
        .sort((a, b) => b.bitrate - a.bitrate);

      let fullSizeUrl = null;
      let isHLS = false;

      if (mp4Variants.length > 0) {
        fullSizeUrl = mp4Variants[0].url;
      } else {
        // Fallback: Twitter amplify_video uses HLS-only with no direct MP4 variant.
        // Pick the highest-bitrate m3u8, or master.m3u8, or the first available.
        const m3u8Variants = obj.video_info.variants
          .filter(v => v.content_type === 'application/x-mpegURL');
        const sorted = m3u8Variants
          .filter(v => v.bitrate != null)
          .sort((a, b) => b.bitrate - a.bitrate);
        const best = sorted[0]
          || m3u8Variants.find(v => v.url.includes('master'))
          || m3u8Variants[0];
        if (best) {
          fullSizeUrl = best.url;
          isHLS = true;
        }
      }

      if (fullSizeUrl) {
        const thumbnailUrl = obj.media_url_https || '';

        // Extract video ID from the URL, or fall back to the thumbnail URL.
        let videoId = null;
        const urlIdMatch = fullSizeUrl.match(/\/(amplify_video|ext_tw_video|tweet_video)\/([^/]+)\//);
        if (urlIdMatch) {
          videoId = urlIdMatch[2];
        } else if (thumbnailUrl) {
          const thumbIdMatch = thumbnailUrl.match(/\/(amplify_video_thumb|amplify_video|ext_tw_video|tweet_video_thumb|tweet_video)\/([^/]+)\//);
          if (thumbIdMatch) videoId = thumbIdMatch[2];
        }

        if (videoId && !videoCache.has(videoId)) {
          videoCache.set(videoId, { fullSizeUrl, thumbnailUrl, isHLS });
          document.dispatchEvent(new CustomEvent('__socialSnapXVideo', {
            detail: { videoId, fullSizeUrl, thumbnailUrl, isHLS }
          }));
        }
      }
    }

    if (Array.isArray(obj)) {
      obj.forEach(traverseForVideoInfo);
    } else {
      for (const key of Object.keys(obj)) {
        try { traverseForVideoInfo(obj[key]); } catch (_) {}
      }
    }
  }

  // Respond to cache dump requests from the isolated world content script
  document.addEventListener('__socialSnapRequestVideos', () => {
    const cache = {};
    videoCache.forEach((data, id) => { cache[id] = data; });
    document.dispatchEvent(new CustomEvent('__socialSnapXVideoCache', {
      detail: cache
    }));
  });

  // Also intercept XMLHttpRequest in case Twitter uses XHR for some API calls.
  const OriginalXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OriginalXHR();
    let xhrUrl = '';

    const originalOpen = xhr.open.bind(xhr);
    xhr.open = function (method, url, ...rest) {
      xhrUrl = url || '';
      return originalOpen(method, url, ...rest);
    };

    xhr.addEventListener('load', function () {
      const isApiCall = xhrUrl.includes('/graphql/')
        || xhrUrl.includes('/i/api/')
        || xhrUrl.includes('api.twitter.com')
        || xhrUrl.includes('api.x.com');
      if (!isApiCall) return;
      try {
        const data = JSON.parse(xhr.responseText);
        traverseForVideoInfo(data);
      } catch (_) {}
    });

    return xhr;
  }
  PatchedXHR.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  const originalFetch = window.fetch;
  window.fetch = async function () {
    const response = await originalFetch.apply(this, arguments);
    const resource = arguments[0];
    const url = typeof resource === 'string' ? resource : (resource?.url || '');

    // Intercept GraphQL and REST API calls that may carry video_info.variants.
    // amplify_video may come from /i/api/ REST endpoints rather than /graphql/.
    const isApiCall = url.includes('/graphql/')
      || url.includes('/i/api/')
      || url.includes('api.twitter.com')
      || url.includes('api.x.com');

    if (isApiCall) {
      try {
        response.clone().json().then(traverseForVideoInfo).catch(() => {});
      } catch (_) {}
    }

    return response;
  };
})();
