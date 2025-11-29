/**
 * 模型訓練腳本
 * 使用 TensorFlow.js (瀏覽器版本) 和 sharp 訓練圖像分類模型
 * 不使用 tensorflow-helpers，完全手動實現
 */

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import * as fs from "fs";
import * as path from "path";
import { loadImageAsTensor } from "./image-utils";
import { loadMobileNet, IMAGE_SIZE } from "./model-loader";
import { TrainingLogger } from "./training-logger";

const rootDir = path.resolve(process.cwd());
const baseModelDir = path.join(rootDir, "saved_model/base_model");
const classifierModelDir = path.join(rootDir, "saved_model/classifier_model");
const datasetDir = path.join(rootDir, "dataset");

/**
 * 從數據集目錄讀取所有圖片
 */
function loadDataset(): { [label: string]: string[] } {
  if (!fs.existsSync(datasetDir)) {
    throw new Error(`數據集目錄不存在: ${datasetDir}`);
  }

  const dataset: { [label: string]: string[] } = {};
  const labelDirs = fs.readdirSync(datasetDir).filter((item) => {
    const itemPath = path.join(datasetDir, item);
    return fs.statSync(itemPath).isDirectory();
  });

  labelDirs.forEach((label) => {
    const labelDir = path.join(datasetDir, label);
    const files = fs.readdirSync(labelDir).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
    });

    dataset[label] = files.map((file) => path.join(labelDir, file));
  });

  return dataset;
}

/**
 * 創建分類器模型（在 MobileNet 基礎上添加分類層）
 */
function createClassifier(
  baseModel: tf.LayersModel,
  numClasses: number,
  hiddenUnits: number = 128
): tf.LayersModel {
  console.log(`🔧 創建分類器 (${numClasses} 個類別)...`);

  // 獲取基礎模型的輸出（特徵提取部分）
  // model.output 可能是 SymbolicTensor 或 SymbolicTensor[]
  const baseOutput = Array.isArray(baseModel.output)
    ? baseModel.output[0]
    : baseModel.output;

  // 檢查輸出形狀，決定處理方式
  const outputShape = baseOutput.shape;
  console.log(`   基礎模型輸出形狀: ${JSON.stringify(outputShape)}`);

  let features: tf.SymbolicTensor = baseOutput;

  // 如果輸出是 2D 且只有 1000 個單元（MobileNet 完整分類輸出）
  if (outputShape && outputShape.length === 2 && outputShape[1] === 1000) {
    // MobileNet 輸出是完整分類結果，我們需要從中間層提取特徵
    // 嘗試找到分類層之前的特徵提取層
    const layers = baseModel.layers;
    let featureLayer: tf.layers.Layer | null = null;

    // 從後往前找，跳過分類相關層（dropout, conv_preds, act_softmax, reshape）
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const layerName = layer.name.toLowerCase();
      // 尋找全局池化層或重塑層之前的層
      if (
        layerName.includes("global_average_pooling") ||
        (layerName.includes("reshape") && !layerName.includes("2"))
      ) {
        featureLayer = layer;
        break;
      }
    }

    if (featureLayer) {
      // 直接使用特徵層的輸出，不創建臨時模型（避免 dispose 問題）
      let extractedFeatures = Array.isArray(featureLayer.output)
        ? featureLayer.output[0]
        : featureLayer.output;

      console.log(`   ✅ 從層 "${featureLayer.name}" 提取特徵`);
      console.log(`   特徵形狀: ${JSON.stringify(extractedFeatures.shape)}`);

      // 如果特徵是 4D，需要 flatten 或 global pooling
      if (extractedFeatures.shape && extractedFeatures.shape.length === 4) {
        features = tf.layers
          .globalAveragePooling2d({
            name: "classifier_feature_pool",
          })
          .apply(extractedFeatures) as tf.SymbolicTensor;
      } else if (
        extractedFeatures.shape &&
        extractedFeatures.shape.length > 2
      ) {
        // 如果是 3D 或其他多維，使用 flatten
        features = tf.layers
          .flatten({
            name: "classifier_feature_flatten",
          })
          .apply(extractedFeatures) as tf.SymbolicTensor;
      } else {
        features = extractedFeatures;
      }
    } else {
      // 如果找不到，使用投影層將 1000 維映射到特徵維度
      console.log("   ⚠️  未找到特徵層，使用投影層映射");
      features = tf.layers
        .dense({
          units: 512,
          activation: "relu",
          name: "feature_projection",
          useBias: true,
        })
        .apply(baseOutput) as tf.SymbolicTensor;
    }
  } else if (outputShape && outputShape.length === 4) {
    // 如果輸出是 4D（包含空間維度），需要全局平均池化
    features = tf.layers
      .globalAveragePooling2d({
        name: "classifier_global_avg_pool",
      })
      .apply(baseOutput) as tf.SymbolicTensor;
  }

  // 添加隱藏層
  const hidden = tf.layers
    .dense({
      units: hiddenUnits,
      activation: "relu",
      name: "classifier_hidden",
    })
    .apply(features) as tf.SymbolicTensor;

  // 添加 Dropout 防止過擬合（使用唯一名稱避免衝突）
  const dropout = tf.layers
    .dropout({
      rate: 0.5,
      name: "classifier_dropout",
    })
    .apply(hidden) as tf.SymbolicTensor;

  // 添加分類層
  const output = tf.layers
    .dense({
      units: numClasses,
      activation: "softmax",
      name: "classifier_output",
    })
    .apply(dropout) as tf.SymbolicTensor;

  // 創建新模型
  // model.input 也可能是 SymbolicTensor 或 SymbolicTensor[]
  const baseInput = Array.isArray(baseModel.input)
    ? baseModel.input[0]
    : baseModel.input;

  const classifier = tf.model({
    inputs: baseInput,
    outputs: output,
  });

  // 凍結基礎模型的層（只訓練分類層）
  // 注意：我們只凍結基礎模型的前 N-1 層，最後的特徵層不凍結（如果有的話）
  const numBaseLayers = baseModel.layers.length;
  for (let i = 0; i < numBaseLayers; i++) {
    const layer = baseModel.layers[i];
    // 只凍結基礎模型的層，不包括我們新加的層
    if (classifier.layers.some((l) => l === layer)) {
      layer.trainable = false;
    }
  }

  // 凍結所有基礎模型的層（更安全的方法）
  baseModel.layers.forEach((layer) => {
    layer.trainable = false;
  });

  console.log("✅ 分類器創建完成\n");

  return classifier;
}

