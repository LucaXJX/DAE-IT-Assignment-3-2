const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite3');
const db = new Database(dbPath);

console.log('📊 專案進度檢查\n');
console.log('='.repeat(60));

try {
  // 統計各狀態的圖像數量
  const statusQuery = db.prepare(`
    SELECT 
      download_status, 
      process_status, 
      COUNT(*) as count 
    FROM images 
    GROUP BY download_status, process_status
  `);

  const statusResults = statusQuery.all();

  console.log('\n📈 圖像狀態統計：');
  if (statusResults.length === 0) {
    console.log('   ⚠️  資料庫中尚無圖像資料');
  } else {
    statusResults.forEach(row => {
      console.log(`   下載: ${row.download_status.padEnd(12)} | 處理: ${row.process_status.padEnd(12)} | 數量: ${row.count}`);
    });
  }

  // 總計
  const totalQuery = db.prepare('SELECT COUNT(*) as total FROM images');
  const total = totalQuery.get();
  console.log(`\n📊 總計圖像數量: ${total.total}`);

  // 各關鍵字統計
  const keywordQuery = db.prepare(`
    SELECT 
      keyword,
      COUNT(*) as count
    FROM images
    WHERE keyword IS NOT NULL
    GROUP BY keyword
    ORDER BY count DESC
  `);

  const keywordResults = keywordQuery.all();
  if (keywordResults.length > 0) {
    console.log('\n🔍 各關鍵字統計：');
    keywordResults.forEach(row => {
      console.log(`   ${(row.keyword || 'null').padEnd(35)} : ${row.count} 張`);
    });
  }

  // 檔案大小統計（已處理的）
  const sizeQuery = db.prepare(`
    SELECT 
      AVG(file_size) as avg_size,
      MIN(file_size) as min_size,
      MAX(file_size) as max_size,
      COUNT(*) as count
    FROM images
    WHERE process_status = 'processed' AND file_size > 0
  `);

  const sizeStats = sizeQuery.get();
  if (sizeStats.count > 0) {
    console.log('\n💾 檔案大小統計（已處理）：');
    console.log(`   平均: ${(sizeStats.avg_size / 1024).toFixed(2)} KB`);
    console.log(`   最小: ${(sizeStats.min_size / 1024).toFixed(2)} KB`);
    console.log(`   最大: ${(sizeStats.max_size / 1024).toFixed(2)} KB`);
    console.log(`   數量: ${sizeStats.count} 張`);
    
    // 檢查是否符合 ≤50KB 要求
    const oversizeQuery = db.prepare(`
      SELECT COUNT(*) as count
      FROM images
      WHERE process_status = 'processed' AND file_size > 51200
    `);
    const oversize = oversizeQuery.get();
    console.log(`   超過 50KB: ${oversize.count} 張`);
    
    if (oversize.count === 0) {
      console.log('   ✅ 所有圖像符合大小要求');
    }
  }

  console.log('\n' + '='.repeat(60));

} catch (error) {
  console.error('❌ 查詢錯誤:', error.message);
} finally {
  db.close();
}

