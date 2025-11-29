# 臨時腳本目錄

此目錄包含臨時用途的腳本文件，主要用於調試、測試或一次性任務。

## 文件說明

### JavaScript 文件
- `check-db-tables.js` - 臨時數據庫表結構檢查腳本（用於調試）

### Batch 文件（Windows）
- `rebuild-tfjs-node.bat` - 臨時用於重建 TensorFlow.js Node 版本的批處理腳本
- `rebuild-tfjs-node-simple.bat` - 簡化版重建腳本
- `find-nodejs.bat` - 臨時用於查找 Node.js 安裝路徑的腳本
- `test-bat.bat` - 測試批處理文件的臨時腳本
- `手動設置Node路徑.bat` - 臨時用於手動設置 Node.js 路徑的腳本

## 注意

這些文件是臨時用途，現在項目中不再需要：
- ✅ TensorFlow.js 編譯問題已通過使用瀏覽器版本解決
- ✅ Node.js 路徑設置已通過 `setup-node-path.sh` 統一管理
- ✅ 數據庫檢查功能已集成到主項目中

這些文件保留在此目錄僅供參考，可以隨時刪除。