/**
 * 準備訓練數據
 */
async function prepareTrainingData(
  dataset: { [label: string]: string[] },
  classNames: string[]
): Promise<{
  xs: tf.Tensor4D;
  ys: tf.Tensor2D;
}> {
  console.log("📊 準備訓練數據...");

  const allImages: string[] = [];
  const allLabels: number[] = [];

  // 收集所有圖片和對應的標籤
  classNames.forEach((className, classIndex) => {
    const images = dataset[className] || [];
    images.forEach((imagePath) => {
      allImages.push(imagePath);
      allLabels.push(classIndex);
    });
  });

  if (allImages.length === 0) {
    throw new Error("沒有找到訓練圖片");
  }

  console.log(
    `   總共 ${allImages.length} 張圖片，${classNames.length} 個類別`
  );

  // 載入所有圖片
  const tensors: tf.Tensor4D[] = [];
  let loaded = 0;

  for (const imagePath of allImages) {
    try {
      const tensor = await loadImageAsTensor(imagePath, IMAGE_SIZE);
      tensors.push(tensor);
      loaded++;

      if (loaded % 10 === 0) {
        process.stdout.write(`   已載入: ${loaded}/${allImages.length}\r`);
      }
    } catch (error) {
      console.warn(`\n   跳過圖片: ${imagePath}`);
    }
  }

  console.log(`\n   ✅ 成功載入 ${loaded} 張圖片\n`);

  // 合併為批次
  const xs = tf.concat(tensors, 0) as tf.Tensor4D;

  // 創建標籤（one-hot encoding）
  const ys = tf.oneHot(
    tf.tensor1d(allLabels, "int32"),
    classNames.length
  ) as tf.Tensor2D;

  // 清理中間 tensor
  tensors.forEach((t) => t.dispose());

  return { xs, ys };
}

/**
 * 訓練模型
 */
