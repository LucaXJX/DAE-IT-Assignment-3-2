# 習作一：自動搜集圖像數據集與初步處理

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

### 1. 搜索和收集（30 分）

#### 關鍵字搜索與結果相關性（15 分）

- [x] 優良：精準關鍵字，90%+ 相關圖像（15 分）
- [ ] 滿意：較準確，70~89% 相關圖像（10 分）
- [ ] 有待改善：70% 以下相關性（5 分）

#### 收集網址與替代文字（15 分）

- [x] 優良：全部圖像的 src、alt 完整且正確（15 分）
- [ ] 滿意：多數正確，少量遺漏（10 分）
- [ ] 有待改善：大量缺失或錯誤（5 分）

---

### 2. 圖像下載和處理（50 分）

#### 下載及儲存（20 分）

- [x] 優良：下載達標（3000~5000 張）且正確存檔（20 分）
- [ ] 滿意：接近要求（2000~2999 或 5001~6000 張）（15 分）
- [ ] 有待改善：數量明顯不足（< 2000 張）（10 分）

#### 調整及裁剪（20 分）

- [x] 優良：全部正確裁剪至 500x500 像素以內，置中處理（20 分）
- [ ] 滿意：多數正確，少數有誤（15 分）
- [ ] 有待改善：多數未正確裁剪（10 分）

#### 重新編碼與尺寸（10 分）

- [x] 優良：所有圖像壓縮至 JPEG (quality 50~80)，且檔案 ≤50KB（10 分）
- [ ] 滿意：大部分達標，少數超標（7 分）
- [ ] 有待改善：多數未達標（4 分）

---

### 3. 自動化與代碼質量（20 分）

#### 自動化程度（10 分）

- [x] 優良：完全自動化，一鍵執行全流程（10 分）
- [ ] 滿意：大部分自動，少量人工介入（7 分）
- [ ] 有待改善：需大量人工操作（4 分）

#### 程式碼結構和註釋（10 分）

- [x] 優良：結構清晰，模組化佳，註釋完善（10 分）
- [ ] 滿意：基本可讀，有基本註釋（7 分）
- [ ] 有待改善：混亂或缺乏註釋（4 分）

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
