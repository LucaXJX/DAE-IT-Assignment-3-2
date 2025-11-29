/**
 * 模型訓練腳本
 * 使用 TensorFlow.js (瀏覽器版本) 和 sharp 訓練圖像分類模型
 * 不使用 tensorflow-helpers，完全手動實現
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import * as fs from 'fs';
import * as path from 'path';
import { loadImageAsTensor } from './image-utils';
import { loadMobileNet, IMAGE_SIZE } from './model-loader';

const rootDir = path.resolve(process.cwd());
const baseModelDir = path.join(rootDir, 'saved_model/base_model');
const classifierModelDir = path.join(rootDir, 'saved_model/classifier_model');
const datasetDir = path.join(rootDir, 'dataset');

/**
 * 從數據集目錄讀取所有圖片
 */
function loadDataset(): { [label: string]: string[] } {
  if (!fs.existsSync(datasetDir)) {
    throw new Error(`數據集目錄不存在: ${datasetDir}`);
  }

  const dataset: { [label: string]: string[] } = {};
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

    dataset[label] = files.map(file => path.join(labelDir, file));
  });

  return dataset;
}

/**
 * 創建分類器模型（在 MobileNet 基礎上添加分類層）
 */
function createClassifier(
  baseModel: tf.LayersModel,
  numClasses: number,
  hiddenUnits: number = 128
): tf.LayersModel {
  console.log(`🔧 創建分類器 (${numClasses} 個類別)...`);

  // 獲取基礎模型的輸出（特徵提取部分）
  // model.output 可能是 SymbolicTensor 或 SymbolicTensor[]
  const baseOutput = Array.isArray(baseModel.output) 
    ? baseModel.output[0] 
    : baseModel.output;
  
  // 檢查輸出形狀，決定處理方式
  const outputShape = baseOutput.shape;
  let features: tf.SymbolicTensor = baseOutput;

  // 如果輸出是 4D（包含空間維度），需要全局平均池化
  if (outputShape && outputShape.length === 4) {
    features = tf.layers.globalAveragePooling2d({
      name: 'classifier_global_avg_pool'
    }).apply(baseOutput) as tf.SymbolicTensor;
  }
  
  // 如果輸出是 2D 且只有 1000 個單元（MobileNet 完整分類輸出），
  // 需要截取前面的層作為特徵提取器
  // 但為了簡單，我們直接使用輸出並添加新的層
  // 注意：這不是最佳實踐，但可以工作

  // 添加隱藏層
  const hidden = tf.layers.dense({
    units: hiddenUnits,
    activation: 'relu',
    name: 'classifier_hidden'
  }).apply(features) as tf.SymbolicTensor;

  // 添加 Dropout 防止過擬合（使用唯一名稱避免衝突）
  const dropout = tf.layers.dropout({
    rate: 0.5,
    name: 'classifier_dropout'
  }).apply(hidden) as tf.SymbolicTensor;

  // 添加分類層
  const output = tf.layers.dense({
    units: numClasses,
    activation: 'softmax',
    name: 'classifier_output'
  }).apply(dropout) as tf.SymbolicTensor;

  // 創建新模型
  // model.input 也可能是 SymbolicTensor 或 SymbolicTensor[]
  const baseInput = Array.isArray(baseModel.input) 
    ? baseModel.input[0] 
    : baseModel.input;
  
  const classifier = tf.model({
    inputs: baseInput,
    outputs: output
  });

  // 凍結 MobileNet 層（只訓練分類層）
  baseModel.layers.forEach(layer => {
    layer.trainable = false;
  });

  console.log('✅ 分類器創建完成\n');

  return classifier;
}

/**
 * 準備訓練數據
 */
