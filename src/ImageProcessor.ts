/**
 * 圖像處理類
 * 負責調整大小、裁剪、壓縮圖像
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import type { Images } from './proxy';
import { PATHS, PROCESS_CONFIG } from './config';
import * as dbHelper from './database-helper';

export class ImageProcessor {
  constructor() {
    // 確保處理後的圖像目錄存在
    if (!fs.existsSync(PATHS.IMAGES_PROCESSED)) {
      fs.mkdirSync(PATHS.IMAGES_PROCESSED, { recursive: true });
    }
  }

  /**
   * 處理單個圖像
   */
  async processImage(image: Images): Promise<boolean> {
    if (!image.id || !image.file_name) {
      console.error('❌ 圖像 ID 或檔案名稱不存在');
      return false;
    }

    const rawPath = path.join(PATHS.IMAGES_RAW, image.file_name);
    const processedFileName = `processed_${image.file_name}`;
    const processedPath = path.join(PATHS.IMAGES_PROCESSED, processedFileName);

    try {
      // 檢查原始文件是否存在
      if (!fs.existsSync(rawPath)) {
        throw new Error('原始文件不存在');
      }

      // 讀取圖像元數據
      const metadata = await sharp(rawPath).metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('無法讀取圖像尺寸');
      }

      // 計算調整後的尺寸（保持比例，置中裁剪）
      const { width, height } = this.calculateResizeAndCrop(
        metadata.width,
        metadata.height,
        PROCESS_CONFIG.maxWidth,
        PROCESS_CONFIG.maxHeight
      );

      // 初始質量
      let quality = PROCESS_CONFIG.jpegQualityMax;
      let attemptCount = 0;
      const maxAttempts = 10;

      while (attemptCount < maxAttempts) {
        // 處理圖像：調整大小、置中裁剪、轉換為 JPEG
        await sharp(rawPath)
          .resize(width, height, {
            fit: 'cover',           // 覆蓋模式，會裁剪
            position: 'centre',     // 置中裁剪
          })
          .jpeg({ quality })        // 轉換為 JPEG
          .toFile(processedPath);

        // 檢查檔案大小
        const stats = fs.statSync(processedPath);
        const fileSize = stats.size;

        if (fileSize <= PROCESS_CONFIG.maxFileSize) {
          // 檔案大小符合要求
          const finalMetadata = await sharp(processedPath).metadata();
          
          dbHelper.updateImage(image.id, {
            file_name: processedFileName,
            process_status: 'processed',
            file_size: fileSize,
            width: finalMetadata.width,
            height: finalMetadata.height,
          });

          return true;
        }

        // 檔案太大，降低質量或縮小尺寸
        if (quality > PROCESS_CONFIG.jpegQualityMin) {
          quality -= 5; // 每次降低 5 個質量等級
        } else {
          // 質量已經最低，嘗試縮小尺寸
          const scaleFactor = Math.sqrt(PROCESS_CONFIG.maxFileSize / fileSize);
          const newWidth = Math.floor(width * scaleFactor);
          const newHeight = Math.floor(height * scaleFactor);

          await sharp(rawPath)
            .resize(newWidth, newHeight, {
              fit: 'cover',
              position: 'centre',
            })
            .jpeg({ quality: PROCESS_CONFIG.jpegQualityMin })
            .toFile(processedPath);

          const newStats = fs.statSync(processedPath);
          const newFileSize = newStats.size;

          const finalMetadata = await sharp(processedPath).metadata();
          
          dbHelper.updateImage(image.id, {
            file_name: processedFileName,
            process_status: 'processed',
            file_size: newFileSize,
            width: finalMetadata.width,
            height: finalMetadata.height,
          });

          return true;
        }

        attemptCount++;
      }

      throw new Error('無法將圖像壓縮至指定大小');

    } catch (error: any) {
      // 記錄錯誤
      dbHelper.updateImage(image.id, {
        process_status: 'failed',
        error_message: error.message,
      });

      // 刪除失敗的處理文件（如果存在）
      if (fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }

      return false;
    }
  }

  /**
   * 計算調整和裁剪的尺寸
   */
  private calculateResizeAndCrop(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    // 如果原始尺寸已經符合要求，直接返回
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    // 計算縮放比例
    const widthRatio = maxWidth / originalWidth;
    const heightRatio = maxHeight / originalHeight;
    
    // 使用較大的比例以確保覆蓋整個區域（用於置中裁剪）
    const scale = Math.max(widthRatio, heightRatio);

    return {
      width: Math.min(Math.round(originalWidth * scale), maxWidth),
      height: Math.min(Math.round(originalHeight * scale), maxHeight),
    };
  }

  /**
   * 批量處理圖像
   */
  async processImagesBatch(images: Images[]): Promise<void> {
    console.log(`\n🖼️  開始處理 ${images.length} 張圖像`);

    let completed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const image of images) {
      const success = await this.processImage(image);
      completed++;
      
      if (success) {
        succeeded++;
      } else {
        failed++;
      }

      // 進度顯示
      if (completed % 10 === 0 || completed === images.length) {
        console.log(`   進度: ${completed}/${images.length} (成功: ${succeeded}, 失敗: ${failed})`);
      }
    }

    console.log(`✅ 處理完成！成功: ${succeeded}, 失敗: ${failed}`);
  }

  /**
   * 從數據庫處理已下載但未處理的圖像
   */
  async processPendingImages(limit?: number): Promise<void> {
    const pendingImages = dbHelper.getImagesByStatus('downloaded', 'pending', limit);
    
    if (pendingImages.length === 0) {
      console.log('📭 沒有待處理的圖像');
      return;
    }

    await this.processImagesBatch(pendingImages as Images[]);
  }
}
