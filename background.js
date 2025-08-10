// Background Service Worker

// 存儲當前頁面的圖片信息
let currentImages = [];

// 監聽來自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'imagesExtracted') {
        currentImages = request.images;
        console.log(`背景腳本收到 ${request.count} 張圖片信息`);
    }
});

// 處理下載請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadImages') {
        downloadAllImages(request.images);
        sendResponse({ success: true });
    } else if (request.action === 'downloadSingleImage') {
        downloadSingleImage(request.image, request.index);
        sendResponse({ success: true });
    }
});

// 從 URL 中推測文件類型
function getFileExtensionFromUrl(url) {
    try {
        // 嘗試從 URL 路徑中提取副檔名
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const match = pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        if (match) {
            return match[1].toLowerCase();
        }

        // 檢查 URL 參數中是否有格式信息
        const searchParams = urlObj.searchParams;
        if (searchParams.has('format')) {
            return searchParams.get('format');
        }

        // 檢查 URL 中是否包含格式信息
        if (url.includes('jpg') || url.includes('jpeg')) return 'jpg';
        if (url.includes('png')) return 'png';
        if (url.includes('webp')) return 'webp';
        if (url.includes('gif')) return 'gif';

        // 預設為 jpg
        return 'jpg';
    } catch (error) {
        console.log('無法解析 URL，使用預設副檔名 jpg');
        return 'jpg';
    }
}

// 下載所有圖片的函數
async function downloadAllImages(images) {
    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        try {
            // 生成文件名
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const extension = getFileExtensionFromUrl(image.fullSizeUrl);
            const filename = `threads_image_${timestamp}_${i + 1}.${extension}`;

            // 開始下載
            await chrome.downloads.download({
                url: image.fullSizeUrl,
                filename: filename
            });

            console.log(`下載圖片 ${i + 1}/${images.length}: ${filename}`);

            // 添加小延遲避免同時下載太多文件
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`下載圖片 ${i + 1} 失敗:`, error);
        }
    }
}

// 下載單張圖片的函數
async function downloadSingleImage(image, index) {
    try {
        // 生成文件名
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const extension = getFileExtensionFromUrl(image.fullSizeUrl);
        const filename = `threads_image_${timestamp}_${index}.${extension}`;

        // 開始下載
        await chrome.downloads.download({
            url: image.fullSizeUrl,
            filename: filename
        });

        console.log(`下載單張圖片: ${filename}`);
    } catch (error) {
        console.error(`下載單張圖片失敗:`, error);
    }
}

// 獲取當前圖片信息的函數
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCurrentImages') {
        sendResponse({ images: currentImages });
    }
});
