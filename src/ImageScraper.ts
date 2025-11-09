/**
 * 圖像搜索類
 * 使用 Playwright 自動化搜索 Google Images 並收集圖像 URL 和 alt 文字
 */

import { chromium, Browser, Page } from 'playwright';
import type { Images } from './proxy';
import { SEARCH_CONFIG } from './config';

export class ImageScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * 初始化瀏覽器
   */
  async initialize(): Promise<void> {
    console.log('🚀 正在啟動瀏覽器...');
    this.browser = await chromium.launch({
      headless: false, // 設置為 false 可以看到瀏覽器操作過程
    });
    this.page = await this.browser.newPage();
    console.log('✅ 瀏覽器啟動完成');
  }

  /**
   * 搜索並收集圖像
   */
  async scrapeImages(keyword: string, targetCount: number): Promise<Partial<Images>[]> {
    if (!this.page) {
      throw new Error('瀏覽器未初始化，請先調用 initialize()');
    }

    console.log(`\n🔍 開始搜索關鍵字: "${keyword}"`);
    const images: Partial<Images>[] = [];
    const seenUrls = new Set<string>();

    try {
      // 訪問 Google Images
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&tbm=isch`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle' });

      // 等待圖像加載
      await this.page.waitForSelector('img', { timeout: 5000 });

      let scrollCount = 0;
      let noNewImagesCount = 0;

      while (images.length < targetCount && scrollCount < (SEARCH_CONFIG.maxScrolls || 50)) {
        // 滾動頁面以加載更多圖像
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });

        // 等待新圖像加載
        await this.page.waitForTimeout(SEARCH_CONFIG.scrollDelay || 1000);

        // 提取圖像數據
        const newImages = await this.page.evaluate(() => {
          const imgElements = Array.from(document.querySelectorAll('img'));
          return imgElements
            .map((img: any) => ({
              url: img.src || img.getAttribute('data-src') || '',
              alt: img.alt || '',
            }))
            .filter((item: any) => {
              // 過濾有效的圖像 URL
              return (
                item.url &&
                item.url.startsWith('http') &&
                !item.url.includes('google.com/images/branding') &&
                !item.url.includes('gstatic.com')
              );
            });
        });

        // 去重並添加新圖像
        let addedCount = 0;
        for (const img of newImages) {
          if (!seenUrls.has(img.url) && images.length < targetCount) {
            seenUrls.add(img.url);
            images.push({
              url: img.url,
              alt_text: img.alt || '',
              file_name: '',
              download_status: 'pending',
              process_status: 'pending',
              file_size: 0,
              width: 0,
              height: 0,
              error_message: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            addedCount++;
          }
        }

        if (addedCount === 0) {
          noNewImagesCount++;
          if (noNewImagesCount >= 3) {
            console.log('⚠️  連續 3 次未發現新圖像，停止滾動');
            break;
          }
        } else {
          noNewImagesCount = 0;
        }

        scrollCount++;
        console.log(`   已收集: ${images.length}/${targetCount} (滾動 ${scrollCount} 次)`);

        // 嘗試點擊 "顯示更多結果" 按鈕（如果存在）
        try {
          const moreButton = await this.page.$('input[value="顯示更多結果"], input[value="Show more results"]');
          if (moreButton) {
            await moreButton.click();
            await this.page.waitForTimeout(2000);
          }
        } catch (e) {
          // 按鈕不存在或無法點擊，繼續
        }
      }

      console.log(`✅ 關鍵字 "${keyword}" 完成，共收集 ${images.length} 張圖像`);
      return images;

    } catch (error: any) {
      console.error(`❌ 搜索關鍵字 "${keyword}" 時發生錯誤:`, error.message);
      return images;
    }
  }

  /**
   * 使用多個關鍵字搜索圖像
   */
  async scrapeMultipleKeywords(keywords: string[], totalTarget: number): Promise<Partial<Images>[]> {
    const allImages: Partial<Images>[] = [];
    const perKeywordTarget = Math.ceil(totalTarget / keywords.length);

    console.log(`\n📊 計劃使用 ${keywords.length} 個關鍵字，每個收集約 ${perKeywordTarget} 張圖像`);

    for (const keyword of keywords) {
      const images = await this.scrapeImages(keyword, perKeywordTarget);
      allImages.push(...images);

      if (allImages.length >= totalTarget) {
        console.log(`\n✅ 已達到目標數量 ${totalTarget}，停止搜索`);
        break;
      }
    }

    return allImages.slice(0, totalTarget);
  }

  /**
   * 關閉瀏覽器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ 瀏覽器已關閉');
    }
  }
}

