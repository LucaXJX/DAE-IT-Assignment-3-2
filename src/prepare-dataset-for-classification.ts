/**
 * 準備數據集腳本（用於 image-dataset）
 * 將處理後的圖片從 images/processed/ 原封不動地複製到 dataset/
 * 
 * 保持原始的國家文件夾結構，讓 image-dataset Web UI 能夠：
 * 1. 顯示原始的文件夾結構（按國家）
 * 2. 用戶可以在 Web UI 中手動分類到 food/other
 * 3. 保持去重功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PATHS } from './config';

const PROCESSED_DIR = path.resolve(__dirname, '../images/processed');
const DATASET_DIR = path.resolve(__dirname, '../dataset');

/**
 * 計算文件哈希值（用於去重）
 */
function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

/**
 * 將處理後的圖片原封不動地複製到 dataset/
 * 保持原始的國家文件夾結構
 */
async function prepareDatasetForClassification(): Promise<void> {
  console.log('='.repeat(60));
  console.log('📦 準備數據集供 image-dataset 使用');
  console.log('保持原始國家文件夾結構');
  console.log('='.repeat(60));

  // 檢查處理後的圖片目錄是否存在
  if (!fs.existsSync(PROCESSED_DIR)) {
    console.error(`❌ 處理後的圖片目錄不存在: ${PROCESSED_DIR}`);
    console.log('💡 請先運行下載和處理程序:');
    console.log('   npm run scrape');
    console.log('   npm run download');
    console.log('   npm run process');
    process.exit(1);
  }

  // 創建 dataset 目錄
  if (!fs.existsSync(DATASET_DIR)) {
    fs.mkdirSync(DATASET_DIR, { recursive: true });
    console.log(`✅ 創建數據集目錄: ${DATASET_DIR}`);
  }

  // 獲取所有國家目錄
  const countryDirs = fs.readdirSync(PROCESSED_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  if (countryDirs.length === 0) {
    console.log('⚠️  沒有找到任何國家目錄');
    console.log('💡 請先運行處理程序: npm run process');
    process.exit(0);
  }

  console.log(`\n📁 找到 ${countryDirs.length} 個國家目錄`);
  console.log(`   國家: ${countryDirs.join(', ')}`);

  // 用於去重的哈希映射（全局）
  const hashMap = new Map<string, string>(); // hash -> filePath
  const duplicates: string[] = [];
  
  let totalImages = 0;
  let copiedCount = 0;
  const stats: { [country: string]: number } = {};

  // 遍歷每個國家目錄，保持文件夾結構
  for (const country of countryDirs) {
    const sourceDir = path.join(PROCESSED_DIR, country);
    const targetDir = path.join(DATASET_DIR, country);
    let countryImageCount = 0;

    // 創建目標國家目錄
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 獲取所有圖片文件
    const imageFiles = fs.readdirSync(sourceDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      });

    if (imageFiles.length === 0) {
      console.log(`⚠️  ${country}: 沒有找到圖片文件`);
      continue;
    }

    // 處理每個圖片文件
    for (const file of imageFiles) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      
      try {
        // 計算文件哈希值（用於去重）
        const fileHash = calculateFileHash(sourcePath);
        
        // 檢查是否重複（全局檢查，跨國家）
        if (hashMap.has(fileHash)) {
          duplicates.push(sourcePath);
          continue;
        }

        // 記錄哈希值
        hashMap.set(fileHash, sourcePath);

        // 如果目標文件已存在，跳過
        if (fs.existsSync(targetPath)) {
          continue;
        }

        // 複製圖片文件（使用硬鏈接以節省空間，如果失敗則複製）
        try {
          fs.linkSync(sourcePath, targetPath);
        } catch (linkError) {
          // 如果硬鏈接失敗（例如跨分區），則複製文件
          fs.copyFileSync(sourcePath, targetPath);
        }

        copiedCount++;
        countryImageCount++;
        totalImages++;
      } catch (error: any) {
        console.error(`❌ 處理文件失敗 ${file}: ${error.message}`);
      }
    }

    stats[country] = countryImageCount;
    if (countryImageCount > 0) {
      console.log(`✅ ${country}: ${countryImageCount} 張圖片`);
    }
  }

  // 顯示統計信息
  console.log('\n' + '='.repeat(60));
  console.log('📊 數據集準備完成');
  console.log('='.repeat(60));
  console.log(`總圖片數（去重後）: ${copiedCount}`);
  console.log(`重複圖片數: ${duplicates.length}`);
  console.log(`數據集目錄: ${DATASET_DIR}`);
  console.log('\n📁 各國家圖片數量:');
  Object.entries(stats).forEach(([country, count]) => {
    if (count > 0) {
      console.log(`   ${country.padEnd(15)} : ${count} 張`);
    }
  });

  console.log('\n📂 數據集結構:');
  console.log(`   ${DATASET_DIR}/`);
  countryDirs.forEach(country => {
    if (stats[country] > 0) {
      console.log(`   ├── ${country}/ (${stats[country]} 張圖片)`);
    }
  });

  console.log('\n🚀 下一步：');
  console.log('   使用 image-dataset Web UI 進行分類：');
  console.log('   npm run dataset:webui');
  console.log('');
  console.log('在 Web UI 中：');
  console.log('  1. 點擊 "Unclassified" → "reload" 查看各國家文件夾的圖片');
  console.log('  2. 選擇圖片，點擊底部的類別按鈕分類到 food/other');
  console.log('  3. 圖片會自動移動到 dataset/food/ 或 dataset/other/');
  console.log('='.repeat(60));
}

// 執行主函數
prepareDatasetForClassification().catch(error => {
  console.error('❌ 發生錯誤:', error.message);
  console.error(error.stack);
  process.exit(1);
});
