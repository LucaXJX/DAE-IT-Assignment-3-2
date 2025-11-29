/**
 * 模型保存工具
 * 由於 TensorFlow.js 瀏覽器版本不支持 file:// 協議保存，
 * 我們手動實現模型權重和結構的保存
 */

import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 手動保存模型（適用於瀏覽器版本的 TensorFlow.js）
 */
export async function saveModelManually(
  model: tf.LayersModel,
  modelDir: string
): Promise<void> {
  console.log('💾 使用手動方式保存模型...');

  // 確保目錄存在
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  // 1. 保存模型結構（JSON）
  const modelJson = model.toJSON();
  const modelJsonPath = path.join(modelDir, 'model.json');
  fs.writeFileSync(modelJsonPath, JSON.stringify(modelJson, null, 2), 'utf-8');
  console.log(`   ✅ 模型結構已保存: ${modelJsonPath}`);

  // 2. 獲取並保存所有層的權重
  const weightData: number[] = [];
  const weightSpecs: Array<{
    name: string;
    shape: number[];
    dtype: string;
  }> = [];

  // 收集所有權重
  for (let i = 0; i < model.weights.length; i++) {
    const weight = model.weights[i];
    // 使用 read() 方法而不是 val 屬性
    const weightTensor = weight.read();
    const values = await weightTensor.array();
    const flattened = (values as number[]).flat(Infinity) as number[];
    
    weightData.push(...flattened);
    
    // 過濾掉 null 值，只保留有效的數字
    const validShape = weight.shape.filter((s): s is number => s !== null) as number[];
    
    weightSpecs.push({
      name: weight.name,
      shape: validShape,
      dtype: weight.dtype,
    });
    
    // 清理臨時 tensor
    weightTensor.dispose();
  }

  // 3. 將權重保存為二進制文件（使用 Float32Array）
  const weightBuffer = Buffer.from(new Float32Array(weightData).buffer);
  const weightsPath = path.join(modelDir, 'weights.bin');
  fs.writeFileSync(weightsPath, weightBuffer);
  console.log(`   ✅ 模型權重已保存: ${weightsPath} (${weightBuffer.length} bytes)`);

  // 4. 保存權重規格信息（用於載入時重建權重）
  const weightSpecsPath = path.join(modelDir, 'weights-specs.json');
  fs.writeFileSync(
    weightSpecsPath,
    JSON.stringify(weightSpecs, null, 2),
    'utf-8'
  );
  console.log(`   ✅ 權重規格已保存: ${weightSpecsPath}`);

  // 5. 創建載入腳本說明文件
  const readmePath = path.join(modelDir, 'README.md');
  const readmeContent = `# 模型文件說明

此模型使用手動保存方式（因為 TensorFlow.js 瀏覽器版本不支持 file:// 協議）。

## 文件說明

- \`model.json\`: 模型結構定義
- \`weights.bin\`: 模型權重（二進制格式，Float32）
- \`weights-specs.json\`: 權重規格信息（用於載入）

## 載入模型

要載入此模型，請使用 \`classifier.ts\` 中的 \`loadClassifierModel()\` 函數或 \`train.ts\` 中的標準載入邏輯。

注意：此模型是使用 TensorFlow.js 瀏覽器版本訓練的，需要在相同環境下載入。
`;
  fs.writeFileSync(readmePath, readmeContent, 'utf-8');

  console.log(`\n✅ 模型已成功保存到: ${modelDir}`);
  console.log(`   文件：`);
  console.log(`   - model.json (${fs.statSync(modelJsonPath).size} bytes)`);
  console.log(`   - weights.bin (${fs.statSync(weightsPath).size} bytes)`);
  console.log(`   - weights-specs.json (${fs.statSync(weightSpecsPath).size} bytes)`);
}

/**
 * 手動載入模型（從手動保存的文件）
 */
export async function loadModelManually(modelDir: string): Promise<tf.LayersModel> {
  const modelJsonPath = path.join(modelDir, 'model.json');
  const weightsPath = path.join(modelDir, 'weights.bin');
  const weightSpecsPath = path.join(modelDir, 'weights-specs.json');

  if (!fs.existsSync(modelJsonPath)) {
    throw new Error(`模型結構文件不存在: ${modelJsonPath}`);
  }

  // 注意：此函數功能尚未完全實現
  // 實際上，模型載入應該使用 classifier.ts 中的邏輯，它已經實現了完整的手動載入功能
  // 或者使用 train.ts 中 tryLoadExistingModel 的邏輯
  throw new Error(
    'loadModelManually 功能尚未完全實現。\n' +
    '請使用以下方式之一載入模型：\n' +
    '1. 使用 classifier.ts 中的 loadClassifierModel() 函數\n' +
    '2. 使用 train.ts 中的 tryLoadExistingModel() 函數\n' +
    '3. 確保模型使用標準 TensorFlow.js 格式保存，然後使用 file:// 協議載入'
  );
}

