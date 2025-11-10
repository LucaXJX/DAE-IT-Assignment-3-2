/**
 * Pexels API 圖像搜索類
 * 使用 Pexels 官方 API 搜索並收集圖像
 * 優點：快速、穩定、高質量、合法
 */

import { createClient, Photo, ErrorResponse } from "pexels";
import type { Images } from "./proxy";
import { getCountryFromKeyword } from "./config";
import { RateLimiter } from "./RateLimiter";

export class PexelsScraper {
  private client: any;
  private apiKey: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Pexels API Key 未設定！請在 config.ts 中設定 PEXELS_API_KEY");
    }
    this.apiKey = apiKey;
    this.client = createClient(apiKey);
    this.rateLimiter = new RateLimiter();
    
    console.log('✅ Pexels API 客戶端已初始化');
    console.log('📊 速率限制：每小時 200 次請求');
  }

  /**
   * 搜索並收集圖像
   */
  async scrapeImages(
    keyword: string,
    targetCount: number
  ): Promise<Partial<Images>[]> {
    console.log(`\n🔍 開始搜索關鍵字: "${keyword}"`);
    const country = getCountryFromKeyword(keyword);
    console.log(`📍 分類: ${country}`);

    const images: Partial<Images>[] = [];
    const seenUrls = new Set<string>();
    const perPage = 80; // Pexels 每頁最多 80 張
    let page = 1;
    let totalFetched = 0;

    try {
      while (images.length < targetCount && page <= 50) {
        // 使用速率限制器執行 API 請求
        console.log(`   📄 正在獲取第 ${page} 頁...`);

        const response = await this.rateLimiter.waitAndExecute(
          async () => {
            return await this.client.photos.search({
              query: keyword,
              per_page: perPage,
              page: page,
            });
          },
          true // 顯示進度
        );

        // 檢查是否有錯誤
        if ("error" in response) {
          console.error(`   ❌ API 錯誤: ${(response as ErrorResponse).error}`);
          break;
        }

        const photos = (response as any).photos as Photo[];
        
        if (!photos || photos.length === 0) {
          console.log(`   ⚠️  第 ${page} 頁無結果，停止搜索`);
          break;
        }

        console.log(`   📸 第 ${page} 頁獲取 ${photos.length} 張圖像`);

        for (const photo of photos) {
          // 使用原圖 URL（高質量）
          const imageUrl = photo.src.original || photo.src.large2x || photo.src.large;
          
          if (!seenUrls.has(imageUrl)) {
            seenUrls.add(imageUrl);
            
            images.push({
              keyword: keyword,
              url: imageUrl,
              alt_text: `[${country}] ${photo.alt || photo.photographer || keyword}`,
              file_name: "",
              download_status: "pending",
              process_status: "pending",
              file_size: 0,
              width: photo.width || 0,
              height: photo.height || 0,
              error_message: "",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            totalFetched++;
            
            if (totalFetched % 50 === 0) {
              console.log(`   ✅ 已收集: ${totalFetched}/${targetCount}`);
            }

            if (images.length >= targetCount) {
              break;
            }
          }
        }

        page++;
      }

      console.log(`✅ 關鍵字 "${keyword}" 完成，共收集 ${images.length} 張圖像`);
      
      // 顯示當前 API 使用統計
      const stats = this.rateLimiter.getHourlyStats();
      console.log(`   📊 本小時 API 使用: ${stats.count}/${stats.limit} (剩餘 ${stats.remaining})`);
      
      return images;

    } catch (error: any) {
      console.error(`❌ 搜索關鍵字 "${keyword}" 時發生錯誤:`, error.message);
      return images;
    }
  }

  /**
   * 使用多個關鍵字搜索圖像
   */
  async scrapeMultipleKeywords(
    keywords: string[],
    totalTarget: number
  ): Promise<Partial<Images>[]> {
    const allImages: Partial<Images>[] = [];
    const perKeywordTarget = Math.ceil(totalTarget / keywords.length);

    console.log(
      `\n📊 計劃使用 ${keywords.length} 個關鍵字，每個收集約 ${perKeywordTarget} 張圖像`
    );

    for (const keyword of keywords) {
      const images = await this.scrapeImages(keyword, perKeywordTarget);
      allImages.push(...images);

      console.log(`   📊 當前總計: ${allImages.length}/${totalTarget}`);

      if (allImages.length >= totalTarget) {
        console.log(`\n✅ 已達到目標數量 ${totalTarget}，停止搜索`);
        break;
      }
    }

    // 顯示最終 API 使用統計
    console.log('\n');
    this.rateLimiter.showDetailedStats();

    return allImages.slice(0, totalTarget);
  }

  /**
   * 獲取當前 API 使用統計
   */
  getApiStats() {
    return this.rateLimiter.getHourlyStats();
  }
}


