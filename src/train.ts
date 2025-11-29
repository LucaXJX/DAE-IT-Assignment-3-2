/**
 * 模型訓練腳本
 * 使用 TensorFlow.js 和 tensorflow-helpers 訓練圖像分類模型
 */

// 首先導入 tfjs-node 以啟用圖片解碼功能
import '@tensorflow/tfjs-node';

import {
  loadImageModel,
  PreTrainedImageModels,
  loadImageClassifierModel,
  tf,
} from 'tensorflow-helpers';
import * as path from 'path';

const rootDir = path.resolve(process.cwd());
const baseModelDir = path.join(rootDir, 'saved_model/base_model');
const classifierModelDir = path.join(rootDir, 'saved_model/classifier_model');
const datasetDir = path.join(rootDir, 'dataset');

async function train() {
  try {
    console.log('🚀 開始訓練模型...\n');

    // 1. 載入預訓練的基礎模型 (MobileNet)
    console.log('📦 載入預訓練基礎模型...');
    const baseModel = await loadImageModel({
      spec: PreTrainedImageModels.mobilenet['mobilenet-v3-large-100'],
      dir: baseModelDir,
    });
    console.log('✅ 基礎模型載入完成');
    console.log(`   嵌入特徵維度: ${baseModel.spec.features}\n`);

    // 2. 創建分類器
    console.log('🔧 創建分類器...');
    const classifier = await loadImageClassifierModel({
      baseModel,
      modelDir: classifierModelDir,
      hiddenLayers: [128], // 隱藏層大小
      datasetDir: datasetDir,
      // classNames 會自動從 datasetDir 掃描
    });
    console.log('✅ 分類器創建完成\n');

    // 3. 訓練模型
    console.log('🎯 開始訓練...');
    const history = await classifier.train({
      epochs: 10, // 訓練輪數
      batchSize: 32, // 批次大小
    });
    console.log('✅ 訓練完成！\n');

    // 打印訓練歷史
    console.log('📊 訓練歷史:');
    console.log(JSON.stringify(history, null, 2));
    console.log('');

    // 4. 保存模型
    console.log('💾 保存模型...');
    await classifier.save();
    console.log('✅ 模型已保存到:', classifierModelDir);
    console.log('');

    console.log('🎉 訓練流程完成！');
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

