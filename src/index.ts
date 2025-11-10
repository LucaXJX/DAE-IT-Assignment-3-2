/**
 * 主程式入口
 * 習作一：自動搜集圖像數據集與初步處理
 * 主題：世界各地的特色美食
 */

import { ImageScraper } from "./ImageScraper";
import { PexelsScraper } from "./PexelsScraper";
import { ImageDownloader } from "./ImageDownloader";
import { ImageProcessor } from "./ImageProcessor";
import { SEARCH_CONFIG, IMAGE_SOURCE, PEXELS_CONFIG } from "./config";
import * as dbHelper from "./database-helper";

/**
 * 主控制類
 */
class ImageCollectionApp {
  private googleScraper: ImageScraper;
  private pexelsScraper: PexelsScraper | null = null;
  private downloader: ImageDownloader;
  private processor: ImageProcessor;

  constructor() {
    console.log("=".repeat(60));
    console.log("📸 圖像數據集自動收集系統");
    console.log("主題：世界各地的特色美食");
    console.log(`圖像來源：${IMAGE_SOURCE.toUpperCase()}`);
    console.log("使用 quick-erd + better-sqlite3-proxy");
    console.log("=".repeat(60));

    this.googleScraper = new ImageScraper();

    // 根據配置初始化 Pexels Scraper
    if (IMAGE_SOURCE === "pexels") {
      try {
        this.pexelsScraper = new PexelsScraper(PEXELS_CONFIG.apiKey);
        console.log("✅ Pexels API 已初始化");
      } catch (error: any) {
        console.error("❌ Pexels API 初始化失敗:", error.message);
        console.log("💡 請在 src/config.ts 中設定 PEXELS_CONFIG.apiKey");
        process.exit(1);
      }
    }

    this.downloader = new ImageDownloader();
    this.processor = new ImageProcessor();
  }

  /**
   * 步驟 1: 搜索並收集圖像 URL
   */
  async searchAndCollectImages(): Promise<void> {
    console.log("\n📍 步驟 1: 搜索並收集圖像 URL");
    console.log("-".repeat(60));

    let images: any[] = [];

    if (IMAGE_SOURCE === "pexels") {
      // 使用 Pexels API
      console.log("🌐 使用 Pexels API 搜索...");

      if (!this.pexelsScraper) {
        throw new Error("Pexels Scraper 未初始化");
      }

      images = await this.pexelsScraper.scrapeMultipleKeywords(
        SEARCH_CONFIG.keywords,
        SEARCH_CONFIG.targetCount
      );
    } else {
      // 使用 Google Images (Playwright)
      console.log("🌐 使用 Google Images 搜索...");

      await this.googleScraper.initialize();

      images = await this.googleScraper.scrapeMultipleKeywords(
        SEARCH_CONFIG.keywords,
        SEARCH_CONFIG.targetCount
      );

      await this.googleScraper.close();
    }

    console.log(`\n💾 正在保存 ${images.length} 個圖像 URL 到數據庫...`);
    const savedCount = dbHelper.insertImagesBatch(images);
    console.log(`✅ 成功保存 ${savedCount} 個新 URL`);
  }

  /**
   * 步驟 2: 下載圖像
   */
  async downloadImages(): Promise<void> {
    console.log("\n📍 步驟 2: 下載圖像");
    console.log("-".repeat(60));

    await this.downloader.downloadPendingImages();
  }

  /**
   * 步驟 3: 處理圖像
   */
  async processImages(): Promise<void> {
    console.log("\n📍 步驟 3: 處理圖像");
    console.log("-".repeat(60));

    // 獲取已下載但未處理的圖像
    const downloadedImages = dbHelper.getImagesByStatus(
      "downloaded",
      "pending"
    );

    if (downloadedImages.length === 0) {
      console.log("📭 沒有待處理的圖像");
      return;
    }

    await this.processor.processImagesBatch(downloadedImages as any);
  }

  /**
   * 顯示統計信息
   */
  showStatistics(): void {
    console.log("\n📊 統計信息");
    console.log("=".repeat(60));

    const stats = dbHelper.getStatistics();

    console.log(`總收集 URL 數量:     ${stats.totalCollected}`);
    console.log(`成功下載數量:        ${stats.totalDownloaded}`);
    console.log(`下載失敗數量:        ${stats.downloadFailed}`);
    console.log(`成功處理數量:        ${stats.totalProcessed}`);
    console.log(`處理失敗數量:        ${stats.processFailed}`);
    console.log(
      `平均檔案大小:        ${(stats.averageFileSize / 1024).toFixed(2)} KB`
    );

    // 顯示各國家統計
    console.log("\n📍 各國家收集數量:");
    const countryStats = dbHelper.getCountryStatistics();
    countryStats.forEach((stat) => {
      console.log(`   ${stat.country.padEnd(15)} : ${stat.count} 張`);
    });

    console.log("=".repeat(60));
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
      console.error("\n❌ 發生錯誤:", error.message);
      console.error(error.stack);
    }
  }
}

/**
 * 程式入口點
 */
async function main() {
  const app = new ImageCollectionApp();

  // 解析命令列參數
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "--scrape":
        console.log("🔍 僅執行：搜索收集");
        await app.searchAndCollectImages();
        app.showStatistics();
        break;

      case "--download":
        console.log("⬇️  僅執行：下載圖像");
        await app.downloadImages();
        app.showStatistics();
        break;

      case "--process":
        console.log("🖼️  僅執行：處理圖像");
        await app.processImages();
        app.showStatistics();
        break;

      default:
        // 無參數或其他參數：執行完整流程
        await app.run();
        break;
    }
  } catch (error: any) {
    console.error("❌ 程式執行失敗:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行主程式
main();
