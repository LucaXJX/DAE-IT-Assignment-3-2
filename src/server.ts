import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import {
  saveImageLabel,
  getImageLabels,
  deleteImageLabel,
  markLabelAsReviewed,
  getImageIdFromPath,
  createImageRecordIfNotExists,
  getLabeledStats,
  getUnlabeledImages,
  getUnlabeledImagesPerCountry,
  getImagesByLabel,
  getLabeledImageIds,
} from "./image-label-helper";
import {
  prepareTrainingDataset,
  getDatasetStats,
  isDatasetReady,
} from "./train-helper";
import {
  classifyImage,
  classifyImagesBatch,
  isModelAvailable,
  getModelInfo,
} from "./classifier";

const app = express();
const PORT = process.env.PORT || 3000;

// 獲取項目根目錄（無論是在 src/ 還是 dist/）
const rootDir = path.resolve(process.cwd());

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態文件服務 - 圖片目錄
const imagesDir = path.join(rootDir, "images/processed");
console.log(`📁 圖片目錄路徑: ${imagesDir}`);
console.log(`📁 圖片目錄是否存在: ${fs.existsSync(imagesDir)}`);

// 配置靜態文件服務
app.use(
  "/images",
  express.static(imagesDir, {
    // 設置響應頭，允許跨域
    setHeaders: (res, filePath) => {
      // 確保圖片文件可以被正確識別
      if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (filePath.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      } else if (filePath.endsWith(".gif")) {
        res.setHeader("Content-Type", "image/gif");
      } else if (filePath.endsWith(".webp")) {
        res.setHeader("Content-Type", "image/webp");
      }
    },
  })
);

// 調試：添加一個測試端點來檢查圖片服務
app.get("/api/debug/image-path/:country/:filename", (req, res) => {
  const { country, filename } = req.params;
  const imagePath = path.join(imagesDir, country, filename);
  const exists = fs.existsSync(imagePath);

  res.json({
    requestedPath: `/images/${country}/${filename}`,
    actualPath: imagePath,
    exists,
    imagesDir,
    rootDir,
  });
});

