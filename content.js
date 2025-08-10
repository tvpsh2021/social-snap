// Content Script: 提取 Threads 頁面中的圖片信息

function extractThreadsImages() {
    console.log('=== 開始提取 Threads 圖片 ===');

    // 策略 1: 尋找 picture 標籤中的圖片
    const pictureImages = document.querySelectorAll('picture img');
    console.log('策略 1 - picture 標籤中的圖片:', pictureImages.length);

    // 策略 2: 尋找包含中文描述的圖片
    const chineseImages = document.querySelectorAll('img[alt*="可能是"]');
    console.log('策略 2 - 包含中文描述的圖片:', chineseImages.length);

    // 策略 3: 組合 - picture 中包含中文描述的圖片
    const pictureChineseImages = document.querySelectorAll('picture img[alt*="可能是"]');
    console.log('策略 3 - picture 中的中文描述圖片:', pictureChineseImages.length);

    // 嘗試區分主貼文和留言區
    // 主貼文通常在頁面的上半部分，或者在特定的容器中
    let mainPostImages = [];

    // 方法 1: 尋找主貼文容器
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
                console.log(`在容器 "${selector}" 中找到 ${containerImages.length} 張圖片`);
                mainPostImages = Array.from(containerImages);
                break;
            }
        }
    }

    // 方法 2: 如果沒找到容器，使用位置判斷
    if (mainPostImages.length === 0) {
        console.log('使用位置判斷方法...');
        const allPictureImages = Array.from(pictureChineseImages);

                // 分析每張圖片的上下文，判斷是否為主貼文圖片
        const imagesWithPosition = allPictureImages.map(img => {
            const rect = img.getBoundingClientRect();

            // 更精確的留言檢測邏輯
            const isInComment =
                // 檢查是否在留言相關的容器中
                img.closest('[data-testid*="comment"]') ||
                img.closest('[data-testid*="reply"]') ||
                img.closest('[role="article"]')?.querySelector('[data-testid*="reply"]') ||
                // 檢查父級元素是否包含留言相關的類名或屬性
                img.closest('div[class*="comment"]') ||
                img.closest('div[class*="reply"]') ||
                // 檢查是否在用戶名連結附近（留言通常跟在用戶名後面）
                (() => {
                    const userLink = img.closest('div')?.querySelector('a[href*="/@"]');
                    if (userLink) {
                        // 檢查這個用戶連結是否在主貼文作者區域
                        const mainAuthorSection = document.querySelector('[role="main"], main, .main-content')?.querySelector('a[href*="/@"]');
                        if (mainAuthorSection) {
                            // 如果圖片所在區域的用戶連結不是主作者，且距離較遠，可能是留言
                            const isMainAuthor = userLink.href === mainAuthorSection.href;
                            const linkIndex = Array.from(document.querySelectorAll('a')).indexOf(userLink);
                            const mainLinkIndex = Array.from(document.querySelectorAll('a')).indexOf(mainAuthorSection);

                            return !isMainAuthor && (linkIndex > mainLinkIndex + 10);
                        }
                    }
                    return false;
                })() ||
                                // 檢查圖片是否在主貼文區域之後（通過 DOM 順序判斷）
                (() => {
                    // 尋找主貼文的互動按鈕（Like, Reply, Repost, Share）
                    const mainInteractionButtons = document.querySelectorAll('button[aria-label*="Like"], button:has(img[alt="Like"])');
                    if (mainInteractionButtons.length > 0) {
                        const firstInteractionButton = mainInteractionButtons[0];
                        const buttonIndex = Array.from(document.querySelectorAll('*')).indexOf(firstInteractionButton);
                        const imgIndex = Array.from(document.querySelectorAll('*')).indexOf(img.closest('div'));

                        // 如果圖片在第一個互動按鈕之後很多位置，可能是留言區
                        return imgIndex > buttonIndex + 100;
                    }
                    return false;
                })();

            return {
                img: img,
                y: rect.top,
                isInComment: !!isInComment,
                domIndex: Array.from(document.querySelectorAll('img')).indexOf(img),
                alt: img.alt
            };
        });

        // 排序並取前面的圖片（假設是主貼文）
        imagesWithPosition.sort((a, b) => a.domIndex - b.domIndex);

                // 過濾掉明顯是留言區的圖片
        const filteredImages = imagesWithPosition.filter(item => !item.isInComment);

        console.log('位置分析結果:', {
            總圖片數: imagesWithPosition.length,
            過濾後: filteredImages.length,
            留言區圖片: imagesWithPosition.length - filteredImages.length
        });

        // 詳細顯示每張圖片的分析結果
        console.log('圖片分析詳情:');
        imagesWithPosition.forEach((item, index) => {
            console.log(`圖片 ${index + 1}:`, {
                alt: item.alt.substring(0, 50) + '...',
                isInComment: item.isInComment,
                domIndex: item.domIndex,
                保留: !item.isInComment ? '✓' : '✗'
            });
        });

                // 額外的內容過濾：只排除明確的留言區圖片
        const contentFilteredImages = filteredImages.filter(item => {
            const alt = item.alt.toLowerCase();

            // 只排除非常明確的留言區圖片特徵
            const isDefiniteComment =
                // 新聞圖片（通常是留言分享的）
                (alt.includes('연합뉴스') || alt.includes('news')) ||
                // 明顯的多人新聞圖片
                (alt.includes('4 個人') && alt.includes('顯示的文字')) ||
                // 包含大量文字的新聞截圖
                (alt.includes('文字') && alt.includes('4 個人') && alt.includes('顯示'));

            const shouldKeep = !isDefiniteComment;

            if (!shouldKeep) {
                console.log(`過濾掉圖片: ${alt.substring(0, 60)}...`);
            }

            return shouldKeep;
        });

        console.log('內容過濾結果:', {
            原始: filteredImages.length,
            內容過濾後: contentFilteredImages.length
        });

        // 選擇最終的圖片集合
        if (contentFilteredImages.length >= 1) {
            // 優先使用內容過濾後的結果（只要有圖片就使用）
            mainPostImages = contentFilteredImages.map(item => item.img);
            console.log('使用內容過濾後的結果');
        } else if (filteredImages.length >= 1) {
            // 使用位置過濾後的結果
            mainPostImages = filteredImages.map(item => item.img);
            console.log('使用位置過濾後的結果');
        } else {
            // 最後備案：使用所有找到的圖片
            mainPostImages = imagesWithPosition.map(item => item.img);
            console.log('使用所有找到的圖片（無過濾）');
        }

        // 如果圖片數量異常多（可能包含了留言區圖片），給出警告但仍然使用
        if (mainPostImages.length > 20) {
            console.warn(`圖片數量異常多 (${mainPostImages.length} 張)，可能包含留言區圖片`);
        }
    }

    console.log(`最終選定的主貼文圖片數量: ${mainPostImages.length}`);

    const imageData = [];
    const images = mainPostImages;

    images.forEach((img, index) => {
        // 獲取 srcset 中的所有尺寸
        const srcset = img.srcset;
        const src = img.src;
        const alt = img.alt;

                // 解析 srcset 找出最大尺寸
        let maxSizeUrl = src;
        let maxWidth = 0;

        if (srcset) {
            const sources = srcset.split(',').map(s => s.trim());
            console.log(`圖片 ${index + 1} srcset 選項:`, sources);

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
                console.log(`選擇最大尺寸: ${maxWidth}w`);
            }
        }

                        // 處理 Instagram/Meta 圖片 URL - 保留所有必要的安全參數
        let thumbnailUrl = src;

        // 如果沒有找到更大的尺寸，使用原始 src
        if (maxWidth === 0) {
            maxSizeUrl = src; // 直接使用原始 URL，保留所有參數
        }

        // 對於縮圖，嘗試修改尺寸參數而不破壞其他參數
        if (src.includes('instagram.') || src.includes('fbcdn.net')) {
            // Instagram/Facebook CDN 圖片，保留原始 URL 作為縮圖
            // 不要修改參數，因為會破壞安全驗證
            thumbnailUrl = src;

            // 對於下載，也使用原始 URL
            if (maxWidth === 0) {
                maxSizeUrl = src;
            }
        } else {
            // 非 Instagram 圖片，可以安全地修改尺寸參數
            if (thumbnailUrl.includes('?')) {
                const baseUrl = thumbnailUrl.split('?')[0];
                thumbnailUrl = baseUrl + '?width=150&height=150';
            }
        }

        console.log(`圖片 ${index + 1}:`, {
            alt: alt.substring(0, 30) + '...',
            thumbnailUrl: thumbnailUrl,
            fullSizeUrl: maxSizeUrl,
            maxWidth: maxWidth
        });

        imageData.push({
            index: index + 1,
            alt: alt,
            thumbnailUrl: thumbnailUrl, // 用於顯示縮圖
            fullSizeUrl: maxSizeUrl, // 用於下載
            maxWidth: maxWidth
        });
    });

    console.log('提取到的圖片信息：', imageData);
    return imageData;
}

// 監聽來自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractImages') {
        const images = extractThreadsImages();
        sendResponse({ images: images, count: images.length });
    }
});

// 頁面加載完成後自動提取圖片信息
window.addEventListener('load', () => {
    setTimeout(() => {
        const images = extractThreadsImages();
        // 將圖片信息存儲到 chrome.storage 中供 popup 使用
        chrome.runtime.sendMessage({
            action: 'imagesExtracted',
            images: images,
            count: images.length
        });
    }, 2000); // 等待 2 秒確保圖片加載完成
});
