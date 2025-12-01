/**
 * 圖片分類 Web UI（手動標註 + 與 image-dataset 類似的 API）
 *
 * 目前功能：
 * - 基於資料夾 (folder_name / country) 分組顯示未標註圖片（/unclassified）
 * - 以 food / other 兩類彙總已標註圖片（/classified）
 * - 將選定圖片標成 food / other，寫入資料庫（/correct）
 *
 * 後續會在前端整合 @tensorflow/tfjs 做瀏覽器端的 transfer learning。
 */

import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { db } from "./db";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8100;
const DATASET_DIR = path.resolve(__dirname, "../dataset");
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const FOOD_DIR = path.join(DATASET_DIR, "food");
const OTHER_DIR = path.join(DATASET_DIR, "other");

app.use(cors());
app.use(express.json());
// 提供圖片文件與前端靜態資源
app.use(express.static(DATASET_DIR));
app.use(express.static(PUBLIC_DIR));

/**
 * 舊版 API：獲取指定目錄下的圖片列表
 * （暫時保留，方便你繼續使用現有簡單 UI）
 */
app.get("/api/images/:category", (req: any, res: any) => {
  const category = req.params.category;
  const dir = category === "food" ? FOOD_DIR : OTHER_DIR;

  if (!fs.existsSync(dir)) {
    return res.json({ images: [] });
  }

  const files = fs
    .readdirSync(dir)
    .filter((file: string) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    })
    .map((file: string) => ({
      name: file,
      url: `/api/image-file/${category}/${file}`,
      path: path.join(dir, file),
    }));

  res.json({ images: files, count: files.length });
});

/**
 * 舊版 API：提供圖片文件
 */
app.get("/api/image-file/:category/:filename", (req: any, res: any) => {
  const category = req.params.category;
  const filename = req.params.filename;
  const dir = category === "food" ? FOOD_DIR : OTHER_DIR;
  const filePath = path.join(dir, filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("Image not found");
  }
});

/**
 * 舊版 API：移動圖片從一個類別到另一個類別（pure filesystem）
 */
