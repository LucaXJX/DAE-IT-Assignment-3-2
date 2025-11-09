/**
 * 數據庫輔助函數
 * 直接使用 better-sqlite3 進行數據庫操作
 */

import { db } from "./db";
import type { Images } from "./proxy";

/**
 * 批量插入圖像數據
 */
export function insertImagesBatch(images: Partial<Images>[]): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO images 
    (keyword, url, alt_text, file_name, download_status, process_status, file_size, width, height, error_message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const insert = db.transaction((images: Partial<Images>[]) => {
    for (const image of images) {
      const result = stmt.run(
        image.keyword || null,
        image.url,
        image.alt_text || "",
        image.file_name || "",
        image.download_status || "pending",
        image.process_status || "pending",
        image.file_size || 0,
        image.width || 0,
        image.height || 0,
        image.error_message || "",
        image.created_at || new Date().toISOString(),
        image.updated_at || new Date().toISOString()
      );
      if (result.changes > 0) count++;
    }
    return count;
  });

  return insert(images);
}

/**
 * 根據條件獲取圖像列表
 */
export function getImagesByStatus(
  downloadStatus?: string,
  processStatus?: string,
  limit?: number
): Images[] {
  let sql = "SELECT * FROM images WHERE 1=1";
  const params: any[] = [];

  if (downloadStatus) {
    sql += " AND download_status = ?";
    params.push(downloadStatus);
  }

  if (processStatus) {
    sql += " AND process_status = ?";
    params.push(processStatus);
  }

  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }

  return db.prepare(sql).all(...params) as Images[];
}

/**
 * 更新圖像數據
 */
export function updateImage(id: number, updates: Partial<Images>): void {
  const fields: string[] = [];
  const values: any[] = [];

  // 構建 SET 子句
  if (updates.file_name !== undefined) {
    fields.push("file_name = ?");
    values.push(updates.file_name);
  }
  if (updates.download_status !== undefined) {
    fields.push("download_status = ?");
    values.push(updates.download_status);
  }
  if (updates.process_status !== undefined) {
    fields.push("process_status = ?");
    values.push(updates.process_status);
  }
  if (updates.file_size !== undefined) {
    fields.push("file_size = ?");
    values.push(updates.file_size);
  }
  if (updates.width !== undefined) {
    fields.push("width = ?");
    values.push(updates.width);
  }
  if (updates.height !== undefined) {
    fields.push("height = ?");
    values.push(updates.height);
  }
  if (updates.error_message !== undefined) {
    fields.push("error_message = ?");
    values.push(updates.error_message);
  }

  if (fields.length === 0) return;

  // 添加 updated_at
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());

  // 添加 WHERE 子句的 id
  values.push(id);

  const sql = `UPDATE images SET ${fields.join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...values);
}

/**
 * 獲取統計數據
 */
export function getStatistics() {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as totalCollected,
      SUM(CASE WHEN download_status = 'downloaded' THEN 1 ELSE 0 END) as totalDownloaded,
      SUM(CASE WHEN process_status = 'processed' THEN 1 ELSE 0 END) as totalProcessed,
      SUM(CASE WHEN download_status = 'failed' THEN 1 ELSE 0 END) as downloadFailed,
      SUM(CASE WHEN process_status = 'failed' THEN 1 ELSE 0 END) as processFailed,
      AVG(CASE WHEN file_size > 0 THEN file_size ELSE NULL END) as averageFileSize
    FROM images
  `).get() as any;

  return {
    totalCollected: stats.totalCollected || 0,
    totalDownloaded: stats.totalDownloaded || 0,
    totalProcessed: stats.totalProcessed || 0,
    downloadFailed: stats.downloadFailed || 0,
    processFailed: stats.processFailed || 0,
    averageFileSize: stats.averageFileSize || 0,
  };
}

/**
 * 獲取圖像總數
 */
export function getTotalCount(): number {
  const result = db
    .prepare("SELECT COUNT(*) as count FROM images")
    .get() as { count: number };
  return result.count;
}

/**
 * 按國家統計圖像數量
 */
export function getCountryStatistics(): { country: string; count: number }[] {
  const results = db.prepare(`
    SELECT 
      SUBSTR(alt_text, 2, INSTR(alt_text, ']') - 2) as country,
      COUNT(*) as count
    FROM images
    WHERE alt_text LIKE '[%]%'
    GROUP BY country
    ORDER BY count DESC
  `).all() as { country: string; count: number }[];

  return results;
}
