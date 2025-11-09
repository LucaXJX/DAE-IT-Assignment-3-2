/**
 * 图像搜索类
 * 使用 Playwright 自动化搜索 Google Images 并收集图像 URL 和 alt 文字
 * V2: 通过点击缩略图获取原图 URL
 */

import { chromium, Browser, Page } from "playwright";
import type { Images } from "./proxy";
import { SEARCH_CONFIG, getCountryFromKeyword } from "./config";

export class ImageScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    console.log("🚀 正在启动浏览器...");
    this.browser = await chromium.launch({
      headless: false, // 设置为 false 可以看到浏览器操作过程
    });
    this.page = await this.browser.newPage();
    console.log("✅ 浏览器启动完成");
  }

  /**
   * 搜索并收集图像
   */
  async scrapeImages(
    keyword: string,
    targetCount: number
  ): Promise<Partial<Images>[]> {
    if (!this.page) {
      throw new Error("浏览器未初始化，请先调用 initialize()");
    }

    console.log(`\n🔍 开始搜索关键字: "${keyword}"`);
    const country = getCountryFromKeyword(keyword);
    console.log(`📍 分類: ${country}`);

    const images: Partial<Images>[] = [];
    const seenUrls = new Set<string>();

    try {
      // 访问 Google Images
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        keyword
      )}&tbm=isch`;
      await this.page.goto(searchUrl, { waitUntil: "domcontentloaded" });

      // 等待页面加载
      await this.page.waitForTimeout(2000);

      console.log("✅ 页面已加载，正在滚动载入更多图片...");

      // 增強滾動載入：持續滾動直到載入足夠的圖像或達到底部
      let previousCount = 0;
      let stableCount = 0;
      const maxScrollAttempts = 50; // 最多滾動 50 次
      const minImagesNeeded = targetCount * 2; // 需要至少目標數量的 2 倍容器

      for (let scroll = 0; scroll < maxScrollAttempts; scroll++) {
        // 滾動到底部
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.page.waitForTimeout(800); // 等待圖像載入

        // 檢查當前載入的圖像容器數量
        const currentContainers = await this.page
          .locator("div[data-id]")
          .count();

        console.log(
          `   🔄 滾動 ${
            scroll + 1
          }/${maxScrollAttempts}：已載入 ${currentContainers} 個圖像容器`
        );

        // 如果數量沒有增加，計數穩定次數
        if (currentContainers === previousCount) {
          stableCount++;
          // 連續 3 次沒有新圖像，可能已到底部
          if (stableCount >= 3) {
            console.log(`   ⚠️  連續 ${stableCount} 次無新圖像，可能已到底部`);
            break;
          }
        } else {
          stableCount = 0; // 重置穩定計數
        }

        previousCount = currentContainers;

        // 如果已經載入足夠的圖像容器，可以停止滾動
        if (currentContainers >= minImagesNeeded) {
          console.log(
            `   ✅ 已載入足夠的圖像容器（${currentContainers} >= ${minImagesNeeded}）`
          );
          break;
        }

        // 嘗試點擊「顯示更多結果」按鈕（如果有）
        try {
          const showMoreButton = this.page.locator(
            'input[value="顯示更多結果"], input[value="Show more results"]'
          );
          if (await showMoreButton.isVisible({ timeout: 1000 })) {
            await showMoreButton.click();
            console.log(`   🔘 點擊「顯示更多結果」按鈕`);
            await this.page.waitForTimeout(2000);
          }
        } catch {
          // 按鈕不存在或不可見，繼續滾動
        }
      }

      // 最終統計
      const imageContainers = await this.page.locator("div[data-id]").all();
      console.log(
        `📸 滾動完成！共找到 ${imageContainers.length} 個圖像容器，開始提取...`
      );

      let collected = 0;
      let attempts = 0;
      const maxAttempts = Math.min(imageContainers.length, targetCount * 3);

      console.log(`🎯 开始点击图片提取原图 URL（目标: ${targetCount}）...`);

      for (
        let i = 0;
        i < imageContainers.length &&
        collected < targetCount &&
        attempts < maxAttempts;
        i++
      ) {
        attempts++;

        try {
          // 滚动到容器可见
          await imageContainers[i].scrollIntoViewIfNeeded({ timeout: 5000 });
          await this.page.waitForTimeout(200);

          // 点击容器
          await imageContainers[i].click({ timeout: 3000 });
          await this.page.waitForTimeout(1500); // 等待右侧面板大图加载

          // 尝试获取大图 URL - 改进的策略
          const imageData = await this.page.evaluate(() => {
            // 策略 1: 查找右侧预览面板中的大图
            const viewerSelectors = [
              "img.sFlh5c.pT0Scc", // Google Images 大图查看器
              "img.n3VNCb",
              "img.sFlh5c",
              '[jsname] img[src^="http"]',
            ];

            for (const selector of viewerSelectors) {
              const img = document.querySelector(selector) as HTMLImageElement;
              if (img && img.src) {
                // 检查是否是高分辨率图片（通常URL较长）
                if (
                  img.src.startsWith("http") &&
                  !img.src.includes("gstatic.com") &&
                  !img.src.includes("google.com/images/branding") &&
                  img.src.length > 80
                ) {
                  return {
                    url: img.src,
                    alt: img.alt || "",
                    source: selector,
                  };
                }
              }
            }

            // 策略 2: 查找所有图片，选择最大的
            const allImgs = Array.from(document.querySelectorAll("img"));
            let largestNonGstatic: {
              url: string;
              alt: string;
              size: number;
            } | null = null;
            let largestAny: { url: string; alt: string; size: number } | null =
              null;

            for (const img of allImgs) {
              const imgEl = img as HTMLImageElement;
              const url = imgEl.src || imgEl.getAttribute("src") || "";

              if (url.startsWith("http") && !url.includes("data:image")) {
                const size =
                  (imgEl.naturalWidth || 0) * (imgEl.naturalHeight || 0);
                const isGstatic = url.includes("gstatic.com");

                // 优先选择非 gstatic
                if (!isGstatic && !url.includes("google.com/images/branding")) {
                  if (!largestNonGstatic || size > largestNonGstatic.size) {
                    largestNonGstatic = {
                      url: url,
                      alt: imgEl.alt || "",
                      size: size,
                    };
                  }
                }

                // 备选：任何图片（包括 gstatic，但要足够大）
                if (size > 10000) {
                  // 至少 100x100 像素
                  if (!largestAny || size > largestAny.size) {
                    largestAny = {
                      url: url,
                      alt: imgEl.alt || "",
                      size: size,
                    };
                  }
                }
              }
            }

            // 优先返回非 gstatic，否则返回最大的
            if (largestNonGstatic && largestNonGstatic.url.length > 50) {
              return {
                url: largestNonGstatic.url,
                alt: largestNonGstatic.alt,
                source: "largest-non-gstatic",
              };
            }

            if (largestAny && largestAny.url.length > 50) {
              return {
                url: largestAny.url,
                alt: largestAny.alt,
                source: "largest-any (gstatic)",
              };
            }

            return null;
          });

          if (imageData && imageData.url && !seenUrls.has(imageData.url)) {
            seenUrls.add(imageData.url);
            images.push({
              keyword: keyword, // 記錄搜索關鍵字
              url: imageData.url,
              alt_text: `[${country}] ${imageData.alt || keyword}`, // 記錄國家分類
              file_name: "",
              download_status: "pending",
              process_status: "pending",
              file_size: 0,
              width: 0,
              height: 0,
              error_message: "",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            collected++;
            console.log(
              `   ✅ 已收集: ${collected}/${targetCount} (${country}) - 来源: ${
                (imageData as any).source
              }`
            );

            // 第一次成功时显示URL样本
            if (collected === 1) {
              console.log(
                `   🔗 URL 样本: ${imageData.url.substring(0, 100)}...`
              );
            }
          } else if (attempts % 20 === 0) {
            // 每20次尝试显示进度
            console.log(
              `   ⏳ 尝试中... ${attempts} 次点击，收集到 ${collected} 张`
            );
          }
        } catch (error) {
          // 点击失败或超时，继续下一个
          continue;
        }
      }

      console.log(
        `✅ 关键字 "${keyword}" 完成，共收集 ${images.length} 张图像`
      );
      return images;
    } catch (error: any) {
      console.error(`❌ 搜索关键字 "${keyword}" 时发生错误:`, error.message);
      return images;
    }
  }

  /**
   * 使用多个关键字搜索图像
   */
  async scrapeMultipleKeywords(
    keywords: string[],
    totalTarget: number
  ): Promise<Partial<Images>[]> {
    const allImages: Partial<Images>[] = [];
    const perKeywordTarget = Math.ceil(totalTarget / keywords.length);

    console.log(
      `\n📊 计划使用 ${keywords.length} 个关键字，每个收集约 ${perKeywordTarget} 张图像`
    );

    for (const keyword of keywords) {
      const images = await this.scrapeImages(keyword, perKeywordTarget);
      allImages.push(...images);

      if (allImages.length >= totalTarget) {
        console.log(`\n✅ 已达到目标数量 ${totalTarget}，停止搜索`);
        break;
      }
    }

    return allImages.slice(0, totalTarget);
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log("✅ 浏览器已关闭");
    }
  }
}
