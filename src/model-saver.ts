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
    const values = await weight.val.array();
    const flattened = (values as number[]).flat(Infinity) as number[];
    
    weightData.push(...flattened);
    weightSpecs.push({
      name: weight.name,
      shape: weight.shape,
      dtype: weight.dtype,
    });
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

要載入此模型，請使用 \`loadModelManually()\` 函數。

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

  // 1. 讀取模型結構
  const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf-8'));

  // 2. 創建模型（不包含權重）
  const model = await tf.loadLayersModel(
    tf.io.fromMemory(modelJson, new ArrayBuffer(0))
  );

  // 3. 讀取權重規格
  const weightSpecs = JSON.parse(fs.readFileSync(weightSpecsPath, 'utf-8'));

  // 4. 讀取權重數據
  const weightBuffer = fs.readFileSync(weightsPath);
  const weightArray = new Float32Array(
    weightBuffer.buffer,
    weightBuffer.byteOffset,
    weightBuffer.byteLength / 4
  );

  // 5. 重建權重並設置到模型
  let offset = 0;
  for (let i = 0; i < weightSpecs.length; i++) {
    const spec = weightSpecs[i];
    const layer = model.getLayer(spec.name.split('/')[0]); // 獲取層名
    
    if (layer) {
      const size = spec.shape.reduce((a, b) => a * b, 1);
      const values = weightArray.slice(offset, offset + size);
      const tensor = tf.tensor(values, spec.shape, spec.dtype);
      
      // 設置權重
      // 注意：這需要找到對應的權重並替換
      offset += size;
    }
  }

  // 簡化版本：使用標準載入方式
  // 但這需要權重文件格式匹配
  console.warn('⚠️  手動載入模型需要額外實現權重建構邏輯');
  console.warn('   建議：保存時同時生成 TensorFlow.js 兼容格式');

  return model;
}

