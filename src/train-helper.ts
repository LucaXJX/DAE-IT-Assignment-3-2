/**
 * 訓練相關的輔助函數
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLabeledImagesForTraining } from './image-label-helper';

const rootDir = path.resolve(process.cwd());
const imagesDir = path.join(rootDir, 'images/processed');
const datasetDir = path.join(rootDir, 'dataset');

/**
 * 準備訓練數據集
 * 從資料庫讀取已標註的圖片，按照標籤分類組織到 dataset 目錄
 */
export function prepareTrainingDataset(): {
  success: boolean;
  totalImages: number;
  categories: { [label: string]: number };
  error?: string;
} {
  try {
    // 獲取所有已標註的圖片（用於訓練的）
    const labeledImages = getLabeledImagesForTraining();
    
    if (labeledImages.length === 0) {
      return {
        success: false,
        totalImages: 0,
        categories: {},
        error: '沒有已標註的圖片，請先標註一些圖片'
      };
    }

    // 按標籤分類
    const imagesByLabel: { [label: string]: Array<{
      imageId: number;
      filePath: string;
    }> } = {};

    labeledImages.forEach(img => {
      if (!imagesByLabel[img.label]) {
        imagesByLabel[img.label] = [];
      }
      imagesByLabel[img.label].push({
        imageId: img.imageId,
        filePath: img.filePath
      });
    });

    // 創建 dataset 目錄結構
    if (!fs.existsSync(datasetDir)) {
      fs.mkdirSync(datasetDir, { recursive: true });
    }

    // 統計信息
    const categories: { [label: string]: number } = {};
    let totalProcessed = 0;

    // 為每個標籤創建目錄並複製圖片
    Object.keys(imagesByLabel).forEach(label => {
      const labelDir = path.join(datasetDir, label);
      
      // 創建標籤目錄
      if (!fs.existsSync(labelDir)) {
        fs.mkdirSync(labelDir, { recursive: true });
      }

      // 複製圖片到對應目錄
      imagesByLabel[label].forEach((img, index) => {
        // filePath 格式可能是 "China/filename.jpg" 或 "filename.jpg"
        const sourcePath = img.filePath.includes('/') 
          ? path.join(imagesDir, img.filePath)
          : path.join(imagesDir, label, img.filePath);
        
        const ext = path.extname(img.filePath) || '.jpg';
        const destFileName = `${label}_${img.imageId}_${index}${ext}`;
        const destPath = path.join(labelDir, destFileName);

        // 檢查源文件是否存在
        if (fs.existsSync(sourcePath)) {
          // 複製文件
          fs.copyFileSync(sourcePath, destPath);
          totalProcessed++;
        } else {
          console.warn(`源文件不存在: ${sourcePath}`);
        }
      });

      categories[label] = imagesByLabel[label].length;
    });

    return {
      success: true,
      totalImages: totalProcessed,
      categories
    };
  } catch (error) {
    console.error('準備訓練數據集失敗:', error);
    return {
      success: false,
      totalImages: 0,
      categories: {},
      error: error instanceof Error ? error.message : '未知錯誤'
    };
  }
}

/**
 * 獲取訓練數據集統計
 */
export function getDatasetStats(): {
  totalImages: number;
  categories: { [label: string]: number };
} {
  if (!fs.existsSync(datasetDir)) {
    return {
      totalImages: 0,
      categories: {}
    };
  }

  const categories: { [label: string]: number } = {};
  let totalImages = 0;

  const labelDirs = fs.readdirSync(datasetDir).filter(item => {
    const itemPath = path.join(datasetDir, item);
    return fs.statSync(itemPath).isDirectory();
  });

  labelDirs.forEach(label => {
    const labelDir = path.join(datasetDir, label);
    const files = fs.readdirSync(labelDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });
    
    categories[label] = files.length;
    totalImages += files.length;
  });

  return {
    totalImages,
    categories
  };
}

/**
 * 檢查訓練數據集是否準備就緒
 */
export function isDatasetReady(): boolean {
  if (!fs.existsSync(datasetDir)) {
    return false;
  }

  const stats = getDatasetStats();
  return stats.totalImages > 0 && Object.keys(stats.categories).length > 0;
}

