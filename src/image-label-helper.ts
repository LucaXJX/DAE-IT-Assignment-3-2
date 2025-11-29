/**
 * 圖片標籤相關的資料庫操作輔助函數
 */

import { db } from './db';
import type { ImageLabels } from './proxy';

export interface ImageLabelData {
  id?: number;
  image_id: number;
  label: string;
  confidence: number;
  is_manual: boolean;
  reviewed: boolean;
}

/**
 * 保存圖片標籤
 */
export function saveImageLabel(data: ImageLabelData): number {
  const stmt = db.prepare(`
    INSERT INTO image_labels 
    (image_id, label, confidence, is_manual, reviewed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    data.image_id,
    data.label,
    data.confidence,
    data.is_manual ? 1 : 0,
    data.reviewed ? 1 : 0,
    now,
    now
  );

  return result.lastInsertRowid as number;
}

/**
 * 獲取圖片的標籤列表
 */
export function getImageLabels(imageId: number): ImageLabelData[] {
  const stmt = db.prepare(`
    SELECT id, image_id, label, confidence, is_manual, reviewed
    FROM image_labels
    WHERE image_id = ?
    ORDER BY is_manual DESC, confidence DESC
  `);

  const rows = stmt.all(imageId) as any[];
  return rows.map(row => ({
    id: row.id,
    image_id: row.image_id,
    label: row.label,
    confidence: row.confidence,
    is_manual: row.is_manual === 1,
    reviewed: row.reviewed === 1
  }));
}

/**
 * 刪除圖片標籤
 */
export function deleteImageLabel(labelId: number): boolean {
  const stmt = db.prepare('DELETE FROM image_labels WHERE id = ?');
  const result = stmt.run(labelId);
  return result.changes > 0;
}

/**
 * 標記標籤為已審核
 */
export function markLabelAsReviewed(labelId: number): boolean {
  const stmt = db.prepare(`
    UPDATE image_labels 
    SET reviewed = 1, updated_at = ?
    WHERE id = ?
  `);
  const result = stmt.run(new Date().toISOString(), labelId);
  return result.changes > 0;
}

/**
 * 根據圖片 ID（從文件路徑解析）獲取資料庫中的圖片 ID
 * 
 * 匹配策略：
 * 1. 嘗試完整路徑匹配：{country}/{filename}
 * 2. 嘗試文件名匹配：file_name LIKE '%/{filename}' 或 file_name = '{filename}'
 */
export function getImageIdFromPath(country: string, filename: string): number | null {
  // 策略 1: 嘗試完整路徑匹配
  const fullPath = `${country}/${filename}`;
  let stmt = db.prepare(`
    SELECT id FROM images 
    WHERE file_name = ?
    LIMIT 1
  `);
  let row = stmt.get(fullPath) as any;
  if (row) {
    return row.id;
  }

  // 策略 2: 嘗試文件名匹配（file_name 以 /{filename} 結尾）
  stmt = db.prepare(`
    SELECT id FROM images 
    WHERE file_name LIKE ? OR file_name = ?
    LIMIT 1
  `);
  row = stmt.get(`%/${filename}`, filename) as any;
  if (row) {
    return row.id;
  }

  return null;
}

/**
 * 創建圖片記錄（如果不存在）
 * 
 * @param country 國家名稱
 * @param filename 文件名
 * @returns 圖片 ID（資料庫中的 id）
 */
export function createImageRecordIfNotExists(
  country: string,
  filename: string
): number {
  // 先檢查是否已存在
  const existingId = getImageIdFromPath(country, filename);
  if (existingId) {
    return existingId;
  }

  // 創建新記錄
  const filePath = `${country}/${filename}`;
  const stmt = db.prepare(`
    INSERT INTO images 
    (keyword, url, alt_text, file_name, download_status, process_status, 
     file_size, width, height, error_message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    country, // keyword (使用國家名稱作為關鍵字)
    ``, // url (空，因為是本地文件)
    `[${country}] ${filename}`, // alt_text
    filePath, // file_name
    'downloaded', // download_status
    'processed', // process_status
    0, // file_size (未知)
    0, // width (未知)
    0, // height (未知)
    '', // error_message
    now, // created_at
    now // updated_at
  );

  return result.lastInsertRowid as number;
}

/**
 * 獲取已標註的圖片統計
 */
export function getLabeledStats(): {
  totalLabeled: number;
  totalManual: number;
  totalAI: number;
  totalReviewed: number;
} {
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT image_id) as totalLabeled,
      SUM(CASE WHEN is_manual = 1 THEN 1 ELSE 0 END) as totalManual,
      SUM(CASE WHEN is_manual = 0 THEN 1 ELSE 0 END) as totalAI,
      SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as totalReviewed
    FROM image_labels
  `).get() as any;

  return {
    totalLabeled: stats.totalLabeled || 0,
    totalManual: stats.totalManual || 0,
    totalAI: stats.totalAI || 0,
    totalReviewed: stats.totalReviewed || 0
  };
}

/**
 * 獲取所有已標註的圖片（用於訓練）
 */
export function getLabeledImagesForTraining(): Array<{
  imageId: number;
  filePath: string;
  label: string;
  isManual: boolean;
}> {
  const stmt = db.prepare(`
    SELECT DISTINCT
      il.image_id,
      i.file_name,
      i.keyword,
      il.label,
      il.is_manual
    FROM image_labels il
    JOIN images i ON il.image_id = i.id
    WHERE il.is_manual = 1 OR il.reviewed = 1
    ORDER BY il.image_id
  `);

  const rows = stmt.all() as any[];
  return rows.map(row => ({
    imageId: row.image_id,
    filePath: row.keyword ? `${row.keyword}/${row.file_name}` : row.file_name,
    label: row.label,
    isManual: row.is_manual === 1
  }));
}

/**
 * 獲取未標註的圖片列表
 */
export function getUnlabeledImages(limit: number = 100): Array<{
  id: number;
  filePath: string;
  country: string;
  filename: string;
}> {
  const stmt = db.prepare(`
    SELECT i.id, i.file_name, i.keyword
    FROM images i
    LEFT JOIN image_labels il ON i.id = il.image_id
    WHERE il.id IS NULL
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];
  return rows.map(row => ({
    id: row.id,
    filePath: row.keyword ? `${row.keyword}/${row.file_name}` : row.file_name,
    country: row.keyword || '',
    filename: row.file_name
  }));
}

