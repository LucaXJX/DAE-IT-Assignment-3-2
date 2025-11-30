/**
 * 修復 Brazil 數據問題
 * 查找並修復或刪除 file_name 字段錯誤的記錄
 */

import { db } from './db';

console.log('🔍 檢查 Brazil 相關的數據問題...\n');

// 查找所有 Brazil 相關的圖片記錄
const brazilStmt = db.prepare(`
  SELECT i.id, i.keyword, i.file_name, i.url, i.download_status, i.process_status
  FROM images i
  WHERE i.keyword LIKE '%Brazil%' OR i.file_name LIKE '%Brazil%'
  ORDER BY i.id
`);

const brazilImages = brazilStmt.all() as any[];

console.log(`📊 找到 ${brazilImages.length} 條 Brazil 相關的圖片記錄\n`);

// 檢查有問題的記錄
const problematicImages: any[] = [];

brazilImages.forEach(img => {
  // 檢查 file_name 是否不像是文件名（例如包含關鍵字而不是文件名）
  const hasProblem = 
    !img.file_name || 
    img.file_name.includes('Brazilian feijoada traditional food') ||
    (!img.file_name.includes('processed_') && !img.file_name.includes('.jpg') && !img.file_name.includes('.png'));
  
  if (hasProblem) {
    problematicImages.push(img);
  }
});

if (problematicImages.length === 0) {
  console.log('✅ 沒有發現問題記錄');
  process.exit(0);
}

console.log(`⚠️  發現 ${problematicImages.length} 條問題記錄：\n`);

problematicImages.forEach((img, index) => {
  console.log(`${index + 1}. ID: ${img.id}`);
  console.log(`   關鍵字: ${img.keyword}`);
  console.log(`   文件名: ${img.file_name}`);
  console.log(`   下載狀態: ${img.download_status}`);
  console.log(`   處理狀態: ${img.process_status}`);
  console.log('');
});

// 檢查這些記錄是否有標籤
console.log('🔍 檢查這些記錄是否有標籤...\n');

const ids = problematicImages.map(img => img.id);
const placeholders = ids.map(() => '?').join(',');

const labelsStmt = db.prepare(`
  SELECT il.id, il.image_id, il.label, il.is_manual, il.reviewed, il.confidence
  FROM image_labels il
  WHERE il.image_id IN (${placeholders})
`);

const labels = labelsStmt.all(...ids) as any[];

console.log(`📊 找到 ${labels.length} 條相關標籤\n`);

if (labels.length > 0) {
  console.log('標籤詳情：');
  labels.forEach(label => {
    console.log(`  - 圖片 ID: ${label.image_id}, 標籤: ${label.label}, 手動: ${label.is_manual}, 已審核: ${label.reviewed}`);
  });
  console.log('');
}

// 詢問用戶是否要刪除這些記錄
console.log('⚠️  建議操作：');
console.log('   - 如果有標籤，可以選擇刪除標籤或刪除整個圖片記錄');
console.log('   - 如果沒有標籤，可以直接刪除圖片記錄\n');

// 檢查文件是否存在
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(process.cwd());
const imagesDir = path.join(rootDir, 'images/processed');

console.log('📁 檢查對應的文件是否存在：\n');

problematicImages.forEach(img => {
  let expectedPath: string;
  
  if (img.file_name.includes('/')) {
    // 如果 file_name 包含路徑
    expectedPath = path.join(imagesDir, img.file_name);
  } else {
    // 嘗試從關鍵字推斷路徑
    // 關鍵字 "Brazilian feijoada traditional food" -> 國家 "Brazil"
    const country = 'Brazil';
    expectedPath = path.join(imagesDir, country, img.file_name);
  }
  
  const exists = fs.existsSync(expectedPath);
  console.log(`  ID ${img.id}: ${exists ? '✅' : '❌'} ${expectedPath}`);
});

console.log('\n');

// 提供修復選項
console.log('💡 修復選項：');
console.log('   1. 刪除所有問題記錄（包括標籤）');
console.log('   2. 只刪除標籤，保留圖片記錄');
console.log('   3. 只刪除圖片記錄（如果沒有標籤）');
console.log('   4. 手動修復（需要指定正確的 file_name）\n');

// 自動刪除有問題的記錄（包括標籤）
console.log('🗑️  開始清理問題記錄...\n');

const deleteTransaction = db.transaction(() => {
  let deletedImages = 0;
  let deletedLabels = 0;
  
  // 先刪除標籤
  if (labels.length > 0) {
    const deleteLabelsStmt = db.prepare(`
      DELETE FROM image_labels
      WHERE image_id IN (${placeholders})
    `);
    deletedLabels = deleteLabelsStmt.run(...ids).changes;
    console.log(`   ✅ 刪除了 ${deletedLabels} 條標籤記錄`);
  }
  
  // 再刪除圖片記錄
  const deleteImagesStmt = db.prepare(`
    DELETE FROM images
    WHERE id IN (${placeholders})
  `);
  deletedImages = deleteImagesStmt.run(...ids).changes;
  console.log(`   ✅ 刪除了 ${deletedImages} 條圖片記錄`);
  
  return { deletedImages, deletedLabels };
});

try {
  const result = deleteTransaction();
  console.log(`\n✅ 清理完成！共刪除 ${result.deletedImages} 條圖片記錄和 ${result.deletedLabels} 條標籤記錄`);
} catch (error) {
  console.error('❌ 刪除失敗:', error);
  process.exit(1);
}

console.log('\n✨ 操作完成！');

