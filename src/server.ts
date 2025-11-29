import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  saveImageLabel,
  getImageLabels,
  deleteImageLabel,
  markLabelAsReviewed,
  getImageIdFromPath,
  createImageRecordIfNotExists,
  getLabeledStats,
  getUnlabeledImages
} from './image-label-helper';
import {
  prepareTrainingDataset,
  getDatasetStats,
  isDatasetReady
} from './train-helper';

const app = express();
const PORT = process.env.PORT || 3000;

// 獲取項目根目錄（無論是在 src/ 還是 dist/）
const rootDir = path.resolve(process.cwd());

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態文件服務 - 圖片目錄
const imagesDir = path.join(rootDir, 'images/processed');
app.use('/images', express.static(imagesDir));

// 提供前端頁面
const publicDir = path.join(rootDir, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

interface ImageInfo {
  id: string;
  country: string;
  filename: string;
  path: string;
  url: string;
}

// 獲取所有圖片列表
app.get('/api/images', async (req, res) => {
  try {
    const countries = fs.readdirSync(imagesDir).filter(item => {
      const itemPath = path.join(imagesDir, item);
      return fs.statSync(itemPath).isDirectory();
    });

    const allImages: ImageInfo[] = [];

    countries.forEach(country => {
      const countryDir = path.join(imagesDir, country);
      const files = fs.readdirSync(countryDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      });

      files.forEach(file => {
        const fileId = `${country}_${file}`;
        allImages.push({
          id: fileId,
          country,
          filename: file,
          path: path.join(country, file),
          url: `/images/${country}/${file}`
        });
      });
    });

    res.json({
      success: true,
      images: allImages,
      total: allImages.length
    });
  } catch (error) {
    console.error('獲取圖片列表失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 獲取特定國家的圖片
app.get('/api/images/:country', async (req, res) => {
  try {
    const { country } = req.params;
    const countryDir = path.join(imagesDir, country);

    if (!fs.existsSync(countryDir)) {
      return res.status(404).json({
        success: false,
        error: '國家目錄不存在'
      });
    }

    const files = fs.readdirSync(countryDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    const images: ImageInfo[] = files.map(file => ({
      id: `${country}_${file}`,
      country,
      filename: file,
      path: path.join(country, file),
      url: `/images/${country}/${file}`
    }));

    res.json({
      success: true,
      images,
      total: images.length
    });
  } catch (error) {
    console.error('獲取圖片失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 保存圖片標籤
app.post('/api/images/:imageId/label', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { label, isManual = true, confidence = 1.0 } = req.body;

    if (!label) {
      return res.status(400).json({
        success: false,
        error: '標籤不能為空'
      });
    }

    // 解析圖片 ID (格式: country_filename.jpg)
    const [country, ...filenameParts] = imageId.split('_');
    const filename = filenameParts.join('_');

    // 獲取資料庫中的圖片 ID，如果不存在則創建記錄
    let dbImageId = getImageIdFromPath(country, filename);

    if (!dbImageId) {
      // 如果資料庫中沒有這張圖片，檢查文件是否存在，如果存在則創建記錄
      const imagePath = path.join(imagesDir, country, filename);
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          success: false,
          error: '圖片文件不存在'
        });
      }
      
      // 創建資料庫記錄
      dbImageId = createImageRecordIfNotExists(country, filename);
    }

    // 保存標籤到資料庫
    const labelId = saveImageLabel({
      image_id: dbImageId,
      label,
      confidence: isManual ? 1.0 : (confidence || 0.0),
      is_manual: isManual,
      reviewed: isManual // 手動標註默認已審核
    });

    res.json({
      success: true,
      message: '標籤已保存',
      data: {
        labelId,
        imageId: dbImageId,
        label,
        isManual
      }
    });
  } catch (error) {
    console.error('保存標籤失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 獲取圖片標籤
app.get('/api/images/:imageId/labels', async (req, res) => {
  try {
    const { imageId } = req.params;

    // 解析圖片 ID (格式: country_filename.jpg)
    const [country, ...filenameParts] = imageId.split('_');
    const filename = filenameParts.join('_');

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
          labels: []
        });
      }
    }

    // 從資料庫獲取標籤
    const labels = getImageLabels(dbImageId);

    res.json({
      success: true,
      labels: labels.map(label => ({
        id: label.id,
        label: label.label,
        confidence: label.confidence,
        isManual: label.is_manual,
        reviewed: label.reviewed
      }))
    });
  } catch (error) {
    console.error('獲取標籤失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 分類圖片（AI 預測）
app.post('/api/images/:imageId/classify', async (req, res) => {
  try {
    const { imageId } = req.params;

    // TODO: 使用 TensorFlow.js 進行分類
    // 這裡暫時返回示例數據

    res.json({
      success: true,
      predictions: [
        { label: 'Italy', confidence: 0.85 },
        { label: 'Japan', confidence: 0.10 },
        { label: 'China', confidence: 0.05 }
      ]
    });
  } catch (error) {
    console.error('分類失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 獲取所有國家列表
app.get('/api/countries', async (req, res) => {
  try {
    const countries = fs.readdirSync(imagesDir).filter(item => {
      const itemPath = path.join(imagesDir, item);
      return fs.statSync(itemPath).isDirectory();
    });

    // 統計每個國家的圖片數量
    const countriesWithCount = countries.map(country => {
      const countryDir = path.join(imagesDir, country);
      const files = fs.readdirSync(countryDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      });
      return {
        name: country,
        count: files.length
      };
    });

    // 添加「其他」選項
    countriesWithCount.push({
      name: '其他',
      count: 0
    });

    res.json({
      success: true,
      countries: countriesWithCount,
      total: countries.length + 1
    });
  } catch (error) {
    console.error('獲取國家列表失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 獲取標籤統計
app.get('/api/stats/labels', async (req, res) => {
  try {
    const stats = getLabeledStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('獲取統計失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 刪除標籤
app.delete('/api/images/:imageId/labels/:labelId', async (req, res) => {
  try {
    const { labelId } = req.params;
    const success = deleteImageLabel(parseInt(labelId));
    
    res.json({
      success,
      message: success ? '標籤已刪除' : '標籤不存在'
    });
  } catch (error) {
    console.error('刪除標籤失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 標記標籤為已審核
app.put('/api/images/:imageId/labels/:labelId/review', async (req, res) => {
  try {
    const { labelId } = req.params;
    const success = markLabelAsReviewed(parseInt(labelId));
    
    res.json({
      success,
      message: success ? '標籤已標記為已審核' : '標籤不存在'
    });
  } catch (error) {
    console.error('標記審核失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 準備訓練數據集
app.post('/api/train/prepare', async (req, res) => {
  try {
    const result = prepareTrainingDataset();
    
    if (result.success) {
      res.json({
        success: true,
        message: '訓練數據集準備完成',
        data: {
          totalImages: result.totalImages,
          categories: result.categories
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || '準備訓練數據集失敗'
      });
    }
  } catch (error) {
    console.error('準備訓練數據集失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 獲取訓練數據集統計
app.get('/api/train/dataset-stats', async (req, res) => {
  try {
    const stats = getDatasetStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('獲取數據集統計失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 檢查訓練數據集是否準備就緒
app.get('/api/train/dataset-ready', async (req, res) => {
  try {
    const ready = isDatasetReady();
    const stats = getDatasetStats();
    res.json({
      success: true,
      ready,
      stats
    });
  } catch (error) {
    console.error('檢查數據集狀態失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 開始訓練模型
app.post('/api/train', async (req, res) => {
  try {
    const { epochs = 10, batchSize = 32 } = req.body;

    // 檢查數據集是否準備就緒
    if (!isDatasetReady()) {
      return res.status(400).json({
        success: false,
        error: '訓練數據集未準備就緒，請先準備訓練數據'
      });
    }

    // 這裡我們使用後台任務的方式，因為訓練可能需要較長時間
    // 簡單版本：直接訓練（會阻塞請求）
    res.json({
      success: true,
      message: '訓練已開始，請查看服務器日誌',
      note: '訓練過程可能需要幾分鐘，請耐心等待'
    });

    // 異步執行訓練（不阻塞響應）
    setTimeout(async () => {
      try {
        const { train } = await import('./train');
        await train();
        console.log('✅ 模型訓練完成！');
      } catch (error) {
        console.error('❌ 訓練過程發生錯誤:', error);
      }
    }, 100);

  } catch (error) {
    console.error('啟動訓練失敗:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
});

// 首頁路由
app.get('/', (req, res) => {
  const indexPath = path.join(rootDir, 'public/index.html');
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
    const countries = fs.readdirSync(imagesDir).filter(item => {
      const itemPath = path.join(imagesDir, item);
      return fs.statSync(itemPath).isDirectory();
    });
    console.log(`✅ 找到 ${countries.length} 個國家目錄: ${countries.join(', ')}`);
  } else {
    console.error(`❌ 圖片目錄不存在: ${imagesDir}`);
  }
});