async function trainModel(
  model: tf.LayersModel,
  xs: tf.Tensor4D,
  ys: tf.Tensor2D,
  epochs: number = 10,
  batchSize: number = 32,
  logger?: TrainingLogger
): Promise<any> {
  console.log("🎯 開始訓練模型...");
  console.log(`   訓練輪數: ${epochs}`);
  console.log(`   批次大小: ${batchSize}\n`);

  // 編譯模型
  const learningRate = 0.001;
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  // 訓練模型
  const history = await model.fit(xs, ys, {
    epochs,
    batchSize,
    shuffle: true,
    validationSplit: 0.2, // 20% 用於驗證
    callbacks: {
      onEpochEnd: (epoch: number, logs?: any) => {
        const loss = logs?.loss ? Number(logs.loss).toFixed(4) : "N/A";
        const acc = logs?.acc ? Number(logs.acc).toFixed(4) : "N/A";
        const valLoss = logs?.val_loss
          ? Number(logs.val_loss).toFixed(4)
          : "N/A";
        const valAcc = logs?.val_acc ? Number(logs.val_acc).toFixed(4) : "N/A";
        console.log(
          `   Epoch ${epoch + 1}/${epochs} - ` +
            `loss: ${loss} - ` +
            `acc: ${acc} - ` +
            `val_loss: ${valLoss} - ` +
            `val_acc: ${valAcc}`
        );

        // 記錄到訓練日誌
        if (logger) {
          logger.logEpoch(epoch, logs);
        }
      },
    },
  });

  console.log("\n✅ 訓練完成！\n");

  return history;
}

/**
 * 保存模型
 * 由於 TensorFlow.js 瀏覽器版本不支持 file:// 協議，我們手動保存模型
 */
async function saveModel(
  model: tf.LayersModel,
  modelDir: string
): Promise<void> {
  console.log("💾 保存模型...");

  // 確保目錄存在
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  try {
    // 嘗試使用標準方式保存（如果支持）
    await model.save(`file://${modelDir}`);
    console.log(`✅ 模型已保存到: ${modelDir}\n`);
  } catch (error) {
    // 如果失敗，使用手動保存方式
    console.log("⚠️  標準保存方式失敗，使用手動保存方式...");
    await saveModelManually(model, modelDir);
  }
}

/**
 * 手動保存模型（適用於瀏覽器版本的 TensorFlow.js）
 */