// 備用圖片服務端點（直接提供圖片文件，處理中文路徑問題）
// 使用不同的路由避免與其他 API 衝突
app.get("/api/image-file/:country/:filename", (req, res) => {
  try {
    const { country, filename } = req.params;
    const imagePath = path.join(imagesDir, country, filename);

    // 檢查文件是否存在
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: "圖片文件不存在",
        path: imagePath,
      });
    }

    // 獲取文件擴展名來確定 Content-Type
    const ext = path.extname(filename).toLowerCase();
    let contentType = "application/octet-stream";

    if (ext === ".jpg" || ext === ".jpeg") {
      contentType = "image/jpeg";
    } else if (ext === ".png") {
      contentType = "image/png";
    } else if (ext === ".gif") {
      contentType = "image/gif";
    } else if (ext === ".webp") {
      contentType = "image/webp";
    }

    // 設置響應頭
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 緩存 1 年

    // 發送文件
    res.sendFile(imagePath, (err) => {
      if (err) {
        console.error("發送圖片文件失敗:", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: "發送圖片文件失敗",
            message: err.message,
          });
        }
      }
    });
  } catch (error) {
    console.error("處理圖片請求失敗:", error);
    res.status(500).json({
      success: false,
      error: "處理圖片請求失敗",
      message: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 提供前端頁面
const publicDir = path.join(rootDir, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

interface ImageInfo {
  id: string;
  country: string;
  filename: string;
  path: string;
  url: string;
  apiUrl?: string; // 備用 API 端點
}

// 獲取所有圖片列表
app.get("/api/images", async (req, res) => {
  try {
    const { label } = req.query; // 可選的標籤篩選參數

    // 如果指定了標籤（特別是「其他」），從資料庫獲取
    if (label && label === "其他") {
      const labeledImages = getImagesByLabel("其他");
      const images: ImageInfo[] = labeledImages.map((img) => {
        // 解析 filePath 獲取 country 和 filename
        const parts = img.filePath.split("/");
        const filename = parts.pop() || "";
        const country = parts[0] || "";

        return {
          id: `${country}_${filename}`,
          country: country || "其他",
          filename,
          path: img.filePath,
          url: `/images/${img.filePath}`,
          apiUrl: `/api/image-file/${country || "其他"}/${filename}`,
        };
      });

      return res.json({
        success: true,
        images,
        total: images.length,
      });
    }

    // 從文件系統獲取所有圖片
    const countries = fs.readdirSync(imagesDir).filter((item) => {
      const itemPath = path.join(imagesDir, item);
      return fs.statSync(itemPath).isDirectory();
    });

    const allImages: ImageInfo[] = [];

    // 獲取已標註的圖片 ID（用於標記哪些圖片已標註）
    const labeledImageIds = getLabeledImageIds();

    countries.forEach((country) => {
      const countryDir = path.join(imagesDir, country);
      const files = fs.readdirSync(countryDir).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
      });

      files.forEach((file) => {
        const fileId = `${country}_${file}`;
        const filePath = `${country}/${file}`;
        const fullPath = path.join(imagesDir, country, file);

        // 驗證文件是否存在（用於調試）
        if (!fs.existsSync(fullPath)) {
          console.warn(`⚠️  警告：圖片文件不存在: ${fullPath}`);
        }

        // 檢查這張圖片是否已標註（通過資料庫記錄）
        // 注意：這裡我們需要檢查資料庫中是否有這張圖片的記錄
        // 簡化處理：如果 filePath 在資料庫中存在且有標籤，則認為已標註

        // 優先使用 API 端點，如果靜態文件服務失敗，可以使用備用端點
        // 靜態文件服務: /images/Brazil/file.jpg
        // 備用 API 端點: /api/image-file/Brazil/file.jpg
        allImages.push({
          id: fileId,
          country,
          filename: file,
          path: filePath,
          url: `/images/${filePath.replace(/\\/g, "/")}`, // 優先使用靜態文件服務
          apiUrl: `/api/image-file/${country}/${file}`, // 備用 API 端點
        });
      });
    });

    res.json({
      success: true,
      images: allImages,
      total: allImages.length,
    });
  } catch (error) {
    console.error("獲取圖片列表失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 獲取特定國家的圖片
app.get("/api/images/:country", async (req, res) => {
  try {
    const { country } = req.params;
    const countryDir = path.join(imagesDir, country);

    if (!fs.existsSync(countryDir)) {
      return res.status(404).json({
        success: false,
        error: "國家目錄不存在",
      });
    }

    const files = fs.readdirSync(countryDir).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
    });

    const images: ImageInfo[] = files.map((file) => ({
      id: `${country}_${file}`,
      country,
      filename: file,
      path: path.join(country, file),
      url: `/images/${country}/${file}`,
    }));

    res.json({
      success: true,
      images,
      total: images.length,
    });
  } catch (error) {
    console.error("獲取圖片失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 保存圖片標籤
app.post("/api/images/:imageId/label", async (req, res) => {
  try {
    const { imageId } = req.params;
    const { label, isManual = true, confidence } = req.body;

    if (!label || typeof label !== "string" || label.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "標籤不能為空",
      });
    }

    // 解析圖片 ID (格式: country_filename.jpg)
    const [country, ...filenameParts] = imageId.split("_");
    const filename = filenameParts.join("_");

    // 獲取資料庫中的圖片 ID，如果不存在則創建記錄
    let dbImageId = getImageIdFromPath(country, filename);

    if (!dbImageId) {
      // 如果資料庫中沒有這張圖片，檢查文件是否存在，如果存在則創建記錄
      const imagePath = path.join(imagesDir, country, filename);
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          success: false,
          error: "圖片文件不存在",
        });
      }

      // 創建資料庫記錄
      dbImageId = createImageRecordIfNotExists(country, filename);
    }

    // 確定參數值（確保所有參數都有值）
    const finalIsManual = typeof isManual === "boolean" ? isManual : true;
    const finalConfidence =
      typeof confidence === "number" ? confidence : finalIsManual ? 1.0 : 0.0;
    const finalReviewed = finalIsManual; // 手動標註默認已審核

    // 保存標籤到資料庫
    const labelId = saveImageLabel({
      image_id: dbImageId,
      label: label.trim(),
      confidence: finalConfidence,
      is_manual: finalIsManual,
      reviewed: finalReviewed,
    });

    res.json({
      success: true,
      message: "標籤已保存",
      data: {
        labelId,
        imageId: dbImageId,
        label,
        isManual,
      },
    });
  } catch (error) {
    console.error("保存標籤失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 獲取圖片標籤
app.get("/api/images/:imageId/labels", async (req, res) => {
  try {
    const { imageId } = req.params;

    // 解析圖片 ID (格式: country_filename.jpg)
    const [country, ...filenameParts] = imageId.split("_");
    const filename = filenameParts.join("_");

    // 獲取資料庫中的圖片 ID，如果不存在則創建記錄
    let dbImageId = getImageIdFromPath(country, filename);

    if (!dbImageId) {
      // 如果資料庫中沒有記錄，檢查文件是否存在
      const imagePath = path.join(imagesDir, country, filename);
      if (fs.existsSync(imagePath)) {
        dbImageId = createImageRecordIfNotExists(country, filename);
      } else {
        return res.json({
          success: true,
          labels: [],
        });
      }
    }

    // 從資料庫獲取標籤
    const labels = getImageLabels(dbImageId);

    res.json({
      success: true,
      labels: labels.map((label) => ({
        id: label.id,
        label: label.label,
        confidence: label.confidence,
        isManual: label.is_manual,
        reviewed: label.reviewed,
      })),
    });
  } catch (error) {
    console.error("獲取標籤失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 分類圖片（AI 預測）
app.post("/api/images/:imageId/classify", async (req, res) => {
  try {
    const { imageId } = req.params;
    const { topK = 3 } = req.body;

    // 檢查模型是否可用
    if (!isModelAvailable()) {
      return res.status(503).json({
        success: false,
        error: "模型尚未訓練或不可用，請先訓練模型",
      });
    }

    // 解析 imageId（格式：country_filename.jpg）
    const [country, ...filenameParts] = imageId.split("_");
    const filename = filenameParts.join("_");

    // 構建完整的圖片路徑
    const imagePath = path.join(imagesDir, country, filename);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: "圖片文件不存在",
      });
    }

    // 進行分類預測
    console.log(`🔍 開始分類圖片: ${imagePath}`);
    const predictions = await classifyImage(imagePath, topK);
    console.log(`✅ 分類成功，結果數量: ${predictions.length}`);

    res.json({
      success: true,
      predictions,
    });
  } catch (error) {
    console.error("❌ 分類失敗:", error);
    const errorMessage = error instanceof Error ? error.message : "未知錯誤";
    const errorStack = error instanceof Error ? error.stack : undefined;

    // 記錄詳細錯誤信息
    if (errorStack) {
      console.error("錯誤堆棧:", errorStack);
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? errorStack : undefined,
    });
  }
});

// 獲取所有國家列表
app.get("/api/countries", async (req, res) => {
  try {
    const countries = fs.readdirSync(imagesDir).filter((item) => {
      const itemPath = path.join(imagesDir, item);
      return fs.statSync(itemPath).isDirectory();
    });

    // 統計每個國家的圖片數量
    const countriesWithCount = countries.map((country) => {
      const countryDir = path.join(imagesDir, country);
      const files = fs.readdirSync(countryDir).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
      });
      return {
        name: country,
        count: files.length,
      };
    });

    // 添加「其他」選項
    countriesWithCount.push({
      name: "其他",
      count: 0,
    });

    res.json({
      success: true,
      countries: countriesWithCount,
      total: countries.length + 1,
    });
  } catch (error) {
    console.error("獲取國家列表失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 獲取標籤統計
app.get("/api/stats/labels", async (req, res) => {
  try {
    const stats = getLabeledStats();

    // 計算總圖片數（從文件系統）
    let totalImages = 0;
    try {
      const countries = fs.readdirSync(imagesDir).filter((item) => {
        const itemPath = path.join(imagesDir, item);
        return fs.statSync(itemPath).isDirectory();
      });

      countries.forEach((country) => {
        const countryDir = path.join(imagesDir, country);
        const files = fs.readdirSync(countryDir).filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
        });
        totalImages += files.length;
      });
    } catch (error) {
      console.error("計算總圖片數失敗:", error);
    }

    // 計算未標註的圖片數
    const unlabeledCount = Math.max(0, totalImages - stats.totalLabeled);

    res.json({
      success: true,
      stats: {
        ...stats,
        totalImages,
        totalUnlabeled: unlabeledCount,
      },
    });
  } catch (error) {
    console.error("獲取統計失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 刪除標籤
app.delete("/api/images/:imageId/labels/:labelId", async (req, res) => {
  try {
    const { labelId } = req.params;
    const success = deleteImageLabel(parseInt(labelId));

    res.json({
      success,
      message: success ? "標籤已刪除" : "標籤不存在",
    });
  } catch (error) {
    console.error("刪除標籤失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 標記標籤為已審核
app.put("/api/images/:imageId/labels/:labelId/review", async (req, res) => {
  try {
    const { labelId } = req.params;
    const success = markLabelAsReviewed(parseInt(labelId));

    res.json({
      success,
      message: success ? "標籤已標記為已審核" : "標籤不存在",
    });
  } catch (error) {
    console.error("標記審核失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 準備訓練數據集
app.post("/api/train/prepare", async (req, res) => {
  try {
    const result = prepareTrainingDataset();

    if (result.success) {
      res.json({
        success: true,
        message: "訓練數據集準備完成",
        data: {
          totalImages: result.totalImages,
          categories: result.categories,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || "準備訓練數據集失敗",
      });
    }
  } catch (error) {
    console.error("準備訓練數據集失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 獲取訓練數據集統計
app.get("/api/train/dataset-stats", async (req, res) => {
  try {
    const stats = getDatasetStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("獲取數據集統計失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 檢查訓練數據集是否準備就緒
app.get("/api/train/dataset-ready", async (req, res) => {
  try {
    const ready = isDatasetReady();
    const stats = getDatasetStats();
    res.json({
      success: true,
      ready,
      stats,
    });
  } catch (error) {
    console.error("檢查數據集狀態失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 開始訓練模型
app.post("/api/train", async (req, res) => {
  try {
    const { epochs = 10, batchSize = 32 } = req.body;

    // 檢查數據集是否準備就緒
    if (!isDatasetReady()) {
      return res.status(400).json({
        success: false,
        error: "訓練數據集未準備就緒，請先準備訓練數據",
      });
    }

    // 這裡我們使用後台任務的方式，因為訓練可能需要較長時間
    // 簡單版本：直接訓練（會阻塞請求）
    res.json({
      success: true,
      message: "訓練已開始，請查看服務器日誌",
      note: "訓練過程可能需要幾分鐘，請耐心等待",
    });

    // 異步執行訓練（不阻塞響應）
    setTimeout(async () => {
      try {
        const { train } = await import("./train");
        await train();
        console.log("✅ 模型訓練完成！");
      } catch (error) {
        console.error("❌ 訓練過程發生錯誤:", error);
      }
    }, 100);
  } catch (error) {
    console.error("啟動訓練失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 獲取模型信息
app.get("/api/model/info", async (req, res) => {
  try {
    const info = getModelInfo();
    res.json({
      success: true,
      model: info,
    });
  } catch (error) {
    console.error("獲取模型信息失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 批量分類圖片（AI 自動分類）
app.post("/api/images/batch-classify", async (req, res) => {
  try {
    const {
      limitPerCountry = 10, // 每個文件夾最多分類的圖片數量
      topK = 1,
      batchSize = 8,
      saveResults = true,
    } = req.body;

    // 檢查模型是否可用
    if (!isModelAvailable()) {
      return res.status(503).json({
        success: false,
        error: "模型尚未訓練或不可用，請先訓練模型",
      });
    }

    // 獲取每個文件夾的未標註圖片（每個文件夾最多 limitPerCountry 張）
    console.log(
      `📂 開始獲取未標註圖片（每個文件夾最多 ${limitPerCountry} 張）...`
    );
    const unlabeledImages = getUnlabeledImagesPerCountry(limitPerCountry);

    if (unlabeledImages.length === 0) {
      return res.json({
        success: true,
        message: "沒有未標註的圖片",
        classified: 0,
        results: [],
      });
    }

    // 構建圖片路徑數組
    const imagePaths = unlabeledImages
      .map((img) => path.join(imagesDir, img.filePath))
      .filter((imgPath) => fs.existsSync(imgPath));

    if (imagePaths.length === 0) {
      return res.status(404).json({
        success: false,
        error: "未找到有效的圖片文件",
      });
    }

    // 返回響應（不阻塞）
    res.json({
      success: true,
      message: `批量自動分類已開始（每個文件夾最多 ${limitPerCountry} 張圖片）`,
      total: imagePaths.length,
      note: "分類結果將自動保存到資料庫（未審核狀態），請在審核模式中檢查",
    });

    // 異步執行批量分類
    setTimeout(async () => {
      try {
        console.log(`\n🚀 開始批量分類 ${imagePaths.length} 張圖片...\n`);

        const results = await classifyImagesBatch(imagePaths, topK, batchSize);

        // 保存分類結果到資料庫
        if (saveResults) {
          let savedCount = 0;
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const unlabeledImage = unlabeledImages[i];

            if (result.error || result.predictions.length === 0) {
              console.warn(
                `   跳過圖片 ${i + 1}: ${result.error || "無預測結果"}`
              );
              continue;
            }

            // 獲取最高置信度的預測
            const topPrediction = result.predictions[0];

            // 保存標籤到資料庫（AI 分類，未審核）
            try {
              saveImageLabel({
                image_id: unlabeledImage.id,
                label: topPrediction.label,
                confidence: topPrediction.confidence,
                is_manual: false,
                reviewed: false,
              });
              savedCount++;
            } catch (error) {
              console.error(`   保存標籤失敗: ${result.path}`, error);
            }
          }

          console.log(
            `\n✅ 批量分類完成: ${savedCount}/${results.length} 個結果已保存到資料庫\n`
          );
        }
      } catch (error) {
        console.error("❌ 批量分類過程發生錯誤:", error);
      }
    }, 100);
  } catch (error) {
    console.error("批量分類失敗:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    });
  }
});

// 首頁路由
app.get("/", (req, res) => {
  const indexPath = path.join(rootDir, "public/index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>圖片標註系統</title>
      </head>
      <body>
        <h1>圖片標註系統</h1>
        <p>前端頁面正在開發中...</p>
        <p>API 端點已就緒：</p>
        <ul>
          <li><a href="/api/images">GET /api/images</a> - 獲取所有圖片</li>
          <li><a href="/api/countries">GET /api/countries</a> - 獲取國家列表</li>
        </ul>
      </body>
      </html>
    `);
  }
});

// 啟動服務器
app.listen(PORT, () => {
  console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
  console.log(`📁 圖片目錄: ${imagesDir}`);
  console.log(`📁 圖片 URL 前綴: /images/`);
  console.log(`📁 前端目錄: ${publicDir}`);

  // 測試圖片目錄是否存在
  if (fs.existsSync(imagesDir)) {
    const countries = fs.readdirSync(imagesDir).filter((item) => {
      const itemPath = path.join(imagesDir, item);
      return fs.statSync(itemPath).isDirectory();
    });
    console.log(
      `✅ 找到 ${countries.length} 個國家目錄: ${countries.join(", ")}`
    );
  } else {
    console.error(`❌ 圖片目錄不存在: ${imagesDir}`);
  }
});
