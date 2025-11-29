# 訓練記錄目錄

此目錄包含所有訓練過程的記錄文件。

## 文件格式

每個訓練記錄文件以時間戳命名：
```
training-YYYY-MM-DDTHH-MM-SS.json
```

## 記錄內容

每個記錄文件包含：
- **metadata**: 訓練配置和元數據
  - 開始/結束時間
  - 訓練參數（epochs, batch size, learning rate 等）
  - 數據集信息（圖片數量、類別等）
  - 模型信息
- **epochs**: 每個 epoch 的詳細數據
  - loss 和 accuracy
  - validation loss 和 accuracy
  - 時間戳

## 使用方式

這些記錄文件可以用於：
1. 分析訓練過程
2. 比較不同訓練的效果
3. 生成訓練報告
4. 調試訓練問題

詳細說明請參考：`docs/訓練記錄系統說明.md`

