#!/bin/bash
# 啟動圖片標註服務器的腳本

# 設置 Node.js PATH
export PATH="/c/Program Files/nodejs:$PATH"

# 檢查 Node.js 是否可用
if ! command -v node &> /dev/null; then
  echo "❌ 錯誤: Node.js 未找到"
  echo "請確保 Node.js 已安裝並在 PATH 中"
  exit 1
fi

# 顯示版本信息
echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 切換到專案目錄
cd "$(dirname "$0")"

# 啟動服務器
echo "🚀 啟動服務器..."
npm run server

