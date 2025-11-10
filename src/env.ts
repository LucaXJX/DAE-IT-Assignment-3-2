/**
 * 環境變數管理
 * 用於安全地載入 API Keys 等敏感資訊
 */

import * as dotenv from "dotenv";
import * as path from "path";

// 載入 .env 檔案
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * 環境變數介面
 */
export const env = {
  /**
   * Pexels API Key
   * 從 .env 檔案讀取或使用預設值
   */
  PEXELS_API_KEY: process.env.PEXELS_API_KEY || "",

  /**
   * 驗證環境變數是否已設定
   */
  validate() {
    const missing: string[] = [];

    if (!this.PEXELS_API_KEY) {
      missing.push("PEXELS_API_KEY");
    }

    if (missing.length > 0) {
      console.error("❌ 缺少必要的環境變數：");
      missing.forEach((key) => console.error(`   - ${key}`));
      console.error("\n💡 請建立 .env 檔案並設定這些變數");
      console.error("   參考 .env.example 檔案");
      return false;
    }

    return true;
  },
};
