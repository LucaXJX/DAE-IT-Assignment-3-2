/**
 * 主程式入口
 * 習作一：自動搜集圖像數據集與初步處理
 * 主題：世界各地的特色美食
 */

import { ImageScraper } from './ImageScraper';
import { ImageDownloader } from './ImageDownloader';
import { ImageProcessor } from './ImageProcessor';
import { SEARCH_CONFIG } from './config';
import * as dbHelper from './database-helper';

/**
 * 主控制類
 */
class ImageCollectionApp {
  private scraper: ImageScraper;
  private downloader: ImageDownloader;
  private processor: ImageProcessor;

  constructor() {
    console.log('='.repeat(60));
    console.log('📸 圖像數據集自動收集系統');
    console.log('主題：世界各地的特色美食');
    console.log('使用 quick-erd + better-sqlite3-proxy');
    console.log('='.repeat(60));

    this.scraper = new ImageScraper();
    this.downloader = new ImageDownloader();
    this.processor = new ImageProcessor();
  }

  /**
   * 步驟 1: 搜索並收集圖像 URL
   */
  async searchAndCollectImages(): Promise<void> {
    console.log('\n📍 步驟 1: 搜索並收集圖像 URL');
    console.log('-'.repeat(60));

    await this.scraper.initialize();

    const images = await this.scraper.scrapeMultipleKeywords(
      SEARCH_CONFIG.keywords,
      SEARCH_CONFIG.targetCount
    );

    console.log(`\n💾 正在保存 ${images.length} 個圖像 URL 到數據庫...`);
    const savedCount = dbHelper.insertImagesBatch(images);
    console.log(`✅ 成功保存 ${savedCount} 個新 URL`);

    await this.scraper.close();
  }

  /**
   * 步驟 2: 下載圖像
   */
  async downloadImages(): Promise<void> {
    console.log('\n📍 步驟 2: 下載圖像');
    console.log('-'.repeat(60));

    await this.downloader.downloadPendingImages();
  }

  /**
   * 步驟 3: 處理圖像
   */
  async processImages(): Promise<void> {
    console.log('\n📍 步驟 3: 處理圖像');
    console.log('-'.repeat(60));

    // 獲取已下載但未處理的圖像
    const downloadedImages = dbHelper.getImagesByStatus('downloaded', 'pending');

    if (downloadedImages.length === 0) {
      console.log('📭 沒有待處理的圖像');
      return;
    }

    await this.processor.processImagesBatch(downloadedImages as any);
  }

  /**
   * 顯示統計信息
   */
  showStatistics(): void {
    console.log('\n📊 統計信息');
    console.log('='.repeat(60));

    const stats = dbHelper.getStatistics();

    console.log(`總收集 URL 數量:     ${stats.totalCollected}`);
    console.log(`成功下載數量:        ${stats.totalDownloaded}`);
    console.log(`下載失敗數量:        ${stats.downloadFailed}`);
    console.log(`成功處理數量:        ${stats.totalProcessed}`);
    console.log(`處理失敗數量:        ${stats.processFailed}`);
    console.log(`平均檔案大小:        ${(stats.averageFileSize / 1024).toFixed(2)} KB`);

    console.log('='.repeat(60));
  }

  /**
   * 執行完整流程
   */
  async run(): Promise<void> {
    const startTime = Date.now();

    try {
      // 步驟 1: 搜索並收集圖像 URL
      await this.searchAndCollectImages();

      // 步驟 2: 下載圖像
      await this.downloadImages();

      // 步驟 3: 處理圖像
      await this.processImages();

      // 顯示統計信息
      this.showStatistics();

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
      console.log(`\n✅ 全部完成！總耗時: ${duration} 分鐘`);

    } catch (error: any) {
      console.error('\n❌ 發生錯誤:', error.message);
      console.error(error.stack);
    }
  }
}

/**
 * 程式入口點
 */
async function main() {
  const app = new ImageCollectionApp();
  await app.run();
}

// 執行主程式
main().catch((error) => {
  console.error('❌ 程式執行失敗:', error);
  process.exit(1);
});
