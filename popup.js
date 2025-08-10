// Popup JavaScript

let currentImages = [];

// DOM 元素
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const success = document.getElementById('success');
const content = document.getElementById('content');
const imageCount = document.getElementById('imageCount');
const imagesGrid = document.getElementById('imagesGrid');
const downloadBtn = document.getElementById('downloadBtn');

// 初始化 popup
async function init() {
    try {
        // 首先嘗試從背景腳本獲取已存儲的圖片信息
        const response = await chrome.runtime.sendMessage({ action: 'getCurrentImages' });

        if (response && response.images && response.images.length > 0) {
            displayImages(response.images);
        } else {
            // 如果沒有存儲的圖片信息，嘗試從當前頁面提取
            await extractImagesFromCurrentTab();
        }
    } catch (err) {
        console.error('初始化失敗:', err);
        showError();
    }
}

// 從當前標籤頁提取圖片
async function extractImagesFromCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('threads.com')) {
            showError();
            return;
        }

        // 向 content script 發送消息
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractImages' });

        if (response && response.images && response.images.length > 0) {
            displayImages(response.images);
        } else {
            showError();
        }
    } catch (err) {
        console.error('提取圖片失敗:', err);
        showError();
    }
}

// 顯示圖片
function displayImages(images) {
    currentImages = images;

    // 隱藏載入和錯誤訊息
    loading.style.display = 'none';
    error.style.display = 'none';

    // 顯示圖片數量
    imageCount.textContent = `找到 ${images.length} 張圖片`;

    // 清空並填充圖片網格
    imagesGrid.innerHTML = '';

        images.forEach((image, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';

        const img = document.createElement('img');
        img.src = image.thumbnailUrl;
        img.alt = `圖片 ${index + 1}`;
        img.title = image.alt;
        img.crossOrigin = 'anonymous'; // 嘗試處理 CORS

        // 創建下載覆蓋層
        const downloadOverlay = document.createElement('div');
        downloadOverlay.className = 'download-overlay';
        downloadOverlay.textContent = '點擊下載';

        console.log(`載入縮圖 ${index + 1}:`, image.thumbnailUrl);

        // 處理圖片載入錯誤
        img.onerror = function() {
            console.log(`縮圖載入失敗 ${index + 1}，嘗試原始 URL:`, image.thumbnailUrl);

            // 先嘗試原始的 src URL
            if (this.src !== image.fullSizeUrl) {
                this.src = image.fullSizeUrl;
                return;
            }

            // 如果還是失敗，顯示預設圖片
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjBGMkY1Ii8+CjxwYXRoIGQ9Ik01MCA3NUMzOS4yIDc1IDI4LjkgNzAuNyAyMS4yIDYzQzEzLjUgNTUuMyA5LjIgNDUgOS4yIDM0LjJDOS4yIDIzLjQgMTMuNSAxMy4xIDIxLjIgNS40QzI4LjkgLTIuMyAzOS4yIC02LjYgNTAgLTYuNkM2MC44IC02LjYgNzEuMSAtMi4zIDc4LjggNS40Qzg2LjUgMTMuMSA5MC44IDIzLjQgOTAuOCAzNC4yQzkwLjggNDUgODYuNSA1NS4zIDc4LjggNjNDNzEuMSA3MC43IDYwLjggNzUgNTAgNzVaTTUwIDY3QzU4LjMgNjcgNjYuMiA2My44IDcyIDU4Qzc3LjggNTIuMiA4MSA0NC4zIDgxIDM2QzgxIDI3LjcgNzcuOCAxOS44IDcyIDE0QzY2LjIgOC4yIDU4LjMgNSA1MCA1QzQxLjcgNSAzMy44IDguMiAyOCAxNEMyMi4yIDE5LjggMTkgMjcuNyAxOSAzNkMxOSA0NC4zIDIyLjIgNTIuMiAyOCA1OEMzMy44IDYzLjggNDEuNyA2NyA1MCA2N1oiIGZpbGw9IiNDQ0QyRDkiLz4KPHBhdGggZD0iTTQzIDU1SDU3VjQxSDQzVjU1Wk00MyA2M0g1N1Y1NUg0M1Y2M1pNNDMgNTVINDNWMjlINTdWNDFINDNWNTVaIiBmaWxsPSIjQ0NEMkQ5Ii8+Cjx0ZXh0IHg9IjUwIiB5PSIyNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiNDQ0QyRDkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuWcluePjzwvdGV4dD4KPC9zdmc+';
        };

        // 添加點擊事件來下載單張圖片
        imageItem.addEventListener('click', async () => {
            try {
                downloadOverlay.textContent = '下載中...';

                await chrome.runtime.sendMessage({
                    action: 'downloadSingleImage',
                    image: image,
                    index: index + 1
                });

                downloadOverlay.textContent = '已下載';
                setTimeout(() => {
                    downloadOverlay.textContent = '點擊下載';
                }, 1500);

            } catch (error) {
                console.error('單張下載失敗:', error);
                downloadOverlay.textContent = '下載失敗';
                setTimeout(() => {
                    downloadOverlay.textContent = '點擊下載';
                }, 1500);
            }
        });

        imageItem.appendChild(img);
        imageItem.appendChild(downloadOverlay);
        imagesGrid.appendChild(imageItem);
    });

    // 顯示內容區域
    content.style.display = 'block';
}

// 顯示錯誤
function showError() {
    loading.style.display = 'none';
    error.style.display = 'block';
    content.style.display = 'none';
}

// 顯示成功訊息
function showSuccess() {
    success.style.display = 'block';
    setTimeout(() => {
        success.style.display = 'none';
    }, 3000);
}

// 下載按鈕點擊事件
downloadBtn.addEventListener('click', async () => {
    if (currentImages.length === 0) {
        return;
    }

    try {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '下載中...';

        // 發送下載請求到背景腳本
        await chrome.runtime.sendMessage({
            action: 'downloadImages',
            images: currentImages
        });

        showSuccess();

        // 重置按鈕
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.textContent = '下載所有圖片';
        }, 2000);

    } catch (err) {
        console.error('下載失敗:', err);
        downloadBtn.disabled = false;
        downloadBtn.textContent = '下載失敗，請重試';

        setTimeout(() => {
            downloadBtn.textContent = '下載所有圖片';
        }, 2000);
    }
});

// 初始化
init();
