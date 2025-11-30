/**
 * 準備數據集腳本
 * 將處理後的圖片從 images/processed/ 組織成 dataset/ 結構供 image-dataset 使用
 * 目標：分類成「食物」和「其他」兩個類別
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PATHS } from './config';

const PROCESSED_DIR = path.resolve(__dirname, '../images/processed');
const DATASET_DIR = path.resolve(__dirname, '../dataset');

// 分類類別：食物 和 其他
const CLASSES = ['food', 'other'];

/**
 * 計算文件哈希值（用於去重）
 */
function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

/**
 * 將所有處理後的圖片組織成兩個類別：food 和 other
 * 初始時，所有圖片都放在 "other" 類別，等待 image-dataset 分類
 */
async function prepareDataset(): Promise<void> {
  console.log('='.repeat(60));
  console.log('📦 準備數據集供 image-dataset 使用');
  console.log('目標分類：食物 (food) 和 其他 (other)');
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

  // 創建 dataset 目錄和類別目錄
  if (!fs.existsSync(DATASET_DIR)) {
    fs.mkdirSync(DATASET_DIR, { recursive: true });
    console.log(`✅ 創建數據集目錄: ${DATASET_DIR}`);
  }

  for (const className of CLASSES) {
    const classDir = path.join(DATASET_DIR, className);
    if (!fs.existsSync(classDir)) {
      fs.mkdirSync(classDir, { recursive: true });
      console.log(`✅ 創建類別目錄: ${classDir}`);
    }
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

  // 用於去重的哈希映射
  const hashMap = new Map<string, string>(); // hash -> filePath
  const duplicates: string[] = [];
  
  let totalImages = 0;
  let copiedCount = 0;
  const stats: { [country: string]: number } = {};

  // 初始分類：所有圖片都放在 "other" 類別
  // image-dataset 會後續進行分類
  const targetClassDir = path.join(DATASET_DIR, 'other');

  // 遍歷每個國家目錄
  for (const country of countryDirs) {
    const sourceDir = path.join(PROCESSED_DIR, country);
    let countryImageCount = 0;

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
      
      try {
        // 計算文件哈希值（用於去重）
        const fileHash = calculateFileHash(sourcePath);
        
        // 檢查是否重複
        if (hashMap.has(fileHash)) {
          duplicates.push(sourcePath);
          console.log(`   ⚠️  發現重複圖片: ${file} (與 ${path.basename(hashMap.get(fileHash)!)})`);
          continue;
        }

        // 記錄哈希值
        hashMap.set(fileHash, sourcePath);

        // 生成目標文件名（包含國家信息以便追溯）
        const baseFileName = path.basename(file);
        const targetFileName = `${country}_${baseFileName}`;
        const targetPath = path.join(targetClassDir, targetFileName);

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

  console.log('\n📂 分類結構:');
  console.log(`   ${DATASET_DIR}/`);
  console.log(`   ├── food/  (等待 image-dataset 分類)`);
  console.log(`   └── other/ (${copiedCount} 張圖片，初始分類)`);

  console.log('\n🚀 下一步：');
  console.log('   運行 image-dataset 進行分類（食物/其他）:');
  console.log('   npm run dataset:classify');
  console.log('   或');
  console.log('   npm run dataset:classify:low  (快速測試)');
  console.log('='.repeat(60));
}

// 執行主函數
prepareDataset().catch(error => {
  console.error('❌ 發生錯誤:', error.message);
  console.error(error.stack);
  process.exit(1);
});
