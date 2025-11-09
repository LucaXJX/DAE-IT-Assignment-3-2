/**
 * 配置文件
 * 包含項目的所有配置參數
 */

import { SearchConfig, ProcessConfig } from "./types";
import * as path from "path";

/**
 * 項目根目錄路徑配置
 */
export const PATHS = {
  ROOT: path.resolve(__dirname, ".."),
  DATABASE: path.resolve(__dirname, "../database"),
  IMAGES_RAW: path.resolve(__dirname, "../images/raw"),
  IMAGES_PROCESSED: path.resolve(__dirname, "../images/processed"),
  DATABASE_FILE: path.resolve(__dirname, "../database/images.db"),
};

/**
 * 搜索配置
 * 主題：世界各地的特色美食
 */
export const SEARCH_CONFIG: SearchConfig = {
  keywords: [
    "world cuisine dishes",
    "international food",
    "traditional food around the world",
    "famous dishes from different countries",
    "ethnic food photography",
    "global cuisine",
    "street food world",
    "regional dishes",
  ],
  targetCount: 5000, // 目標收集 5000 個 URL（考慮部分可能失敗）
  maxScrolls: 50, // 每個關鍵字最大滾動次數
  scrollDelay: 1000, // 滾動延遲 1 秒
};

/**
 * 圖像處理配置
 */
export const PROCESS_CONFIG: ProcessConfig = {
  maxWidth: 500, // 最大寬度 500px
  maxHeight: 500, // 最大高度 500px
  maxFileSize: 50 * 1024, // 最大檔案大小 50KB
  jpegQualityMin: 50, // JPEG 最低質量 50
  jpegQualityMax: 80, // JPEG 最高質量 80
};

/**
 * 下載配置
 */
export const DOWNLOAD_CONFIG = {
  concurrency: 10, // 並發下載數量
  timeout: 30000, // 下載超時時間（毫秒）
  retryAttempts: 3, // 重試次數
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

/**
 * 數據庫配置
 */
export const DB_CONFIG = {
  verbose: false, // 是否顯示 SQL 語句
  fileMustExist: false, // 數據庫文件不存在時自動創建
};

/**
 * 日誌配置
 */
export const LOG_CONFIG = {
  enableConsole: true, // 啟用控制台日誌
  enableFile: true, // 啟用文件日誌
  logLevel: "info", // 日誌級別: 'debug' | 'info' | 'warn' | 'error'
};
