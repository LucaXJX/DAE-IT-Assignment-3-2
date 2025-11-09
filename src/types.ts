/**
 * 類型定義文件
 * 定義整個項目使用的 TypeScript 接口和類型
 * 
 * 注意：圖像數據類型 (Images) 定義在 proxy.ts 中（由 quick-erd 自動生成）
 */

// 從 proxy.ts 導入數據庫類型
export type { Images } from './proxy';

/**
 * 搜索配置接口
 */
export interface SearchConfig {
  keywords: string[];            // 搜索關鍵字列表
  targetCount: number;           // 目標收集數量
  maxScrolls?: number;           // 最大滾動次數
  scrollDelay?: number;          // 滾動延遲（毫秒）
}

/**
 * 圖像處理配置接口
 */
export interface ProcessConfig {
  maxWidth: number;              // 最大寬度
  maxHeight: number;             // 最大高度
  maxFileSize: number;           // 最大檔案大小（bytes）
  jpegQualityMin: number;        // JPEG 最低質量
  jpegQualityMax: number;        // JPEG 最高質量
}

/**
 * 統計數據接口
 */
export interface Statistics {
  totalCollected: number;        // 總收集數量
  totalDownloaded: number;       // 總下載成功數量
  totalProcessed: number;        // 總處理成功數量
  downloadFailed: number;        // 下載失敗數量
  processFailed: number;         // 處理失敗數量
  averageFileSize: number;       // 平均檔案大小
  startTime?: Date;              // 開始時間
  endTime?: Date;                // 結束時間
}

