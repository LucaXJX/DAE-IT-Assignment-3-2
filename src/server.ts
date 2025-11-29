import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

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
    const { label, isManual = true } = req.body;

    if (!label) {
      return res.status(400).json({
        success: false,
        error: '標籤不能為空'
      });
    }

    // TODO: 保存到資料庫
    // 這裡暫時只是返回成功，後續會整合資料庫

    res.json({
      success: true,
      message: '標籤已保存',
      data: {
        imageId,
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

    // TODO: 從資料庫獲取標籤

    res.json({
      success: true,
      labels: []
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

    res.json({
      success: true,
      countries: countriesWithCount,
      total: countries.length
    });
  } catch (error) {
    console.error('獲取國家列表失敗:', error);
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
});
