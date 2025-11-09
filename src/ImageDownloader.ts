/**
 * 圖像下載類
 * 負責從 URL 下載圖像到本地資料夾
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import type { Images } from "./proxy";
import { PATHS, DOWNLOAD_CONFIG } from "./config";
import * as dbHelper from "./database-helper";

export class ImageDownloader {
  constructor() {
    // 確保原始圖像目錄存在
    if (!fs.existsSync(PATHS.IMAGES_RAW)) {
      fs.mkdirSync(PATHS.IMAGES_RAW, { recursive: true });
    }
  }

  /**
   * 下載單個圖像
   */
  async downloadImage(image: Images): Promise<boolean> {
    if (!image.id) {
      console.error("❌ 圖像 ID 不存在");
      return false;
    }

    try {
      // 生成檔案名稱
      const fileName = `image_${image.id}_${Date.now()}.jpg`;
      const filePath = path.join(PATHS.IMAGES_RAW, fileName);

      // 下載圖像
      await this.downloadFile(image.url, filePath);

      // 更新數據庫
      dbHelper.updateImage(image.id, {
        file_name: fileName,
        download_status: "downloaded",
      });

      return true;
    } catch (error: any) {
      // 記錄錯誤
      if (image.id) {
        dbHelper.updateImage(image.id, {
          download_status: "failed",
          error_message: error.message,
        });
      }

      return false;
    }
  }

  /**
   * 下載文件的輔助方法
   */
  private downloadFile(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith("https") ? https : http;
      const timeout = DOWNLOAD_CONFIG.timeout;

      const request = protocol.get(
        url,
        {
          headers: {
            "User-Agent": DOWNLOAD_CONFIG.userAgent,
          },
          timeout: timeout,
        },
        (response) => {
          // 檢查狀態碼
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `HTTP ${response.statusCode}: ${response.statusMessage}`
              )
            );
            return;
          }

          // 檢查內容類型
          const contentType = response.headers["content-type"];
          if (!contentType || !contentType.startsWith("image/")) {
            reject(new Error(`無效的內容類型: ${contentType}`));
            return;
          }

          // 將響應寫入文件
          const fileStream = fs.createWriteStream(filePath);
          response.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close();
            resolve();
          });

          fileStream.on("error", (err) => {
            fs.unlink(filePath, () => {}); // 刪除不完整的文件
            reject(err);
          });
        }
      );

      request.on("error", (err) => {
        reject(err);
      });

      request.on("timeout", () => {
        request.destroy();
        reject(new Error("下載超時"));
      });
    });
  }

  /**
   * 批量下載圖像（帶並發控制）
   */
  async downloadImagesBatch(
    images: Images[],
    concurrency: number = DOWNLOAD_CONFIG.concurrency
  ): Promise<void> {
    console.log(
      `\n⬇️  開始下載 ${images.length} 張圖像（並發數: ${concurrency}）`
    );

    let completed = 0;
    let succeeded = 0;
    let failed = 0;

    // 並發控制
    const tasks: Promise<void>[] = [];
    for (let i = 0; i < images.length; i += concurrency) {
      const batch = images.slice(i, i + concurrency);

      const batchPromises = batch.map(async (image) => {
        const success = await this.downloadImage(image);
        completed++;

        if (success) {
          succeeded++;
        } else {
          failed++;
        }

        // 進度顯示
        if (completed % 10 === 0 || completed === images.length) {
          console.log(
            `   進度: ${completed}/${images.length} (成功: ${succeeded}, 失敗: ${failed})`
          );
        }
      });

      await Promise.all(batchPromises);
    }

    console.log(`✅ 下載完成！成功: ${succeeded}, 失敗: ${failed}`);
  }

  /**
   * 從數據庫下載待下載的圖像
   */
  async downloadPendingImages(limit?: number): Promise<void> {
    const pendingImages = dbHelper.getImagesByStatus(
      "pending",
      undefined,
      limit
    );

    if (pendingImages.length === 0) {
      console.log("📭 沒有待下載的圖像");
      return;
    }

    await this.downloadImagesBatch(pendingImages as Images[]);
  }
}
