/**
 * MobileNet 模型載入器
 * 嘗試從多個來源載入模型
 */

import * as tf from '@tensorflow/tfjs';
import * as path from 'path';
import * as fs from 'fs';

const IMAGE_SIZE = 224;

/**
 * 嘗試從本地文件載入模型
 */
async function tryLoadFromLocal(baseDir: string): Promise<tf.LayersModel | null> {
  const modelPath = path.join(baseDir, 'model.json');
  if (fs.existsSync(modelPath)) {
    try {
      const model = await tf.loadLayersModel(`file://${modelPath}`);
      console.log('✅ 從本地載入模型成功');
      return model;
    } catch (error) {
      console.warn('⚠️  本地模型載入失敗:', error);
    }
  }
  return null;
}

/**
 * 創建簡化的特徵提取器（當無法載入預訓練模型時）
 */
function createSimpleFeatureExtractor(): tf.LayersModel {
  const input = tf.input({ shape: [IMAGE_SIZE, IMAGE_SIZE, 3] });
  
  // 簡化的 CNN 特徵提取器
  let x = tf.layers.conv2d({
    filters: 32,
    kernelSize: 3,
    activation: 'relu',
    padding: 'same',
    name: 'conv1'
  }).apply(input) as tf.SymbolicTensor;
  
  x = tf.layers.maxPooling2d({ poolSize: 2, name: 'pool1' }).apply(x) as tf.SymbolicTensor;
  
  x = tf.layers.conv2d({
    filters: 64,
    kernelSize: 3,
    activation: 'relu',
    padding: 'same',
    name: 'conv2'
  }).apply(x) as tf.SymbolicTensor;
  
  x = tf.layers.maxPooling2d({ poolSize: 2, name: 'pool2' }).apply(x) as tf.SymbolicTensor;
  
  x = tf.layers.conv2d({
    filters: 128,
    kernelSize: 3,
    activation: 'relu',
    padding: 'same',
    name: 'conv3'
  }).apply(x) as tf.SymbolicTensor;
  
  x = tf.layers.globalAveragePooling2d({ name: 'global_avg_pool' }).apply(x) as tf.SymbolicTensor;
  
  const model = tf.model({ inputs: input, outputs: x });
  
  console.log('✅ 簡化特徵提取器創建完成');
  console.log(`   輸入形狀: ${model.inputs[0].shape}`);
  console.log(`   輸出形狀: ${model.outputs[0].shape}\n`);
  
  return model;
}

/**
 * 載入 MobileNet 模型
 */
export async function loadMobileNet(baseModelDir?: string): Promise<tf.LayersModel> {
  console.log('📦 正在載入 MobileNet 模型...\n');

  // 如果提供了本地目錄，先嘗試從本地載入
  if (baseModelDir) {
    const localModel = await tryLoadFromLocal(baseModelDir);
    if (localModel) {
      return localModel;
    }
  }

  // 嘗試多個可能的 URL
  const urls = [
    'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v2_1.0_224/model.json',
    'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json',
    'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1',
  ];

  for (const url of urls) {
    try {
      console.log(`   嘗試載入: ${url}`);
      const model = await tf.loadLayersModel(url);
      
      console.log('✅ MobileNet 模型載入完成');
      console.log(`   輸入形狀: ${model.inputs[0].shape}`);
      console.log(`   輸出形狀: ${model.outputs[0].shape}\n`);
      
      // 注意：由於使用 TensorFlow.js 瀏覽器版本，不支持 file:// 協議保存
      // 基礎模型（MobileNet）每次都從網絡載入，不需要保存到本地
      // 這不會影響訓練，因為我們只保存分類器模型
      
      return model;
    } catch (error) {
      console.log(`   ❌ 失敗，嘗試下一個 URL...`);
      continue;
    }
  }

  // 如果所有 URL 都失敗，使用簡化版本
  console.log('\n⚠️  無法從網絡載入預訓練模型');
  console.log('   使用簡化的特徵提取器（性能較差，但可以工作）\n');
  return createSimpleFeatureExtractor();
}

export { IMAGE_SIZE };

