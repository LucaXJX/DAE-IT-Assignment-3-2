/**
 * 圖像分類器模組
 * 載入訓練好的模型並進行圖片分類預測
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import * as path from 'path';
import * as fs from 'fs';
import { loadImageAsTensor } from './image-utils';
import { loadMobileNet, IMAGE_SIZE } from './model-loader';

const rootDir = path.resolve(process.cwd());
const classifierModelDir = path.join(rootDir, 'saved_model/classifier_model');
const baseModelDir = path.join(rootDir, 'saved_model/base_model');

// 緩存的模型和類別名稱
let cachedModel: tf.LayersModel | null = null;
let cachedClassNames: string[] | null = null;

/**
 * 載入訓練好的分類器模型
 */
async function loadClassifierModel(): Promise<tf.LayersModel> {
  if (cachedModel) {
    return cachedModel;
  }

  console.log('📦 正在載入分類器模型...');

  const modelJsonPath = path.join(classifierModelDir, 'model.json');
  const weightsManifestPath = path.join(classifierModelDir, 'weights-manifest.json');

  if (!fs.existsSync(modelJsonPath)) {
    throw new Error(`模型文件不存在: ${modelJsonPath}`);
  }

  if (!fs.existsSync(weightsManifestPath)) {
    throw new Error(`權重清單文件不存在: ${weightsManifestPath}`);
  }

  try {
    // 首先嘗試使用標準方式載入（file:// 協議）
    try {
      const model = await tf.loadLayersModel(`file://${modelJsonPath}`);
      console.log('✅ 使用標準方式載入分類器模型');
      cachedModel = model;
      return model;
    } catch (standardError: any) {
      // 如果標準方式失敗，使用手動載入方式
      console.log('⚠️  標準載入方式失敗，使用手動載入方式');
      console.log(`   錯誤: ${standardError.message || standardError}`);
      
      // 如果標準方式失敗，說明模型可能使用手動保存格式
      // 拋出更友好的錯誤提示
      throw new Error(
        `模型載入失敗。請確保模型使用標準 TensorFlow.js 格式保存。\n` +
        `錯誤詳情: ${standardError.message || standardError}\n` +
        `提示: 如果使用手動保存格式，請確保所有權重文件都存在於 ${classifierModelDir} 目錄中。`
      );
    }
  } catch (error) {
    console.error('❌ 載入分類器模型失敗:', error);
    throw error;
  }
}

/**
 * 載入類別名稱列表
 */
function loadClassNames(): string[] {
  if (cachedClassNames) {
    return cachedClassNames;
  }

  const classNamesPath = path.join(classifierModelDir, 'classNames.json');
  
  if (!fs.existsSync(classNamesPath)) {
    throw new Error(`類別名稱文件不存在: ${classNamesPath}`);
  }

  try {
    const classNames = JSON.parse(fs.readFileSync(classNamesPath, 'utf-8'));
    cachedClassNames = classNames;
    console.log(`✅ 載入 ${classNames.length} 個類別名稱`);
    return classNames;
  } catch (error) {
    console.error('❌ 載入類別名稱失敗:', error);
    throw error;
  }
}

/**
 * 對單張圖片進行分類預測
 * @param imagePath 圖片路徑
 * @param topK 返回前 K 個預測結果（默認 3）
 * @returns 預測結果數組，按置信度降序排列
 */
export async function classifyImage(
  imagePath: string,
  topK: number = 3
): Promise<Array<{ label: string; confidence: number }>> {
  try {
    // 載入模型和類別名稱
    const model = await loadClassifierModel();
    const classNames = loadClassNames();

    // 載入並預處理圖片
    const imageTensor = await loadImageAsTensor(imagePath, IMAGE_SIZE);

    // 進行預測
    const predictions = model.predict(imageTensor) as tf.Tensor;

    // 獲取預測結果（softmax 輸出，已經是概率分佈）
    const predictionArray = await predictions.array();
    const probabilities = (predictionArray as number[][])[0];

    // 清理 tensor
    imageTensor.dispose();
    predictions.dispose();

    // 生成結果數組
    const results = probabilities
      .map((prob, index) => ({
        label: classNames[index],
        confidence: prob,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);

    return results;
  } catch (error) {
    console.error(`分類圖片失敗: ${imagePath}`, error);
    throw error;
  }
}

/**
 * 批量分類圖片
 * @param imagePaths 圖片路徑數組
 * @param topK 返回前 K 個預測結果（默認 1）
 * @param batchSize 批次大小（默認 8）
 * @returns 預測結果數組（與輸入順序對應）
 */
export async function classifyImagesBatch(
  imagePaths: string[],
  topK: number = 1,
  batchSize: number = 8
): Promise<Array<{ path: string; predictions: Array<{ label: string; confidence: number }>; error?: string }>> {
  const results: Array<{ path: string; predictions: Array<{ label: string; confidence: number }>; error?: string }> = [];

  // 分批處理
  for (let i = 0; i < imagePaths.length; i += batchSize) {
    const batch = imagePaths.slice(i, i + batchSize);
    
    // 並行處理批次中的圖片
    const batchResults = await Promise.all(
      batch.map(async (imagePath) => {
        try {
          const predictions = await classifyImage(imagePath, topK);
          return { path: imagePath, predictions };
        } catch (error) {
          return {
            path: imagePath,
            predictions: [],
            error: error instanceof Error ? error.message : '未知錯誤',
          };
        }
      })
    );

    results.push(...batchResults);

    // 進度提示
    if (i + batchSize < imagePaths.length) {
      process.stdout.write(`\r   已處理: ${Math.min(i + batchSize, imagePaths.length)}/${imagePaths.length}`);
    }
  }

  console.log(`\n✅ 批量分類完成: ${results.length} 張圖片`);

  return results;
}

/**
 * 清除緩存的模型（用於重新載入）
 */
export function clearModelCache(): void {
  if (cachedModel) {
    cachedModel.dispose();
    cachedModel = null;
  }
  cachedClassNames = null;
  console.log('🗑️  已清除模型緩存');
}

/**
 * 檢查模型是否存在
 */
export function isModelAvailable(): boolean {
  const modelJsonPath = path.join(classifierModelDir, 'model.json');
  const weightsManifestPath = path.join(classifierModelDir, 'weights-manifest.json');
  const classNamesPath = path.join(classifierModelDir, 'classNames.json');

  return (
    fs.existsSync(modelJsonPath) &&
    fs.existsSync(weightsManifestPath) &&
    fs.existsSync(classNamesPath)
  );
}

/**
 * 獲取模型信息
 */
export function getModelInfo(): {
  available: boolean;
  modelPath: string;
  classNamesPath: string;
  numClasses?: number;
  classNames?: string[];
} {
  const modelJsonPath = path.join(classifierModelDir, 'model.json');
  const classNamesPath = path.join(classifierModelDir, 'classNames.json');
  const available = isModelAvailable();

  let numClasses: number | undefined;
  let classNames: string[] | undefined;

  if (available) {
    try {
      const loadedClassNames = JSON.parse(fs.readFileSync(classNamesPath, 'utf-8'));
      if (Array.isArray(loadedClassNames)) {
        classNames = loadedClassNames;
        numClasses = classNames.length;
      }
    } catch (error) {
      // 忽略錯誤
    }
  }

  return {
    available,
    modelPath: classifierModelDir,
    classNamesPath,
    numClasses,
    classNames,
  };
}

