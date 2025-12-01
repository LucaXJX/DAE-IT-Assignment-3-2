- 重構 Web UI：將 simple-classification-ui.ts 的內嵌 HTML 替換為基於 docs/image-dataset/public/index.html 的結構與樣式（保持前端純靜態，暫時用假資料或簡化 API）

- 設計並實作 /unclassified API：從 db.sqlite3 和圖片資料夾中讀取未標註圖片，依資料夾/國家分組，回傳與 image-dataset 相容的 classes 結構

- 設計並實作 /classified API：依最終 label（food/other）從資料庫聚合已標註圖片，回傳與 image-dataset 相容的 classes 結構

- 設計並實作 /correct API：接受 className（food/other）與圖片列表，更新資料庫中對應圖片的 label，並確保與 undo 機制可擴充相容

- 在前端 index.html 中對接 /unclassified、/classified、/correct 三個 API，讓選取圖片並標成 food/other 的流程可以完整工作

- 驗證端到端手動標註流程：從載入 Unclassified 列表、以資料夾分組檢視，到將圖片標成 food/other，並在 Classified 區域與 DB 中正確反映

- 規劃並實作瀏覽器端 tfjs transfer learning（使用 @tensorflow/tfjs + 預訓練模型），利用 food/other 標籤訓練二分類模型並產生預測結果

- 在 Web UI 中整合模型預測與人工修正流程：顯示每張圖的模型預測與信心分數，支援快速接受/覆寫，並將最終 label 寫回資料庫

- 撰寫或更新 docs 中的使用說明與安裝指南，說明新的 Web UI、API、以及基於瀏覽器 tfjs 的訓練與標註流程