async function saveModelManually(
  model: tf.LayersModel,
  modelDir: string
): Promise<void> {
  // 1. 保存模型結構（JSON）
  const modelJson = model.toJSON();
  const modelJsonPath = path.join(modelDir, "model.json");
  fs.writeFileSync(modelJsonPath, JSON.stringify(modelJson, null, 2), "utf-8");
  console.log(`   ✅ 模型結構已保存: ${path.basename(modelJsonPath)}`);

  // 2. 收集所有權重並保存
  const weightManifest: Array<{
    name: string;
    shape: (number | null)[];
    dtype: string;
  }> = [];

  let totalWeights = 0;
  for (const weight of model.weights) {
    // 使用 read() 方法獲取權重值（避免直接訪問受保護的 val 屬性）
    const weightTensor = weight.read();
    const values = await weightTensor.array();
    const flattened = (values as any).flat(Infinity) as number[];

    // 保存每個權重為單獨的文件
    const weightName = weight.name.replace(/\//g, "_").replace(/:/g, "_");
    const weightPath = path.join(modelDir, `${weightName}.bin`);
    const buffer = Buffer.from(new Float32Array(flattened).buffer);
    fs.writeFileSync(weightPath, buffer);

    weightManifest.push({
      name: weight.name,
      shape: weight.shape, // Shape 類型可能包含 null，這裡保留原始類型
      dtype: weight.dtype,
    });

    totalWeights += flattened.length;

    // 清理臨時 tensor
    weightTensor.dispose();
  }

  // 3. 保存權重清單
  const manifestPath = path.join(modelDir, "weights-manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(weightManifest, null, 2),
    "utf-8"
  );
  console.log(`   ✅ 權重清單已保存: ${path.basename(manifestPath)}`);
  console.log(`   ✅ 總共保存 ${weightManifest.length} 個權重張量`);

  console.log(`\n✅ 模型已成功保存到: ${modelDir}`);
}

/**
 * 嘗試載入已訓練的模型
 */
async function tryLoadExistingModel(
  modelDir: string
): Promise<tf.LayersModel | null> {
  const modelJsonPath = path.join(modelDir, "model.json");

  if (!fs.existsSync(modelJsonPath)) {
    console.log("   ℹ️  未找到已有模型文件（model.json 不存在）");
    return null;
  }

  try {
    console.log("📦 檢測到已有模型，嘗試載入...");
    console.log(`   模型路徑: ${modelJsonPath}`);

    // 嘗試載入模型（TensorFlow.js 會自動處理權重文件）
    const model = await tf.loadLayersModel(`file://${modelJsonPath}`);
    console.log("   ✅ 模型載入成功");
    return model;
  } catch (error: any) {
    console.log("   ⚠️  模型載入失敗:", error.message || error);
    console.log("   💡 提示：這可能是因為模型保存格式不兼容，將使用全新訓練");
    return null;
  }
}

/**
 * 主訓練函數
 */
async function train(continueTraining: boolean = false) {
  const epochs = 5; // 訓練輪數：15 個 epochs
  const batchSize = 32;
  const learningRate = 0.001;
  const validationSplit = 0.2;
  let logger: TrainingLogger | undefined;

  try {
    console.log("🚀 開始訓練模型...\n");

    // 1. 載入數據集
    console.log("📂 讀取數據集...");
    const dataset = loadDataset();
    const classNames = Object.keys(dataset).sort();

    if (classNames.length === 0) {
      throw new Error("數據集為空，請先準備訓練數據");
    }

    const totalImages = Object.values(dataset).reduce(
      (sum, images) => sum + images.length,
      0
    );
    console.log(
      `✅ 找到 ${classNames.length} 個類別，共 ${totalImages} 張圖片`
    );
    console.log(`   類別: ${classNames.join(", ")}\n`);

    // 初始化訓練記錄器
    const logDir = path.join(rootDir, "training_logs");
    logger = new TrainingLogger(logDir, {
      totalEpochs: epochs,
      batchSize,
      learningRate,
      optimizer: "adam",
      lossFunction: "categoricalCrossentropy",
      validationSplit,
      imageSize: IMAGE_SIZE,
      numClasses: classNames.length,
      totalImages,
      classNames,
      baseModel: "MobileNet",
      featureExtractor: "unknown",
    });

    // 2. 載入或創建分類器
    let classifier: tf.LayersModel;

    if (continueTraining) {
      // 嘗試載入已有模型
      const existingModel = await tryLoadExistingModel(classifierModelDir);
      if (existingModel) {
        console.log("✅ 成功載入已有模型，將繼續訓練\n");
        classifier = existingModel;
      } else {
        console.log("⚠️  無法載入已有模型，將創建新模型\n");
        // 載入基礎模型並創建新分類器
        const baseModel = await loadMobileNet(baseModelDir);
        classifier = createClassifier(baseModel, classNames.length);

        const baseModelName = baseModel.name || "MobileNet";
        if (logger) {
          logger.updateMetadata({
            baseModel: baseModelName,
            featureExtractor: "reshape_1 (1024 dim)",
          });
        }
      }
    } else {
      // 全新訓練：載入基礎模型並創建新分類器
      const baseModel = await loadMobileNet(baseModelDir);

      // 更新記錄器的基礎模型信息
      const baseModelName = baseModel.name || "MobileNet";
      logger.updateMetadata({
        baseModel: baseModelName,
        featureExtractor: "reshape_1 (1024 dim)",
      });

      classifier = createClassifier(baseModel, classNames.length);
    }

    // 4. 準備訓練數據
    const { xs, ys } = await prepareTrainingData(dataset, classNames);

    // 5. 訓練模型
    const history = await trainModel(
      classifier,
      xs,
      ys,
      epochs,
      batchSize,
      logger
    );

    // 6. 清理
    xs.dispose();
    ys.dispose();

    // 完成訓練記錄
    if (logger) {
      logger.finish();
      console.log(logger.generateSummary());
    }

    // 7. 保存模型
    await saveModel(classifier, classifierModelDir);

    // 8. 保存類別名稱（用於推理時使用）
    const classNamesPath = path.join(classifierModelDir, "classNames.json");
    fs.writeFileSync(classNamesPath, JSON.stringify(classNames, null, 2));

    console.log("🎉 訓練流程完成！");
    console.log(`\n模型已保存，類別信息已保存到: ${classNamesPath}`);

    if (logger) {
      console.log(`\n📊 訓練記錄已保存到: ${logger.getLogFilePath()}`);
    }
  } catch (error) {
    // 即使失敗也記錄
    if (logger) {
      logger.finish();
    }
    console.error("❌ 訓練失敗:", error);
    throw error;
  }
}

// 如果直接運行此文件
if (require.main === module) {
  // 檢查命令行參數
  const continueTraining =
    process.argv.includes("--continue") ||
    process.argv.includes("-c") ||
    process.argv[2] === "continue";

  if (continueTraining) {
    console.log("🔄 繼續訓練模式：將嘗試載入已有模型\n");
  } else {
    console.log("🆕 全新訓練模式：將創建新模型\n");
  }

  train(continueTraining)
    .then(() => {
      console.log("\n✅ 所有操作完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ 發生錯誤:", error);
      process.exit(1);
    });
}

export { train };
