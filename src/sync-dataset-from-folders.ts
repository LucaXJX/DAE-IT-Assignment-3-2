/**
 * 將現有資料夾中的圖片，同步到 datasets / dataset_images 表
 *
 * 目的：
 * - 讓 /unclassified 可以依資料夾（country）分組顯示圖片
 * - 不改動現有文件結構，只寫入/補齊資料庫關聯
 *
 * 規則：
 * - 掃描 ../dataset/{folder_name}/*.jpg|jpeg|png|webp
 * - 對每張圖片：
 *   - 優先用 (images.country, images.file_name) 尋找對應的 image 記錄
 *   - 找到後，在 dataset_images 裡插入 (dataset_id, image_id, folder_name)
 *   - 若找不到 image 記錄，先略過並在終端列出，之後可以視需要補匯入
 */

import fs from 'fs';
import path from 'path';
import { db } from './db';

const DATASET_ROOT = path.resolve(__dirname, '../dataset');

function ensureDataset(): number {
  const now = new Date().toISOString();
  const row = db
    .prepare('SELECT id FROM datasets WHERE name = ?')
    .get('main') as { id?: number } | undefined;
  if (row && row.id) return row.id;

  const info = db
    .prepare(
      `
      INSERT INTO datasets (name, description, source_type, dataset_path, total_images, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      'main',
      'Main dataset synced from folder structure',
      'manual',
      DATASET_ROOT,
      0,
      now,
      now,
    );

  return Number(info.lastInsertRowid);
}

function isImageFile(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
}

function main() {
  if (!fs.existsSync(DATASET_ROOT)) {
    console.error('[sync-dataset] dataset 資料夾不存在：', DATASET_ROOT);
    process.exit(1);
  }

  const datasetId = ensureDataset();
  console.log('[sync-dataset] 使用 datasets.id =', datasetId);

  const folders = fs
    .readdirSync(DATASET_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  if (folders.length === 0) {
    console.log('[sync-dataset] dataset 根目錄下沒有任何子資料夾，無需同步。');
    process.exit(0);
  }

  console.log('[sync-dataset] 發現資料夾：', folders.join(', '));

  let linkedCount = 0;
  const missingImages: { folder: string; file: string }[] = [];

  const tx = db.transaction(() => {
    for (const folder of folders) {
      const folderPath = path.join(DATASET_ROOT, folder);
      const files = fs
        .readdirSync(folderPath, { withFileTypes: true })
        .filter(d => d.isFile() && isImageFile(d.name))
        .map(d => d.name);

      if (files.length === 0) continue;

      console.log(`[sync-dataset] 資料夾 ${folder} 中發現 ${files.length} 張圖片`);

      for (const fileName of files) {
        // 先試著用 country + file_name 尋找 image 記錄
      // 先用 (country, file_name) 尋找
      let imageRow = db
        .prepare(
          `
          SELECT id FROM images
          WHERE country = ? AND file_name = ?
        `,
        )
        .get(folder, fileName) as { id?: number } | undefined;

      const absPath = path.join(folderPath, fileName);

      // 再嘗試用 file_path 尋找（避免重複插入同一檔案）
      if (!imageRow || !imageRow.id) {
        imageRow = db
          .prepare(
            `
            SELECT id FROM images
            WHERE file_path = ?
          `,
          )
          .get(absPath) as { id?: number } | undefined;
      }

      // 若資料庫中沒有對應的 image 記錄，則自動建立一筆最小資訊的紀錄
      if (!imageRow || !imageRow.id) {
        missingImages.push({ folder, file: fileName });

        const now = new Date().toISOString();
        const info = db
          .prepare(
            `
            INSERT INTO images (
              keyword,
              url,
              alt_text,
              file_name,
              file_path,
              country,
              download_status,
              process_status,
              file_size,
              width,
              height,
              channels,
              format,
              checksum,
              error_message,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          )
          .run(
            null, // keyword
            absPath, // url 使用絕對路徑，保證 unique
            '', // alt_text
            fileName,
            absPath,
            folder,
            'downloaded',
            'processed',
            0,
            0,
            0,
            null,
            null,
            null,
            '',
            now,
            now,
          );

        imageRow = { id: Number(info.lastInsertRowid) };
      }

        const imageId = imageRow.id!;

        // 檢查 dataset_images 是否已存在關聯
        const existing = db
          .prepare(
            `
            SELECT id FROM dataset_images
            WHERE dataset_id = ? AND image_id = ?
          `,
          )
          .get(datasetId, imageId) as { id?: number } | undefined;

        if (existing && existing.id) {
          continue;
        }

        db.prepare(
          `
          INSERT INTO dataset_images (dataset_id, image_id, folder_name, created_at)
          VALUES (?, ?, ?, ?)
        `,
        ).run(datasetId, imageId, folder, new Date().toISOString());

        linkedCount++;
      }
    }
  });

  tx();

  console.log(`[sync-dataset] 新增 dataset_images 關聯筆數：${linkedCount}`);

  if (missingImages.length > 0) {
    console.log('[sync-dataset] 下列圖片在 images 資料表中找不到紀錄（已略過）：');
    for (const { folder, file } of missingImages.slice(0, 50)) {
      console.log(`  - ${folder}/${file}`);
    }
    if (missingImages.length > 50) {
      console.log(`  ... 其餘 ${missingImages.length - 50} 張略過`);
    }
  } else {
    console.log('[sync-dataset] 所有圖片皆已在 images 表中找到對應紀錄。');
  }

  console.log('[sync-dataset] 完成。');
}

main();


