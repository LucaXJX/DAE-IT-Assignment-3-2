/**
 * 圖像分類器模組
 * 載入訓練好的模型並進行圖片分類預測
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import * as path from 'path';
import * as fs from 'fs';
import { loadImageAsTensor } from './image-utils';
import { IMAGE_SIZE } from './model-loader';

const rootDir = path.resolve(process.cwd());
const classifierModelDir = path.join(rootDir, 'saved_model/classifier_model');

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
      console.log('⚠️  標準載入方式失敗，嘗試手動載入方式...');
      console.log(`   錯誤: ${standardError.message || standardError}`);
      
      // 使用手動載入方式
      return await loadModelManually();
    }
  } catch (error) {
    console.error('❌ 載入分類器模型失敗:', error);
    throw error;
  }
}

/**
 * 手動載入模型（從手動保存的文件）
 */
async function loadModelManually(): Promise<tf.LayersModel> {
  const modelJsonPath = path.join(classifierModelDir, 'model.json');
  const weightsManifestPath = path.join(classifierModelDir, 'weights-manifest.json');

  try {
    console.log('   開始手動載入模型結構和權重...');
    
    // 1. 載入模型結構
    // 注意：model.json 可能是一個字符串化的 JSON，需要解析兩次
    const modelJsonContent = fs.readFileSync(modelJsonPath, 'utf-8');
    let modelJson: any;
    try {
      // 先解析一次
      modelJson = JSON.parse(modelJsonContent);
      // 如果是字符串，再解析一次
      if (typeof modelJson === 'string') {
        modelJson = JSON.parse(modelJson);
      }
    } catch (error) {
      // 如果解析失敗，可能是格式錯誤
      throw new Error(`無法解析模型 JSON 文件: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
    
    // 2. 載入權重清單
    const weightManifest: Array<{
      name: string;
      shape: (number | null)[];
      dtype: string;
    }> = JSON.parse(fs.readFileSync(weightsManifestPath, 'utf-8'));
    
    console.log(`   📦 開始載入 ${weightManifest.length} 個權重...`);

    // 3. 載入所有權重
    const weightTensors: tf.Tensor[] = [];
    for (const item of weightManifest) {
      const weightName = item.name.replace(/\//g, '_').replace(/:/g, '_');
      const weightPath = path.join(classifierModelDir, `${weightName}.bin`);
      
      if (!fs.existsSync(weightPath)) {
        throw new Error(`權重文件不存在: ${weightPath}`);
      }

      const buffer = fs.readFileSync(weightPath);
      const values = new Float32Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
      );
      
      const validShape = item.shape.filter((s): s is number => s !== null) as number[];
      const tensor = tf.tensor(values, validShape, item.dtype as tf.DataType);
      weightTensors.push(tensor);
    }
    
    console.log('   ✅ 所有權重載入成功');

    // 4. 構建完整的權重數據緩衝區
    // TensorFlow.js 需要完整的權重數據，不能使用空緩衝區
    console.log('   🔧 構建權重數據緩衝區...');
    let totalSize = 0;
    const weightOffsets: number[] = [];
    
    // 計算總大小和每個權重的偏移量
    for (let i = 0; i < weightTensors.length; i++) {
      weightOffsets.push(totalSize);
      const shape = weightTensors[i].shape;
      const size = shape.reduce((a, b) => a * b, 1) * 4; // Float32 = 4 bytes
      totalSize += size;
    }
    
    // 創建完整的權重數據緩衝區
    const weightDataBuffer = new ArrayBuffer(totalSize);
    const weightDataView = new Float32Array(weightDataBuffer);
    
    // 將所有權重數據複製到緩衝區
    for (let i = 0; i < weightTensors.length; i++) {
      const tensor = weightTensors[i];
      const values = await tensor.array();
      const flattened = (values as any).flat(Infinity) as number[];
      weightDataView.set(flattened, weightOffsets[i] / 4);
    }
    
    console.log('   ✅ 權重數據緩衝區構建完成');

    // 5. 從 JSON 創建模型結構
    // 方法：使用 tf.loadLayersModel 配合包含完整權重數據的 IO handler
    let model: tf.LayersModel;
    try {
      // 創建權重規格
      // WeightsManifestEntry 的 dtype 需要是特定的字面量類型，而不是通用 string
      type DataType = "string" | "float32" | "int32" | "bool" | "complex64";
      const weightSpecs: tf.io.WeightsManifestEntry[] = weightManifest.map(item => {
        const entry: tf.io.WeightsManifestEntry = {
          name: item.name,
          shape: item.shape.filter((s): s is number => s !== null) as number[],
          dtype: item.dtype as DataType,
        };
        return entry;
      });
      
      // 創建一個自定義 IO handler，從內存載入模型結構和權重
      const customIOHandler: tf.io.IOHandler = {
        load: async () => {
          return {
            modelTopology: modelJson,
            weightSpecs: weightSpecs,
            weightData: weightDataBuffer, // 使用完整的權重數據緩衝區
          };
        },
      };
      
      // 使用自定義 IO handler 載入模型（包含結構和權重）
      model = await tf.loadLayersModel(customIOHandler);
      console.log('   ✅ 使用自定義 IO handler 載入模型成功（包含結構和權重）');
      
      // 清理臨時權重 tensor（模型現在使用緩衝區中的數據）
      weightTensors.forEach(t => t.dispose());
    } catch (error: any) {
      // 如果載入失敗，清理權重 tensor
      weightTensors.forEach(t => t.dispose());
      console.error('   ❌ 創建模型失敗:', error.message || error);
      throw new Error(`無法從 JSON 創建模型結構: ${error.message || error}`);
    }

    console.log('✅ 使用手動載入方式載入分類器模型成功');
    cachedModel = model;
    return model;
  } catch (error: any) {
    console.error('❌ 手動載入模型失敗:', error);
    throw new Error(
      `模型載入失敗。請確保所有權重文件都存在於 ${classifierModelDir} 目錄中。\n` +
      `錯誤詳情: ${error.message || error}`
    );
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
