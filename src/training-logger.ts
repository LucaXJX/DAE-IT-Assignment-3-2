/**
 * 訓練記錄系統
 * 記錄訓練過程的詳細數據，用於後續分析和報告
 */

import * as fs from 'fs';
import * as path from 'path';

export interface EpochLog {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number | null;
  valAccuracy: number | null;
  timestamp: string;
}

export interface TrainingMetadata {
  startTime: string;
  endTime: string | null;
  duration: number | null; // 秒
  totalEpochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: string;
  lossFunction: string;
  validationSplit: number;
  imageSize: number;
  numClasses: number;
  totalImages: number;
  classNames: string[];
  baseModel: string;
  featureExtractor: string;
}

export interface TrainingLog {
  metadata: TrainingMetadata;
  epochs: EpochLog[];
}

/**
 * 訓練記錄器類
 */
export class TrainingLogger {
  private log: TrainingLog;
  private logFilePath: string;
  private startTime: Date;

  constructor(
    logDir: string = 'training_logs',
    config: Partial<TrainingMetadata> = {}
  ) {
    this.startTime = new Date();
    
    // 確保日誌目錄存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // 創建日誌文件路徑（使用時間戳命名）
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    this.logFilePath = path.join(logDir, `training-${timestamp}.json`);

    // 初始化記錄結構
    this.log = {
      metadata: {
        startTime: this.startTime.toISOString(),
        endTime: null,
        duration: null,
        totalEpochs: config.totalEpochs || 10,
        batchSize: config.batchSize || 32,
        learningRate: config.learningRate || 0.001,
        optimizer: config.optimizer || 'adam',
        lossFunction: config.lossFunction || 'categoricalCrossentropy',
        validationSplit: config.validationSplit || 0.2,
        imageSize: config.imageSize || 224,
        numClasses: config.numClasses || 0,
        totalImages: config.totalImages || 0,
        classNames: config.classNames || [],
        baseModel: config.baseModel || 'MobileNet',
        featureExtractor: config.featureExtractor || 'unknown',
      },
      epochs: [],
    };

    // 立即保存初始記錄
    this.save();
  }

  /**
   * 記錄一個 epoch 的結果
   */
  logEpoch(epoch: number, logs: any): void {
    const epochLog: EpochLog = {
      epoch: epoch + 1, // 從 1 開始計數
      loss: logs?.loss ? Number(logs.loss) : 0,
      accuracy: logs?.acc ? Number(logs.acc) : 0,
      valLoss: logs?.val_loss ? Number(logs.val_loss) : null,
      valAccuracy: logs?.val_acc ? Number(logs.val_acc) : null,
      timestamp: new Date().toISOString(),
    };

    this.log.epochs.push(epochLog);
    this.save();
  }

  /**
   * 完成訓練，記錄結束時間
   */
  finish(): void {
    const endTime = new Date();
    this.log.metadata.endTime = endTime.toISOString();
    this.log.metadata.duration = Math.round(
      (endTime.getTime() - this.startTime.getTime()) / 1000
    ); // 秒

    this.save();
    console.log(`\n📊 訓練記錄已保存到: ${this.logFilePath}`);
  }

  /**
   * 保存記錄到文件
   */
  private save(): void {
    try {
      fs.writeFileSync(
        this.logFilePath,
        JSON.stringify(this.log, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.warn('⚠️  保存訓練記錄失敗:', error);
    }
  }

  /**
   * 獲取記錄文件路徑
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * 更新元數據
   */
  updateMetadata(updates: Partial<TrainingMetadata>): void {
    this.log.metadata = { ...this.log.metadata, ...updates };
    this.save();
  }

  /**
   * 生成訓練摘要（用於打印或報告）
   */
  generateSummary(): string {
    const { metadata, epochs } = this.log;
    const lastEpoch = epochs[epochs.length - 1];

    let summary = '\n' + '='.repeat(60) + '\n';
    summary += '📊 訓練摘要\n';
    summary += '='.repeat(60) + '\n';
    summary += `開始時間: ${metadata.startTime}\n`;
    summary += `結束時間: ${metadata.endTime || '進行中'}\n`;
    summary += `訓練時長: ${metadata.duration ? `${Math.round(metadata.duration / 60)} 分鐘` : '計算中'}\n`;
    summary += `總輪數: ${metadata.totalEpochs}\n`;
    summary += `批次大小: ${metadata.batchSize}\n`;
    summary += `學習率: ${metadata.learningRate}\n`;
    summary += `圖片數量: ${metadata.totalImages}\n`;
    summary += `類別數量: ${metadata.numClasses}\n`;
    summary += `類別: ${metadata.classNames.join(', ')}\n`;
    summary += `基礎模型: ${metadata.baseModel}\n`;
    
    if (lastEpoch) {
      summary += '\n' + '-'.repeat(60) + '\n';
      summary += '最終結果:\n';
      summary += `  Loss: ${lastEpoch.loss.toFixed(4)}\n`;
      summary += `  Accuracy: ${(lastEpoch.accuracy * 100).toFixed(2)}%\n`;
      if (lastEpoch.valLoss !== null) {
        summary += `  Validation Loss: ${lastEpoch.valLoss.toFixed(4)}\n`;
      }
      if (lastEpoch.valAccuracy !== null) {
        summary += `  Validation Accuracy: ${(lastEpoch.valAccuracy * 100).toFixed(2)}%\n`;
      }
      
      // 計算改進
      if (epochs.length > 1) {
        const firstEpoch = epochs[0];
        const lossImprovement = firstEpoch.loss - lastEpoch.loss;
        const accImprovement = lastEpoch.accuracy - firstEpoch.accuracy;
        summary += '\n改進:\n';
        summary += `  Loss 降低: ${lossImprovement.toFixed(4)}\n`;
        summary += `  Accuracy 提升: ${(accImprovement * 100).toFixed(2)}%\n`;
      }
    }
    
    summary += '='.repeat(60) + '\n';
    
    return summary;
  }

  /**
   * 獲取所有記錄
   */
  getLog(): TrainingLog {
    return { ...this.log };
  }
}

