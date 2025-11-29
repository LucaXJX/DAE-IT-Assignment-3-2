/**
 * 圖片處理工具函數
 * 使用 sharp 處理圖片，替代 tfjs-node 的圖片解碼功能
 */

import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';
import * as fs from 'fs';

/**
 * 載入圖片並轉換為 TensorFlow tensor
 * @param imagePath 圖片路徑
 * @param targetSize 目標尺寸（默認 224，用於 MobileNet）
 * @returns TensorFlow tensor (shape: [1, height, width, 3])
 */
export async function loadImageAsTensor(
  imagePath: string,
  targetSize: number = 224
): Promise<tf.Tensor4D> {
  try {
    // 檢查文件是否存在
    if (!fs.existsSync(imagePath)) {
      throw new Error(`圖片文件不存在: ${imagePath}`);
    }

    // 使用 sharp 讀取和預處理圖片
    // 使用 raw() 獲取 RGB 格式的原始像素數據（不包含 alpha 通道）
    const imageBuffer = await sharp(imagePath)
      .resize(targetSize, targetSize, {
        fit: 'fill', // 填充整個區域，可能裁剪
      })
      .removeAlpha() // 移除 alpha 通道，只保留 RGB（3 個通道）
      .raw() // 獲取原始像素數據
      .toBuffer();

    // 轉換為 Uint8Array
    const imageArray = new Uint8Array(imageBuffer);

    // 創建 tensor: [1, height, width, 3]
    const tensor = tf.tensor4d(imageArray, [1, targetSize, targetSize, 3]);

    // MobileNet 需要的預處理：
    // 1. 將像素值從 [0, 255] 正規化到 [-1, 1]
    // 公式: (pixel / 127.5) - 1
    const normalized = tensor.div(127.5).sub(1.0);

    return normalized as tf.Tensor4D;
  } catch (error) {
    console.error(`載入圖片失敗: ${imagePath}`, error);
    throw error;
  }
}

/**
 * 批量載入圖片
 * @param imagePaths 圖片路徑數組
 * @param targetSize 目標尺寸
 * @returns TensorFlow tensor 數組
 */
export async function loadImagesAsTensors(
  imagePaths: string[],
  targetSize: number = 224
): Promise<tf.Tensor4D[]> {
  const tensors: tf.Tensor4D[] = [];

  for (const imagePath of imagePaths) {
    try {
      const tensor = await loadImageAsTensor(imagePath, targetSize);
      tensors.push(tensor);
    } catch (error) {
      console.warn(`跳過圖片: ${imagePath}`, error);
    }
  }

  return tensors;
}

/**
 * 將多個 tensor 合併為一個批次
 * @param tensors tensor 數組
 * @returns 合併後的批次 tensor
 */
export function batchTensors(tensors: tf.Tensor4D[]): tf.Tensor4D {
  if (tensors.length === 0) {
    throw new Error('沒有 tensor 可以合併');
  }

  return tf.concat(tensors, 0);
}

