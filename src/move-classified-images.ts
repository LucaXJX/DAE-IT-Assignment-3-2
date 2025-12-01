/**
 * 將已分類的圖片複製到 dataset/classified/ 文件夾
 * 
 * 功能：
 * 1. 查詢所有已標註為 food/other 的圖片
 * 2. 在 dataset/classified/ 下創建 food/ 和 other/ 文件夾
 * 3. 將圖片從原位置複製到 dataset/classified/{label}/{folder_name}/{file_name}
 * 4. 更新資料庫中的 folder_name 為 classified/{label}
 * 
 * 注意：原圖片會保留在原位置，不會被刪除
 */

import path from "path";
import fs from "fs";
import { db } from "./db";

const DATASET_DIR = path.resolve(__dirname, "../dataset");
const CLASSIFIED_DIR = path.join(DATASET_DIR, "classified");
const FOOD_DIR = path.join(CLASSIFIED_DIR, "food");
const OTHER_DIR = path.join(CLASSIFIED_DIR, "other");

function getFoodOtherLabelIds(): { foodId: number; otherId: number } {
  const foodRow = db
    .prepare(`SELECT id FROM labels WHERE name = 'food'`)
    .get() as { id?: number } | undefined;
  const otherRow = db
    .prepare(`SELECT id FROM labels WHERE name = 'other'`)
    .get() as { id?: number } | undefined;

  if (!foodRow?.id || !otherRow?.id) {
    throw new Error("food 或 other 標籤不存在於資料庫中");
  }

  return { foodId: foodRow.id, otherId: otherRow.id };
}

function ensureDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[創建目錄] ${dir}`);
  }
}

function copyFile(src: string, dest: string): boolean {
  try {
    // 確保目標目錄存在
    const destDir = path.dirname(dest);
    ensureDirectory(destDir);

    // 如果目標文件已存在，跳過
    if (fs.existsSync(dest)) {
      console.log(`[跳過] 目標文件已存在: ${dest}`);
      return false;
    }

    // 複製文件（原文件保留）
    fs.copyFileSync(src, dest);
    console.log(`[複製] ${src} -> ${dest}`);
    return true;
  } catch (error) {
    console.error(`[錯誤] 複製文件失敗: ${src}`, error);
    return false;
  }
}

function main() {
  console.log("開始複製已分類圖片...\n");

  // 確保分類目錄存在
  ensureDirectory(CLASSIFIED_DIR);
  ensureDirectory(FOOD_DIR);
  ensureDirectory(OTHER_DIR);

  const { foodId, otherId } = getFoodOtherLabelIds();

  // 查詢所有已分類的圖片
  const rows = db
    .prepare(
      `
      SELECT
        il.label_id,
        di.folder_name,
        i.file_name,
        di.id as dataset_image_id
      FROM image_labels il
      JOIN images i ON i.id = il.image_id
      JOIN dataset_images di ON di.image_id = i.id
      WHERE il.label_id IN (?, ?)
    `
    )
    .all(foodId, otherId) as {
    label_id: number;
    folder_name: string;
    file_name: string;
    dataset_image_id: number;
  }[];

  console.log(`找到 ${rows.length} 張已分類圖片\n`);

  let copiedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let updatedCount = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      const label = row.label_id === foodId ? "food" : "other";
      
      // 原文件路徑：dataset/{folder_name}/{file_name}
      const srcPath = path.join(DATASET_DIR, row.folder_name, row.file_name);
      
      // 新文件路徑：dataset/classified/{label}/{folder_name}/{file_name}
      // 保持原 folder_name（國家）作為子目錄，方便組織
      const destPath = path.join(CLASSIFIED_DIR, label, row.folder_name, row.file_name);

      // 檢查源文件是否存在
      if (!fs.existsSync(srcPath)) {
        console.log(`[警告] 源文件不存在: ${srcPath}`);
        errorCount++;
        continue;
      }

      // 複製文件（原文件保留）
      const copied = copyFile(srcPath, destPath);
      
      if (copied) {
        copiedCount++;
        
        // 更新資料庫中的 folder_name
        // 新路徑格式：classified/{label}/{folder_name}
        const newFolderName = `classified/${label}/${row.folder_name}`;
        db.prepare(
          `UPDATE dataset_images SET folder_name = ? WHERE id = ?`
        ).run(newFolderName, row.dataset_image_id);
        updatedCount++;
      } else {
        skippedCount++;
      }
    }
  });

  tx();

  console.log("\n=== 複製完成 ===");
  console.log(`成功複製: ${copiedCount} 張`);
  console.log(`跳過: ${skippedCount} 張`);
  console.log(`錯誤: ${errorCount} 張`);
  console.log(`資料庫更新: ${updatedCount} 筆`);
  console.log(`\n分類圖片位置: ${CLASSIFIED_DIR}`);
  console.log(`注意: 原圖片仍保留在原位置，未被刪除`);
}

if (require.main === module) {
  main();
}

export { main as moveClassifiedImages };

