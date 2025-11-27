# 習作二：圖像數據集清理與統計

## 學生資料

- 姓名：XU JIAXIN
- 學號：24829139
- 主題編號：9
- 主題名稱：世界各地的特色美食

## 安裝與初始化說明

1. **專案克隆與依賴安裝**

   ```bash
   git clone https://github.com/LucaXJX/DAE-IT-Assignment-3-1.git
   cd DAE-IT-Assignment-3-1
   npm install
   ```

2. **數據庫部署**

   本專案使用 SQLite 資料庫，根據 `erd.txt` 自動生成數據庫結構：

   ```bash
   # 方法一：一鍵設置（推薦）
   npm run db:setup
   ```

   此指令會：

   - 根據 `erd.txt` 自動生成數據庫遷移檔案
   - 創建 `db.sqlite3` 資料庫檔案
   - 自動生成 TypeScript 類型定義檔案 `src/proxy.ts`

   ```bash
   # 方法二：手動執行遷移（如果方法一失敗）
   npm run db:migrate
   npm run db:gen-proxy
   ```

   > **說明**：
   >
   > - 資料庫檔案 `db.sqlite3` 會在專案根目錄自動創建
   > - 如需查看數據庫結構計劃，可執行 `npm run db:plan`
   > - 如需重新設置數據庫，刪除 `db.sqlite3` 後重新執行 `npm run db:setup`

3. **Pexels API 金鑰設置**
   - 前往 https://www.pexels.com/api/ 申請免費 API KEY
   - 在專案根目錄創建 `.env` 檔案，內容如下（將 `你的API金鑰` 替換為申請到的內容）：
     ```
     PEXELS_API_KEY=你的API金鑰
     ```
   - 或複製範例檔案：
     ```bash
     cp .env.example .env
     # 然後編輯 .env 填入真實的 API Key
     ```

## 使用方式

> **前提條件**：請確保已完成安裝步驟 1-3（依賴安裝、數據庫部署、API 金鑰設置）

1. **編譯 TypeScript 程式碼（如尚未執行）**

   ```bash
   npm run build
   ```

   > **注意**：使用 `ts-node` 執行時可跳過此步驟，但正式部署建議先編譯

2. **完整自動化流程一鍵執行**

   ```bash
   npm start
   ```

   此指令會依序執行：

   - 自動搜尋並收集圖像 URL 與 alt 文字（存於資料庫）
   - 下載圖像到本地 `images/` 目錄
   - 批量處理圖像（裁剪、壓縮到 500x500/50KB 以內）

3. **分步執行詳細流程**

   - **（1）自動搜尋並收集食物圖片 URL 與 alt 文字**  
     預設流程已設定於 `src/index.ts`

     ```bash
     npm run scrape
     ```

     > 說明：將涉及各國美食關鍵字、自動抓取相關圖片網址與 alt 文字，存於資料庫

   - **（2）下載圖片到本地**

     ```bash
     npm run download
     ```

   - **（3）圖像批量壓縮、裁剪、處理（尺寸壓縮到小於 500x500/50KB）**

     ```bash
     npm run process
     ```

   - **（4）查詢或檢查當前抓取/下載/壓縮進度**
     ```bash
     npm run stats
     ```

4. **數據庫管理指令**

   ```bash
   # 查看數據庫結構計劃
   npm run db:plan

   # 執行數據庫遷移（更新數據庫結構）
   npm run db:migrate

   # 重新生成數據庫 Proxy 類型定義
   npm run db:gen-proxy

   # 完全重新設置數據庫（需先刪除 db.sqlite3）
   npm run db:setup
   ```

如有遺漏或疏失，請協助指出，謝謝！

## 功能完成度自評

### 1. 清理和處理（40 分）

#### 下載的圖像清理（30 分）

- [ ] 優良：所有不相關與重複圖像均成功清除，並使用訓練模型自動化輔助。
- [ ] 滿意：大部分不相關圖像已清除，仍需少量人工確認或補強模型。
- [ ] 有待改善：清理不足，模型未有效辨識雜訊圖像。

#### 數據集縮減或擴充（10 分）

- [ ] 優良：清理後圖像數量精準落在 1000~5000 範圍內，必要時補足更多樣本。
- [ ] 滿意：接近要求範圍，但略有偏差。
- [ ] 有待改善：數量遠離要求，未進行有效縮減或擴充。

### 2. 數據報告（25 分）

#### 統計數據（15 分）

- [ ] 優良：完整提供收集與清理後的圖像數量，數字準確且可驗證。
- [ ] 滿意：提供基本統計，但缺乏完整細節或驗證資料。
- [ ] 有待改善：統計資料不完整或不準確。

#### 來源分析（10 分）

- [ ] 優良：詳細列出爬取的頁數與涉及的唯一網域數量。
- [ ] 滿意：提供部分來源分析，但資訊不全。
- [ ] 有待改善：缺乏來源分析或來源數據錯誤。

### 3. 自動化與代碼質量（35 分）

#### 自動化程度（20 分）

- [ ] 優良：從資料清理到模型訓練、判定完全自動化，無需人工介入。
- [ ] 滿意：關鍵流程有自動化，仍需少量人工介入確認。
- [ ] 有待改善：需要大量人工操作才能完成清理或訓練。

#### 程式碼結構和註釋（15 分）

- [ ] 優良：模組化清晰、註釋完整，容易閱讀與維護。
- [ ] 滿意：結構基本清楚，有簡單註釋支援理解。
- [ ] 有待改善：程式碼混亂或缺乏註釋，維護困難。

## 專案結構

```
DAE-IT-Assignment-3-1/
├── db.sqlite3                     # SQLite 圖像資料庫（自動生成）
├── erd.txt                        # ERD 數據表設計
├── migrations/                    # 數據庫遷移檔案（自動生成）
│   └── *.ts
├── src/
│   ├── index.ts                   # 主入口程式，自動化流程一鍵啟動
│   ├── config.ts                  # 配置（API、處理參數、關鍵字等）
│   ├── db.ts                      # 數據庫連接設定
│   ├── ImageScraper.ts            # Google Images 爬蟲
│   ├── PexelsScraper.ts           # Pexels API 爬蟲
│   ├── download.ts                # 圖像下載邏輯
│   ├── process.ts                 # 圖像尺寸調整、裁剪、壓縮
│   ├── database-helper.ts         # 數據庫操作輔助函數
│   ├── proxy.ts                   # 數據庫 Proxy 代理（自動生成）
│   ├── RateLimiter.ts             # API 速率限制追蹤
│   ├── env.ts                     # 環境變數管理
│   └── utils.ts                   # 通用輔助工具
├── images/                        # 下載的圖像存放目錄（自動生成）
├── logs/                          # 日誌檔案目錄（自動生成）
├── .env                           # Pexels API 金鑰等敏感環境參數（需自行創建）
├── .env.example                   # 環境變數範例檔案
├── .gitignore                     # Git 忽略檔案設定
├── package.json                   # 專案依賴、指令腳本
├── tsconfig.json                  # TypeScript 配置
├── knexfile.ts                    # Knex 數據庫配置
├── check-progress.js              # 統計進度用的小工具
├── 習作一：自動搜集圖像數據集與初步處理 - 學生指引.md
└── README.md
```

## 備註

- 本專案僅供學習用途
- 圖像版權歸原作者所有
- 下載圖像時請遵守相關使用條款
