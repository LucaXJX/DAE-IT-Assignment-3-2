#!/bin/bash
# 設置 Node.js 路徑到 Git Bash 環境
# 使用方法: source setup-node-path.sh

export PATH="/c/Program Files/nodejs:$PATH"

echo "✅ Node.js 路徑已設置"
echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

