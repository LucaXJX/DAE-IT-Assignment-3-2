# 習作二：圖像數據集清理與統計

## 學生資料

- 姓名：XU JIAXIN
- 學號：24829139
- 主題編號：9
- 主題名稱：世界各地的特色美食

## 安裝與初始化

```bash
# 1. 安裝依賴
npm install

# 2. 設置數據庫
npm run db:setup

# 3. 設置 Pexels API 金鑰（在 .env 文件中）
PEXELS_API_KEY=你的API金鑰
```

## 使用方式

### 數據收集（習作一）

```bash
# 完整流程
npm start

# 或分步執行
npm run scrape    # 收集圖片 URL
npm run download  # 下載圖片
npm run process   # 處理圖片
```

### 數據清理與分類（習作二）

```bash
# 1. 啟動分類 Web UI
npm run label:webui

# 2. 訪問 http://localhost:8100 進行分類
#    - 手動標註圖片（food/other）
#    - 訓練模型
#    - AI 自動分類
#    - 人工審核與修正

# 3. 生成報告
npm run generate:report

# 4. 複製已分類圖片到 images/classified/
npm run move:classified
```

## 報告

- **完整報告**：[reports/hand-made-report.md](reports/hand-made-report.md)
- **自動生成報告**：運行 `npm run generate:report` 後在 `reports/` 目錄查看

## 核心統計數據

| 項目               | 數量     |
| ------------------ | -------- |
| 收集的圖像數量     | 8,300 張 |
| 清除後的圖像數量   | 4,150 張 |
| 爬取的頁數（估算） | 277 頁   |
| 來自不同網站數量   | 2 個     |

詳細統計請查看：[完整報告](reports/hand-made-report.md#二核心統計數據習作要求)

## 功能完成度

詳細評估請參考：[完整報告 - 質量評估](reports/hand-made-report.md#七質量評估)

### 1. 清理和處理（40 分）

#### 下載的圖像清理（30 分）

- [x] 優良：所有不相關與重複圖像均成功清除，並使用訓練模型自動化輔助。
- [ ] 滿意：大部分不相關圖像已清除，仍需少量人工確認或補強模型。
- [ ] 有待改善：清理不足，模型未有效辨識雜訊圖像。

#### 數據集縮減或擴充（10 分）

- [x] 優良：清理後圖像數量精準落在 1000~5000 範圍內，必要時補足更多樣本。
- [ ] 滿意：接近要求範圍，但略有偏差。
- [ ] 有待改善：數量遠離要求，未進行有效縮減或擴充。

### 2. 數據報告（25 分）

#### 統計數據（15 分）

- [x] 優良：完整提供收集與清理後的圖像數量，數字準確且可驗證。
- [ ] 滿意：提供基本統計，但缺乏完整細節或驗證資料。
- [ ] 有待改善：統計資料不完整或不準確。

#### 來源分析（10 分）

- [x] 優良：詳細列出爬取的頁數與涉及的唯一網域數量。
- [ ] 滿意：提供部分來源分析，但資訊不全。
- [ ] 有待改善：缺乏來源分析或來源數據錯誤。

### 3. 自動化與代碼質量（35 分）

#### 自動化程度（20 分）

- [x] 優良：從資料清理到模型訓練、判定完全自動化，無需人工介入。
- [ ] 滿意：關鍵流程有自動化，仍需少量人工介入確認。
- [ ] 有待改善：需要大量人工操作才能完成清理或訓練。

#### 程式碼結構和註釋（15 分）

- [x] 優良：模組化清晰、註釋完整，容易閱讀與維護。
- [ ] 滿意：結構基本清楚，有簡單註釋支援理解。
- [ ] 有待改善：程式碼混亂或缺乏註釋，維護困難。

## 專案結構

```
DAE-IT-Assignment-3-2/
├── src/
│   ├── simple-classification-ui.ts  # Web UI 服務器（分類界面）
│   ├── generate-report.ts           # 報告生成腳本
│   ├── move-classified-images.ts    # 圖片複製腳本
│   ├── index.ts                     # 數據收集主入口
│   ├── ImageScraper.ts              # Google Images 爬蟲
│   ├── PexelsScraper.ts             # Pexels API 爬蟲
│   └── ...
├── public/
│   └── index.html                   # 分類 Web UI
├── dataset/                         # 數據集目錄
│   ├── food/                        # 食物類別
│   ├── other/                       # 其他類別
│   └── classified/                  # 已分類備份
├── images/                          # 圖片目錄
│   └── classified/                  # 複製的分類圖片
├── reports/                         # 報告目錄
│   ├── hand-made-report.md         # 完整報告
│   └── report-*.md                  # 自動生成報告
├── docs/                            # 文檔目錄
├── db.sqlite3                       # SQLite 數據庫
└── erd.txt                          # ERD 數據表設計
```

完整結構說明：[報告 - 附錄](reports/hand-made-report.md#103-項目結構)

## 相關文檔

- [完整報告](reports/hand-made-report.md)
- [習作要求](習作二：圖像數據集清理與統計.md)
- [開發日誌](docs/log.md)

## 技術實現

- **AI 分類**：TensorFlow.js（基於 MobileNet Transfer Learning）
- **數據庫**：SQLite (better-sqlite3)
- **Web 框架**：Express.js
- **圖片處理**：Sharp

詳細技術說明：[報告 - 技術實現](reports/hand-made-report.md#五技術實現)

## 備註

- 本專案僅供學習用途
- 圖像版權歸原作者所有
- 下載圖像時請遵守相關使用條款
