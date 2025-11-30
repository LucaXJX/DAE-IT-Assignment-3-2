/**
 * 準備訓練數據集腳本
 * 直接執行，無需啟動服務器
 */

import { prepareTrainingDataset, getDatasetStats } from './train-helper';

console.log('🚀 開始準備訓練數據集...\n');

const result = prepareTrainingDataset();

if (result.success) {
  console.log('✅ 訓練數據集準備完成！\n');
  console.log(`📊 統計信息:`);
  console.log(`   - 總圖片數: ${result.totalImages}`);
  console.log(`   - 類別數: ${Object.keys(result.categories).length}\n`);
  console.log('📁 各類別圖片數量:');
  Object.entries(result.categories).forEach(([label, count]) => {
    console.log(`   - ${label}: ${count} 張`);
  });
  
  // 顯示實際數據集統計
  console.log('\n📂 數據集目錄統計:');
  const stats = getDatasetStats();
  console.log(`   - 總圖片數: ${stats.totalImages}`);
  Object.entries(stats.categories).forEach(([label, count]) => {
    console.log(`   - ${label}: ${count} 張`);
  });
  
  console.log('\n✨ 準備完成！現在可以運行 `npm run train:continue` 進行繼續訓練。');
  process.exit(0);
} else {
  console.error('❌ 準備訓練數據集失敗:', result.error);
  process.exit(1);
}

