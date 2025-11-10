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
 * 圖像來源選擇
 * 'google' - 使用 Google Images (Playwright)
 * 'pexels' - 使用 Pexels API（推薦：更快、更穩定、高質量）
 */
export const IMAGE_SOURCE: "google" | "pexels" = "pexels"; // ← 在這裡切換

/**
 * Pexels API 配置
 * 註冊網址：https://www.pexels.com/api/
 * 免費額度：每小時 200 次請求
 */
import { env } from "./env";

export const PEXELS_CONFIG = {
  apiKey: env.PEXELS_API_KEY, // 從 .env 檔案讀取
  perPage: 80, // 每頁圖像數量（最多 80）
  rateLimitDelay: 1000, // API 速率限制延遲（毫秒）
};

/**
 * 搜索配置
 * 主題：世界各地的特色美食
 * 按國家/地區分類收集
 */
export const SEARCH_CONFIG: SearchConfig = {
  keywords: [
    "Chinese cuisine traditional dishes", // 中國料理
    "Japanese sushi ramen dishes", // 日本料理
    "Italian pizza pasta dishes", // 意大利料理
    "French cuisine traditional dishes", // 法國料理
    "Mexican tacos traditional food", // 墨西哥料理
    "Indian curry traditional dishes", // 印度料理
    "Thai food traditional dishes", // 泰國料理
    "Korean kimchi bibimbap dishes", // 韓國料理
    "Vietnamese pho traditional food", // 越南料理
    "Spanish paella tapas dishes", // 西班牙料理
    "Greek traditional food dishes", // 希臘料理
    "Turkish kebab traditional dishes", // 土耳其料理
    "Brazilian feijoada traditional food", // 巴西料理
    "American burger BBQ food", // 美國料理
    "British fish chips traditional food", // 英國料理
  ],
  targetCount: 1000, // 測試：50 張 | 完整：3500 張
  maxScrolls: 50, // 僅 Google 使用
  scrollDelay: 800, // 僅 Google 使用
};

/**
 * 國家分類映射
 * 從關鍵字提取國家名稱
 */
export const COUNTRY_KEYWORDS: { [key: string]: string } = {
  "Chinese cuisine": "China",
  "Japanese sushi": "Japan",
  "Italian pizza": "Italy",
  "French cuisine": "France",
  "Mexican tacos": "Mexico",
  "Indian curry": "India",
  "Thai food": "Thailand",
  "Korean kimchi": "Korea",
  "Vietnamese pho": "Vietnam",
  "Spanish paella": "Spain",
  "Greek traditional": "Greece",
  "Turkish kebab": "Turkey",
  "Brazilian feijoada": "Brazil",
  "American burger": "USA",
  "British fish": "UK",
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

/**
 * 從關鍵字提取國家名稱
 */
export function getCountryFromKeyword(keyword: string): string {
  for (const [key, country] of Object.entries(COUNTRY_KEYWORDS)) {
    if (keyword.includes(key)) {
      return country;
    }
  }
  return "Others"; // 默認分類
}
