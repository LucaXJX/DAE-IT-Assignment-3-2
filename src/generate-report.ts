/**
 * 生成報告腳本
 * 生成數據清理和分類的完整報告
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dbHelper from './database-helper';

const REPORT_DIR = path.resolve(__dirname, '../reports');
const DATASET_DIR = path.resolve(__dirname, '../dataset');

/**
 * 統計數據集圖片數量
 */
function countDatasetImages(): { [className: string]: number } {
  const stats: { [className: string]: number } = {};
  
  if (!fs.existsSync(DATASET_DIR)) {
    return stats;
  }

  const classes = fs.readdirSync(DATASET_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const className of classes) {
    const classDir = path.join(DATASET_DIR, className);
    const imageFiles = fs.readdirSync(classDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      });
    stats[className] = imageFiles.length;
  }

  return stats;
}

/**
 * 提取唯一網域列表
 */
function getUniqueDomains(): string[] {
  // 從數據庫中提取 URL 的網域
  const { db } = require('./db');
  const images = db.prepare('SELECT url FROM images WHERE url IS NOT NULL AND url != ""').all() as { url: string }[];
  const domains = new Set<string>();

  for (const image of images) {
    try {
      if (image.url && image.url.trim()) {
        const url = new URL(image.url);
        domains.add(url.hostname);
      }
    } catch (error) {
      // 忽略無效 URL
    }
  }

  return Array.from(domains).sort();
}

/**
 * 生成 Markdown 格式的報告
 */
async function generateReport(): Promise<void> {
  console.log('='.repeat(60));
  console.log('📊 生成數據清理和分類報告');
  console.log('='.repeat(60));

  // 確保報告目錄存在
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // 獲取數據庫統計
  const dbStats = dbHelper.getStatistics();
  
  // 統計分類後的圖片數量
  const datasetStats = countDatasetImages();
  const totalClassified = Object.values(datasetStats).reduce((sum, count) => sum + count, 0);

  // 獲取唯一網域
  const uniqueDomains = getUniqueDomains();

  // 計算清除的圖片數量
  const clearedCount = dbStats.totalDownloaded - totalClassified;

  // 生成報告內容
  const timestamp = new Date().toISOString().replace(/T/, ' ').substring(0, 19);
  const reportContent = `# 圖像數據集清理與分類報告

**生成時間**: ${timestamp}

---

## 📊 統計摘要

### 收集和清理統計

| 項目 | 數量 |
|------|------|
| 收集的圖像數量 | ${dbStats.totalCollected} |
| 成功下載數量 | ${dbStats.totalDownloaded} |
| 下載失敗數量 | ${dbStats.downloadFailed} |
| 成功處理數量 | ${dbStats.totalProcessed} |
| 處理失敗數量 | ${dbStats.processFailed} |

### 清理後統計

| 項目 | 數量 |
|------|------|
| **清理後的總圖像數** | **${totalClassified}** |
| 分類為「食物」 | ${datasetStats.food || 0} |
| 分類為「其他」 | ${datasetStats.other || 0} |
| 清除的圖像數量 | ${clearedCount} |
| 清除率 | ${((clearedCount / dbStats.totalDownloaded) * 100).toFixed(2)}% |

---

## 🎯 分類結果

### 按類別分佈

\`\`\`
食物 (food):   ${'█'.repeat(Math.floor((datasetStats.food || 0) / 10))} ${datasetStats.food || 0} 張
其他 (other):  ${'█'.repeat(Math.floor((datasetStats.other || 0) / 10))} ${datasetStats.other || 0} 張
\`\`\`

### 分類詳情

- **食物類別**: ${datasetStats.food || 0} 張圖片
  - 包含世界各地特色美食圖片
  
- **其他類別**: ${datasetStats.other || 0} 張圖片
  - 包含不相關或重複的圖片

---

## 🌐 來源分析

### 圖片來源統計

- **唯一網域數量**: ${uniqueDomains.length} 個
- **主要來源網站**:
${uniqueDomains.slice(0, 10).map(domain => `  - ${domain}`).join('\n')}
${uniqueDomains.length > 10 ? `  - ... 還有 ${uniqueDomains.length - 10} 個網站` : ''}

---

## 🔍 處理過程

### 清理步驟

1. **下載圖片**: 從多個來源下載圖像
2. **圖片處理**: 調整大小、壓縮等預處理
3. **去重處理**: 基於文件內容哈希值去除重複圖片
4. **AI 分類**: 使用 image-dataset 工具進行自動分類
   - 分類類別：食物 (food) 和 其他 (other)
5. **結果驗證**: 人工審核分類結果（可選）

### 使用的工具和技術

- **圖片下載**: Playwright (Google Images) / Pexels API
- **圖片處理**: Sharp
- **AI 分類**: image-dataset (基於 TensorFlow.js)
- **數據庫**: SQLite (better-sqlite3)
- **去重算法**: MD5 文件哈希

---

## ✅ 質量評估

### 數據集質量指標

- ✅ 清理後圖片數量: **${totalClassified}** (要求: 1000-5000 張)
  ${totalClassified >= 1000 && totalClassified <= 5000 ? '✅ 符合要求' : '⚠️ 不符合要求'}
  
- ✅ 去重處理: 已執行
- ✅ 分類準確性: 使用 AI 模型自動分類
- ✅ 數據來源多樣性: ${uniqueDomains.length} 個不同網站

---

## 📁 數據集結構

\`\`\`
dataset/
├── food/     (${datasetStats.food || 0} 張)
└── other/    (${datasetStats.other || 0} 張)
\`\`\`

---

## 📝 備註

- 本報告基於自動化處理生成
- 分類結果基於 image-dataset 工具的 AI 模型
- 建議進行人工審核以確保分類準確性
- 數據集保存在: \`${DATASET_DIR}\`

---

**報告生成工具**: DAE-IT Assignment 3-2
**版本**: 2.0.0
`;

  // 保存報告文件
  const reportFileName = `report-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.md`;
  const reportPath = path.join(REPORT_DIR, reportFileName);
  
  fs.writeFileSync(reportPath, reportContent, 'utf-8');

  console.log(`\n✅ 報告生成完成！`);
  console.log(`📄 報告文件: ${reportPath}`);
  console.log(`\n報告摘要:`);
  console.log(`  收集圖片: ${dbStats.totalCollected}`);
  console.log(`  下載成功: ${dbStats.totalDownloaded}`);
  console.log(`  清理後: ${totalClassified} (食物: ${datasetStats.food || 0}, 其他: ${datasetStats.other || 0})`);
  console.log(`  清除: ${clearedCount}`);
  console.log(`  來源網站: ${uniqueDomains.length} 個`);
  console.log('='.repeat(60));
}

// 執行主函數
generateReport().catch(error => {
  console.error('❌ 發生錯誤:', error.message);
  console.error(error.stack);
  process.exit(1);
});

