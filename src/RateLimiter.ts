/**
 * API 速率限制追蹤器
 * 追蹤 Pexels API 使用情況，避免超過限制
 */

export class RateLimiter {
  private requestLog: number[] = []; // 記錄每次請求的時間戳
  private readonly hourlyLimit = 200; // Pexels 免費版：每小時 200 次
  private readonly minDelay = 1000; // 最小間隔 1 秒

  /**
   * 記錄一次 API 請求
   */
  recordRequest(): void {
    const now = Date.now();
    this.requestLog.push(now);

    // 清理 1 小時前的記錄
    const oneHourAgo = now - 60 * 60 * 1000;
    this.requestLog = this.requestLog.filter(
      (timestamp) => timestamp > oneHourAgo
    );
  }

  /**
   * 檢查是否可以發送請求
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // 統計過去 1 小時的請求數
    const recentRequests = this.requestLog.filter(
      (timestamp) => timestamp > oneHourAgo
    );

    return recentRequests.length < this.hourlyLimit;
  }

  /**
   * 獲取當前小時的請求統計
   */
  getHourlyStats(): {
    count: number;
    limit: number;
    remaining: number;
    percentage: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const count = this.requestLog.filter(
      (timestamp) => timestamp > oneHourAgo
    ).length;
    const remaining = this.hourlyLimit - count;
    const percentage = (count / this.hourlyLimit) * 100;

    return {
      count,
      limit: this.hourlyLimit,
      remaining,
      percentage: Math.round(percentage * 10) / 10,
    };
  }

  /**
   * 等待適當的延遲後執行請求
   * 確保不會超過速率限制
   */
  async waitAndExecute<T>(
    apiCall: () => Promise<T>,
    showProgress: boolean = true
  ): Promise<T> {
    // 檢查是否超過限制
    if (!this.canMakeRequest()) {
      const stats = this.getHourlyStats();
      console.warn(`\n⚠️  已達到每小時限制 (${stats.count}/${stats.limit})`);
      console.warn("⏳ 等待 1 小時後繼續...");

      // 等待到下一個小時
      const oldestRequest = Math.min(...this.requestLog);
      const waitTime = oldestRequest + 60 * 60 * 1000 - Date.now() + 1000;

      if (waitTime > 0) {
        const waitMinutes = Math.ceil(waitTime / 60000);
        console.warn(`   需等待約 ${waitMinutes} 分鐘`);
        await this.sleep(waitTime);
      }
    }

    // 確保與上次請求間隔至少 1 秒
    if (this.requestLog.length > 0) {
      const lastRequest = this.requestLog[this.requestLog.length - 1];
      const timeSinceLastRequest = Date.now() - lastRequest;

      if (timeSinceLastRequest < this.minDelay) {
        const waitTime = this.minDelay - timeSinceLastRequest;
        await this.sleep(waitTime);
      }
    }

    // 記錄請求
    this.recordRequest();

    // 顯示進度（可選）
    if (showProgress) {
      const stats = this.getHourlyStats();
      console.log(
        `   📊 API 使用: ${stats.count}/${stats.limit} (${stats.percentage}%) | 剩餘: ${stats.remaining}`
      );
    }

    // 執行 API 呼叫
    return await apiCall();
  }

  /**
   * 延遲函式
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 顯示詳細統計
   */
  showDetailedStats(): void {
    const stats = this.getHourlyStats();

    console.log("\n📊 Pexels API 使用統計");
    console.log("=".repeat(60));
    console.log(`   本小時已使用:   ${stats.count} 次`);
    console.log(`   每小時限制:     ${stats.limit} 次`);
    console.log(`   剩餘額度:       ${stats.remaining} 次`);
    console.log(`   使用率:         ${stats.percentage}%`);

    if (stats.remaining < 20) {
      console.warn("   ⚠️  警告：剩餘額度不足 20 次");
    }

    console.log("=".repeat(60));
  }

  /**
   * 重置計數器（僅用於測試）
   */
  reset(): void {
    this.requestLog = [];
  }
}
