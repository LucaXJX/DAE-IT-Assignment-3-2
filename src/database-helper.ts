/**
 * 數據庫輔助函數
 * 使用 quick-erd 生成的 proxy 進行數據庫操作
 */

import { proxy } from "./proxy";
import type { Images } from "./proxy";

/**
 * 批量插入圖像數據
 */
export function insertImagesBatch(images: Partial<Images>[]): number {
  let count = 0;
  for (const image of images) {
    try {
      proxy.images.push(image as Images);
      count++;
    } catch (error) {
      // 忽略重複的 URL（unique constraint 錯誤）
      if (!(error instanceof Error && error.message.includes("UNIQUE"))) {
        console.error("插入失敗:", error);
      }
    }
  }
  return count;
}

/**
 * 根據條件獲取圖像列表
 */
export function getImagesByStatus(
  downloadStatus?: string,
  processStatus?: string,
  limit?: number
): Images[] {
  let results = proxy.images;

  // 過濾下載狀態
  if (downloadStatus) {
    results = results.filter((img) => img.download_status === downloadStatus);
  }

  // 過濾處理狀態
  if (processStatus) {
    results = results.filter((img) => img.process_status === processStatus);
  }

  // 限制數量
  if (limit) {
    results = results.slice(0, limit);
  }

  return results;
}

/**
 * 更新圖像數據
 */
export function updateImage(id: number, updates: Partial<Images>): void {
  const index = proxy.images.findIndex((img) => img.id === id);
  if (index !== -1) {
    proxy.images[index] = {
      ...proxy.images[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * 獲取統計數據
 */
export function getStatistics() {
  const all = proxy.images;

  const downloaded = all.filter((img) => img.download_status === "downloaded");
  const processed = all.filter((img) => img.process_status === "processed");
  const downloadFailed = all.filter((img) => img.download_status === "failed");
  const processFailed = all.filter((img) => img.process_status === "failed");

  const fileSizes = all
    .map((img) => img.file_size)
    .filter((size) => size && size > 0);

  const averageFileSize =
    fileSizes.length > 0
      ? fileSizes.reduce((a, b) => a + b, 0) / fileSizes.length
      : 0;

  return {
    totalCollected: all.length,
    totalDownloaded: downloaded.length,
    totalProcessed: processed.length,
    downloadFailed: downloadFailed.length,
    processFailed: processFailed.length,
    averageFileSize,
  };
}

/**
 * 獲取圖像總數
 */
export function getTotalCount(): number {
  return proxy.images.length;
}