async function prepareTrainingData(
  dataset: { [label: string]: string[] },
  classNames: string[]
): Promise<{
  xs: tf.Tensor4D;
  ys: tf.Tensor2D;
}> {
  console.log('📊 準備訓練數據...');

  const allImages: string[] = [];
  const allLabels: number[] = [];

  // 收集所有圖片和對應的標籤
  classNames.forEach((className, classIndex) => {
    const images = dataset[className] || [];
    images.forEach(imagePath => {
      allImages.push(imagePath);
      allLabels.push(classIndex);
    });
  });

  if (allImages.length === 0) {
    throw new Error('沒有找到訓練圖片');
  }

  console.log(`   總共 ${allImages.length} 張圖片，${classNames.length} 個類別`);

  // 載入所有圖片
  const tensors: tf.Tensor4D[] = [];
  let loaded = 0;

  for (const imagePath of allImages) {
    try {
      const tensor = await loadImageAsTensor(imagePath, IMAGE_SIZE);
      tensors.push(tensor);
      loaded++;
      
      if (loaded % 10 === 0) {
        process.stdout.write(`   已載入: ${loaded}/${allImages.length}\r`);
      }
    } catch (error) {
      console.warn(`\n   跳過圖片: ${imagePath}`);
    }
  }

  console.log(`\n   ✅ 成功載入 ${loaded} 張圖片\n`);

  // 合併為批次
  const xs = tf.concat(tensors, 0) as tf.Tensor4D;

  // 創建標籤（one-hot encoding）
  const ys = tf.oneHot(tf.tensor1d(allLabels, 'int32'), classNames.length) as tf.Tensor2D;

  // 清理中間 tensor
  tensors.forEach(t => t.dispose());

  return { xs, ys };
}

/**
 * 訓練模型
 */
async function trainModel(
  model: tf.LayersModel,
  xs: tf.Tensor4D,
  ys: tf.Tensor2D,
  epochs: number = 10,
  batchSize: number = 32
): Promise<any> {
  console.log('🎯 開始訓練模型...');
  console.log(`   訓練輪數: ${epochs}`);
  console.log(`   批次大小: ${batchSize}\n`);

  // 編譯模型
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  // 訓練模型
  const history = await model.fit(xs, ys, {
    epochs,
    batchSize,
    shuffle: true,
    validationSplit: 0.2, // 20% 用於驗證
    callbacks: {
      onEpochEnd: (epoch: number, logs?: any) => {
        const loss = logs?.loss ? Number(logs.loss).toFixed(4) : 'N/A';
        const acc = logs?.acc ? Number(logs.acc).toFixed(4) : 'N/A';
        const valLoss = logs?.val_loss ? Number(logs.val_loss).toFixed(4) : 'N/A';
        const valAcc = logs?.val_acc ? Number(logs.val_acc).toFixed(4) : 'N/A';
        console.log(
          `   Epoch ${epoch + 1}/${epochs} - ` +
          `loss: ${loss} - ` +
          `acc: ${acc} - ` +
          `val_loss: ${valLoss} - ` +
          `val_acc: ${valAcc}`
        );
      }
    }
  });

  console.log('\n✅ 訓練完成！\n');

  return history;
}

/**
 * 保存模型
 */
async function saveModel(model: tf.LayersModel, modelDir: string): Promise<void> {
  console.log('💾 保存模型...');

  // 確保目錄存在
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  // 保存模型
  await model.save(`file://${modelDir}`);

  console.log(`✅ 模型已保存到: ${modelDir}\n`);
}

/**
 * 主訓練函數
 */
async function train() {
  try {
    console.log('🚀 開始訓練模型...\n');

    // 1. 載入數據集
    console.log('📂 讀取數據集...');
    const dataset = loadDataset();
    const classNames = Object.keys(dataset).sort();
    
    if (classNames.length === 0) {
      throw new Error('數據集為空，請先準備訓練數據');
    }

    const totalImages = Object.values(dataset).reduce((sum, images) => sum + images.length, 0);
    console.log(`✅ 找到 ${classNames.length} 個類別，共 ${totalImages} 張圖片`);
    console.log(`   類別: ${classNames.join(', ')}\n`);

    // 2. 載入 MobileNet 模型
    const baseModel = await loadMobileNet(baseModelDir);

    // 3. 創建分類器
    const classifier = createClassifier(baseModel, classNames.length);

    // 4. 準備訓練數據
    const { xs, ys } = await prepareTrainingData(dataset, classNames);

    // 5. 訓練模型
    const history = await trainModel(classifier, xs, ys, 10, 32);

    // 6. 清理
    xs.dispose();
    ys.dispose();

    // 7. 保存模型
    await saveModel(classifier, classifierModelDir);

    // 8. 保存類別名稱（用於推理時使用）
    const classNamesPath = path.join(classifierModelDir, 'classNames.json');
    fs.writeFileSync(classNamesPath, JSON.stringify(classNames, null, 2));

    console.log('🎉 訓練流程完成！');
    console.log(`\n模型已保存，類別信息已保存到: ${classNamesPath}`);
  } catch (error) {
    console.error('❌ 訓練失敗:', error);
    throw error;
  }
}

// 如果直接運行此文件
if (require.main === module) {
  train()
    .then(() => {
      console.log('\n✅ 所有操作完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 發生錯誤:', error);
      process.exit(1);
    });
}

export { train };