app.post("/api/move-image", (req: any, res: any) => {
  const { filename, from, to } = req.body;

  if (!filename || !from || !to) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const fromDir = from === "food" ? FOOD_DIR : OTHER_DIR;
  const toDir = to === "food" ? FOOD_DIR : OTHER_DIR;

  const fromPath = path.join(fromDir, filename);
  const toPath = path.join(toDir, filename);

  try {
    if (!fs.existsSync(fromPath)) {
      return res.status(404).json({ error: "Source file not found" });
    }

    // 確保目標目錄存在
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }

    // 移動文件
    fs.renameSync(fromPath, toPath);

    res.json({
      success: true,
      message: `Moved ${filename} from ${from} to ${to}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 舊版 API：獲取統計信息（僅 food/other 檔案數）
 */
app.get("/api/stats", (req: any, res: any) => {
  const getImageCount = (dir: string) => {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((file: string) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    }).length;
  };

  const foodCount = getImageCount(FOOD_DIR);
  const otherCount = getImageCount(OTHER_DIR);

  res.json({
    food: foodCount,
    other: otherCount,
    total: foodCount + otherCount,
  });
});

app.get("/", (req: any, res: any) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/**
 * ===== image-dataset 風格 API（基於資料庫）=====
 *
 * /unclassified
 * /classified
 * /correct
 *
 * 注意：
 * - 真正的 label 只有 food / other 兩種（用於訓練）
 * - Unclassified 依資料夾 / 國家分組顯示，方便你檢查
 */

function ensureLabel(name: "food" | "other"): number {
  const now = new Date().toISOString();
  const row = db.prepare("SELECT id FROM labels WHERE name = ?").get(name) as
    | { id?: number }
    | undefined;
  if (row && row.id) return row.id;
  const info = db
    .prepare(
      `INSERT INTO labels (name, description, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, name, "food-other", now, now);
  return Number(info.lastInsertRowid);
}

function getFoodOtherLabelIds(): { foodId: number; otherId: number } {
  const foodId = ensureLabel("food");
  const otherId = ensureLabel("other");
  return { foodId, otherId };
}

/**
 * Unclassified：依資料夾分組的未標註圖片列表
 */
app.get("/unclassified", (req: any, res: any) => {
  const { foodId, otherId } = getFoodOtherLabelIds();

  // 取出所有 dataset_images + 對應 images
  const rows = db
    .prepare(
      `
      SELECT
        di.folder_name,
        i.id as image_id,
        i.file_name,
        i.file_path
      FROM dataset_images di
      JOIN images i ON i.id = di.image_id
      WHERE NOT EXISTS (
        SELECT 1 FROM image_labels il
        WHERE il.image_id = i.id
          AND il.label_id IN (?, ?)
      )
    `
    )
    .all(foodId, otherId) as {
    folder_name: string;
    image_id: number;
    file_name: string;
    file_path: string;
  }[];

  const classesMap: Record<
    string,
    { className: string; images: { filename: string; results: any[] }[] }
  > = {};

  for (const row of rows) {
    const className = row.folder_name || "unknown";
    // 使用 URL 友善的路徑分隔符（避免 Windows 的反斜線）
    const relPath = `${className}/${row.file_name}`; // e.g. Brazil/xxx.jpg
    if (!classesMap[className]) {
      classesMap[className] = { className, images: [] };
    }
    classesMap[className].images.push({
      filename: relPath,
      results: [], // 之後模型預測會填進來
    });
  }

  const result = {
    classes: Object.values(classesMap).map((cls) => ({
      className: cls.className,
      images: cls.images,
    })),
  };

  res.json(result);
});

/**
 * Classified：依 food / other 聚合已標註圖片
 */
app.get("/classified", (req: any, res: any) => {
  const { foodId, otherId } = getFoodOtherLabelIds();

  const rows = db
    .prepare(
      `
      SELECT
        il.label_id,
        di.folder_name,
        i.file_name
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
  }[];

  const classesMap: Record<string, { className: string; filenames: string[] }> =
    {
      food: { className: "food", filenames: [] },
      other: { className: "other", filenames: [] },
    };

  for (const row of rows) {
    const className = row.label_id === foodId ? "food" : "other";
    const relPath = `${row.folder_name}/${row.file_name}`; // e.g. Brazil/xxx.jpg
    classesMap[className].filenames.push(relPath);
  }

  const result = {
    classes: Object.values(classesMap),
  };

  res.json(result);
});

/**
 * Correct：把選定圖片標成 food / other
 * body: { className: 'food' | 'other', images: string[] }
 * images 內容為圖片的 src，例如：
 *   /unclassified/Brazil/xxx.jpg
 *   /classified/food/Brazil/xxx.jpg
 */
app.post("/correct", (req: any, res: any) => {
  const { className, images } = req.body as {
    className?: string;
    images?: string[];
  };

  if (!className || !["food", "other"].includes(className)) {
    return res
      .status(400)
      .json({ error: "Invalid className, must be food/other" });
  }
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "No images provided" });
  }

  const { foodId, otherId } = getFoodOtherLabelIds();
  const targetLabelId = className === "food" ? foodId : otherId;
  const now = new Date().toISOString();

  const parseImagePath = (
    src: string
  ): { folder_name: string; file_name: string } | null => {
    try {
      // 支援三種格式：
      // 1) /unclassified/Brazil/xxx.jpg
      // 2) /classified/food/Brazil/xxx.jpg
      // 3) Brazil/xxx.jpg（無前導斜線）
      let pathname = src;

      if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
        const url = new URL(src);
        pathname = url.pathname;
      }

      if (pathname.startsWith("/unclassified/")) {
        const rel = pathname.replace("/unclassified/", ""); // e.g. Brazil/xxx.jpg
        const [folder_name, ...rest] = rel.split("/");
        return { folder_name, file_name: rest.join("/") };
      }
      if (pathname.startsWith("/classified/")) {
        const rel = pathname.replace("/classified/", ""); // e.g. food/Brazil/xxx.jpg
        const [, ...rest] = rel.split("/"); // skip label segment
        const [folder_name, ...rest2] = rest;
        return { folder_name, file_name: rest2.join("/") };
      }
      // 默認視為 "folder/file" 格式
      if (!pathname.startsWith("/")) {
        const [folder_name, ...rest] = pathname.split("/");
        return { folder_name, file_name: rest.join("/") };
      }
      return null;
    } catch {
      return null;
    }
  };

  const tx = db.transaction(() => {
    let updatedCount = 0;
    for (const src of images) {
      const parsed = parseImagePath(src);
      if (!parsed) continue;
      const { folder_name, file_name } = parsed;

      const imageRow = db
        .prepare(
          `
          SELECT i.id as image_id
          FROM images i
          JOIN dataset_images di ON di.image_id = i.id
          WHERE di.folder_name = ? AND i.file_name = ?
        `
        )
        .get(folder_name, file_name) as { image_id?: number } | undefined;

      if (!imageRow || !imageRow.image_id) continue;
      const imageId = imageRow.image_id;

      // 刪除原本 food/other 標籤
      db.prepare(
        `DELETE FROM image_labels WHERE image_id = ? AND label_id IN (?, ?)`
      ).run(imageId, foodId, otherId);

      // 插入新的標籤
      db.prepare(
        `
        INSERT INTO image_labels
          (image_id, label_id, confidence, is_manual, is_reviewed, reviewed_at, reviewed_by, model_version, created_at, updated_at)
        VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?)
      `
      ).run(imageId, targetLabelId, 1.0, now, "manual", "browser-ui", now, now);
      updatedCount++;
    }
    return updatedCount;
  });

  try {
    const updatedCount = tx();
    console.log(
      "[correct] className=%s, images=%d, updated=%d",
      className,
      images.length,
      updatedCount
    );
    res.json({ success: true, updatedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

/**
 * 複製已分類圖片到 dataset/classified/ 文件夾
 */
app.post("/move-classified", async (req: any, res: any) => {
  try {
    // 動態導入複製函數
    const { moveClassifiedImages } = await import("./move-classified-images");
    
    // 執行複製（這會同步執行，可能需要一些時間）
    moveClassifiedImages();
    
    res.json({ 
      success: true, 
      message: "已分類圖片複製完成，請查看終端輸出了解詳情。原圖片仍保留在原位置。" 
    });
  } catch (error: any) {
    console.error("[move-classified] 錯誤:", error);
    res.status(500).json({ 
      error: error.message || String(error) 
    });
  }
});

// 啟動服務器
app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("🌐 圖片分類 Web UI 已啟動！");
  console.log("=".repeat(60));
  console.log(`📍 訪問地址: http://localhost:${PORT}`);
  console.log("");
  console.log("功能：");
  console.log("  ✅ 瀏覽 food/ 和 other/ 目錄中的圖片");
  console.log("  ✅ 將圖片從一個類別移動到另一個類別");
  console.log("  ✅ 實時顯示統計信息");
  console.log("");
  console.log("按 Ctrl+C 停止服務器");
  console.log("=".repeat(60));
});
