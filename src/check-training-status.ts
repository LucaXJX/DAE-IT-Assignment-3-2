/**
 * 檢查訓練狀態腳本
 * 查看最新的訓練日誌，判斷訓練是否正在進行或已完成
 */

import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(process.cwd());
const logDir = path.join(rootDir, 'training_logs');

interface TrainingLog {
  metadata: {
    startTime: string;
    endTime: string | null;
    duration: number | null;
    totalEpochs: number;
    numClasses: number;
    totalImages: number;
  };
  epochs: Array<{
    epoch: number;
    loss: number;
    accuracy: number;
  }>;
}

function getLatestTrainingLog(): TrainingLog | null {
  if (!fs.existsSync(logDir)) {
    return null;
  }

  const files = fs.readdirSync(logDir)
    .filter(file => file.startsWith('training-') && file.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  const latestFile = path.join(logDir, files[0]);
  const content = fs.readFileSync(latestFile, 'utf-8');
  return JSON.parse(content);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '計算中...';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins} 分 ${secs} 秒`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-TW');
}

console.log('🔍 檢查訓練狀態...\n');

const log = getLatestTrainingLog();

if (!log) {
  console.log('❌ 未找到訓練日誌文件');
  console.log('   請先運行 `npm run train` 或 `npm run train:continue`');
  process.exit(1);
}

const { metadata, epochs } = log;
const isCompleted = metadata.endTime !== null;
const isInProgress = !isCompleted && epochs.length > 0;
const isStuck = !isCompleted && epochs.length === 0;

console.log('📊 最新訓練記錄:');
console.log(`   開始時間: ${formatTime(metadata.startTime)}`);
console.log(`   結束時間: ${isCompleted ? formatTime(metadata.endTime!) : '進行中...'}`);
console.log(`   訓練時長: ${formatDuration(metadata.duration)}`);
console.log(`   總輪數: ${metadata.totalEpochs}`);
console.log(`   已完成輪數: ${epochs.length}`);
console.log(`   類別數: ${metadata.numClasses}`);
console.log(`   圖片數: ${metadata.totalImages}`);

if (isCompleted) {
  console.log('\n✅ 訓練已完成！');
  if (epochs.length > 0) {
    const lastEpoch = epochs[epochs.length - 1];
    console.log(`\n📈 最終結果:`);
    console.log(`   Loss: ${lastEpoch.loss.toFixed(4)}`);
    console.log(`   Accuracy: ${(lastEpoch.accuracy * 100).toFixed(2)}%`);
  }
} else if (isInProgress) {
  console.log('\n⏳ 訓練正在進行中...');
  if (epochs.length > 0) {
    const lastEpoch = epochs[epochs.length - 1];
    console.log(`\n📈 最新進度 (Epoch ${lastEpoch.epoch}/${metadata.totalEpochs}):`);
    console.log(`   Loss: ${lastEpoch.loss.toFixed(4)}`);
    console.log(`   Accuracy: ${(lastEpoch.accuracy * 100).toFixed(2)}%`);
    
    const elapsed = (Date.now() - new Date(metadata.startTime).getTime()) / 1000;
    console.log(`\n⏱️  已用時間: ${formatDuration(elapsed)}`);
  }
} else if (isStuck) {
  console.log('\n⚠️  訓練可能卡住了！');
  console.log('   訓練已開始但還沒有完成任何一個 epoch');
  const elapsed = (Date.now() - new Date(metadata.startTime).getTime()) / 1000;
  console.log(`   已用時間: ${formatDuration(elapsed)}`);
  console.log('\n💡 建議:');
  console.log('   1. 檢查終端輸出，看看是否在載入圖片（這可能需要幾分鐘）');
  console.log('   2. 如果已經等待很久，可以按 Ctrl+C 中斷，然後重新運行');
  console.log('   3. 確保有足夠的內存和磁盤空間');
}

console.log('\n');

