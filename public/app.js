// API 基礎 URL
const API_BASE = window.location.origin;

// 狀態管理
let state = {
  images: [],
  filteredImages: [],
  currentIndex: 0,
  countries: [],
  selectedCountry: null,
  labels: {}, // imageId -> labels
  mode: 'labeling', // 'labeling' 或 'review'
  reviewFilter: 'ai', // 'ai', 'manual'
  selectedLabelId: null, // 審核模式下選中的標籤ID
  lastAIPrediction: null // 最新的 AI 預測結果（用於自動保存）
};

// DOM 元素（在函數中獲取，確保 DOM 已加載）
let elements = {};

// 初始化 DOM 元素引用
function initElements() {
  elements = {
    countriesList: document.getElementById('countries-list'),
    totalCount: null, // 已移除，不再使用
    labeledCount: document.getElementById('labeled-count'),
    unlabeledCount: document.getElementById('unlabeled-count'),
    currentImage: document.getElementById('current-image'),
    imageFilename: document.getElementById('image-filename'),
    imageCountry: document.getElementById('image-country'),
    currentIndex: document.getElementById('current-index'),
    totalImages: document.getElementById('total-images'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    classifyBtn: document.getElementById('classify-btn'),
    labelSelect: document.getElementById('label-select'),
    labelRadioGroup: document.getElementById('label-radio-group'),
    saveLabelBtn: document.getElementById('save-label-btn'),
    currentLabels: document.getElementById('current-labels'),
    predictions: document.getElementById('predictions'),
    loading: document.getElementById('loading'),
    labelingPanel: document.getElementById('labeling-panel'),
    reviewPanel: document.getElementById('review-panel'),
    labelingModeBtn: document.getElementById('labeling-mode-btn'),
    reviewModeBtn: document.getElementById('review-mode-btn'),
    reviewLabels: document.getElementById('review-labels'),
    reviewCorrectBtn: document.getElementById('review-correct-btn'),
    reviewDeleteBtn: document.getElementById('review-delete-btn'),
    reviewAddLabelBtn: document.getElementById('review-add-label-btn'),
    reviewLabelRadioGroup: document.getElementById('review-label-radio-group')
  };
  
  // 檢查關鍵元素是否存在
  if (!elements.currentImage) {
    console.error('❌ 無法找到 current-image 元素');
  }
  if (!elements.labelingModeBtn) {
    console.error('❌ 無法找到 labeling-mode-btn 元素');
  }
  if (!elements.reviewModeBtn) {
    console.error('❌ 無法找到 review-mode-btn 元素');
  }
}

// 初始化
async function init() {
  console.log('🚀 開始初始化應用...');
  
  // 初始化 DOM 元素引用
  initElements();
  
  // 檢查必要的元素
  if (!elements.currentImage || !elements.labelingModeBtn || !elements.reviewModeBtn) {
    console.error('❌ 關鍵 DOM 元素缺失，請檢查 HTML 結構');
    return;
  }
  
  try {
    await loadCountries();
    await loadImages();
    setupEventListeners();
    await updateStats(); // 載入統計數據
    updateUI();
    console.log('✅ 應用初始化完成');
  } catch (error) {
    console.error('❌ 初始化失敗:', error);
    showError('應用初始化失敗: ' + (error.message || error));
  }
}

// 載入國家列表
async function loadCountries() {
  try {
    // 根據模式選擇不同的查詢參數
    const mode = state.mode || 'labeling';
    const filterType = state.reviewFilter || 'ai';
    const url = mode === 'review' 
      ? `${API_BASE}/api/countries?mode=review&filterType=${filterType}`
      : `${API_BASE}/api/countries`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      state.countries = data.countries;
      
      // 清空現有的國家列表按鈕（避免重複添加）
      elements.countriesList.innerHTML = '';
      
      // 更新國家列表 UI
      data.countries.forEach((country, index) => {
        const btn = document.createElement('button');
        btn.className = 'country-btn';
        btn.dataset.country = country.name;
        btn.textContent = `${country.name} (${country.count})`;
        btn.addEventListener('click', () => filterByCountry(country.name));
        elements.countriesList.appendChild(btn);
        
        // 自動選中第一個國家（如果還沒有選中任何國家）
        // 注意：實際篩選會在 loadImages 完成後進行
        if (index === 0 && !state.selectedCountry && state.mode === 'labeling') {
          btn.classList.add('active');
          state.selectedCountry = country.name;
        }
      });
      
      // 更新標籤單選按鈕組
      updateLabelRadioGroup(data.countries);
      
      // 如果是審核模式，也更新審核模式的標籤單選按鈕組
      // 但需要載入所有國家（用於標籤選擇），而不僅僅是有未審核標籤的國家
      if (state.mode === 'review') {
        loadAllCountriesForLabels();
      }
      
      // 注意：總數統計在 updateStats() 函數中處理，這裡不需要單獨設置
    }
  } catch (error) {
    console.error('載入國家列表失敗:', error);
    showError('載入國家列表失敗');
  }
}

// 更新標籤單選按鈕組
function updateLabelRadioGroup(countries) {
  if (!elements.labelRadioGroup) return;
  
  elements.labelRadioGroup.innerHTML = '';
  
  countries.forEach(country => {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'label';
    radio.id = `label-${country.name}`;
    radio.value = country.name;
    
    const label = document.createElement('label');
    label.htmlFor = `label-${country.name}`;
    label.textContent = country.name;
    
    radioItem.appendChild(radio);
    radioItem.appendChild(label);
    elements.labelRadioGroup.appendChild(radioItem);
  });
}

// 載入所有國家列表（用於標籤選擇器）
async function loadAllCountriesForLabels() {
  try {
    // 載入所有國家（不帶 mode 參數）
    const response = await fetch(`${API_BASE}/api/countries`);
    const data = await response.json();
    
    if (data.success && elements.reviewLabelRadioGroup) {
      updateReviewLabelRadioGroup(data.countries);
    }
  } catch (error) {
    console.error('載入所有國家列表失敗:', error);
  }
}

// 更新審核模式的標籤單選按鈕組
function updateReviewLabelRadioGroup(countries) {
  if (!elements.reviewLabelRadioGroup) return;
  
  elements.reviewLabelRadioGroup.innerHTML = '';
  
  countries.forEach(country => {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'review-label';
    radio.id = `review-label-${country.name}`;
    radio.value = country.name;
    
    const label = document.createElement('label');
    label.htmlFor = `review-label-${country.name}`;
    label.textContent = country.name;
    
    radioItem.appendChild(radio);
    radioItem.appendChild(label);
    elements.reviewLabelRadioGroup.appendChild(radioItem);
  });
  
  // 添加「其他」選項
  const otherRadioItem = document.createElement('div');
  otherRadioItem.className = 'radio-item';
  
  const otherRadio = document.createElement('input');
  otherRadio.type = 'radio';
  otherRadio.name = 'review-label';
  otherRadio.id = 'review-label-其他';
  otherRadio.value = '其他';
  
  const otherLabel = document.createElement('label');
  otherLabel.htmlFor = 'review-label-其他';
  otherLabel.textContent = '其他';
  
  otherRadioItem.appendChild(otherRadio);
  otherRadioItem.appendChild(otherLabel);
  elements.reviewLabelRadioGroup.appendChild(otherRadioItem);
  
  console.log(`✅ 已更新審核模式標籤選擇器，共 ${countries.length + 1} 個選項（包含「其他」）`);
}

// 載入圖片列表
async function loadImages() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/images`);
    const data = await response.json();
    
    if (data.success) {
      state.images = data.images;
      
      // 如果是標註模式，過濾掉已標註的圖片
      if (state.mode === 'labeling') {
        state.filteredImages = await filterUnlabeledImages(data.images);
      } else {
        state.filteredImages = data.images;
      }
      
      state.currentIndex = 0;
      
      // 如果已經選中了一個國家（在載入國家列表時），現在進行篩選
      if (state.selectedCountry && state.mode === 'labeling') {
        await filterByCountry(state.selectedCountry);
      } else {
        updateUI();
        await updateStats();
      }
    }
  } catch (error) {
    console.error('載入圖片失敗:', error);
    showError('載入圖片失敗');
  } finally {
    showLoading(false);
  }
}

// 按國家篩選
async function filterByCountry(country) {
  console.log('篩選國家:', country);
  state.selectedCountry = country;
  
  // 更新按鈕狀態
  document.querySelectorAll('.country-btn').forEach(btn => {
    const btnCountry = btn.dataset.country;
    btn.classList.toggle('active', btnCountry === country);
  });
  
  
  // 如果處於審核模式，從服務器端獲取需要審核的圖片
  if (state.mode === 'review') {
    // 使用 applyReviewFilter 從服務器端獲取
    applyReviewFilter().then(() => {
      state.currentIndex = 0;
      updateStats(); // 更新統計
    });
    return; // 提前返回，等待異步完成
  }
  
  // 標註模式：只顯示未標註的圖片
  try {
    showLoading(true);
    
    let filtered = [];
    if (country) {
      filtered = state.images.filter(img => img.country === country);
    } else {
      filtered = state.images;
    }
    
    // 過濾掉已標註的圖片
    filtered = await filterUnlabeledImages(filtered);
    
    state.filteredImages = filtered;
    console.log(`顯示未標註圖片，總數:`, state.filteredImages.length);
    
    state.currentIndex = 0;
    updateUI();
    await updateStats(); // 更新統計
  } catch (error) {
    console.error('篩選圖片失敗:', error);
    showError('篩選圖片失敗');
  } finally {
    showLoading(false);
  }
}

// 過濾未標註的圖片
async function filterUnlabeledImages(images) {
  if (images.length === 0) return [];
  
  // 批量檢查圖片是否有標籤
  const unlabeledImages = [];
  
  // 分批檢查，避免過多的API請求
  const batchSize = 20;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    
    // 並行檢查這批圖片
    const checks = await Promise.all(
      batch.map(async (img) => {
        try {
          const response = await fetch(`${API_BASE}/api/images/${img.id}/labels`);
          const data = await response.json();
          
          // 如果沒有標籤或標籤數量為0，則認為未標註
          return !data.success || !data.labels || data.labels.length === 0;
        } catch (error) {
          console.error(`檢查圖片 ${img.id} 標籤失敗:`, error);
          // 如果檢查失敗，保守處理，認為未標註
          return true;
        }
      })
    );
    
    // 添加未標註的圖片
    batch.forEach((img, idx) => {
      if (checks[idx]) {
        unlabeledImages.push(img);
      }
    });
  }
  
  return unlabeledImages;
}

// 根據審核條件篩選圖片（同步版本，只使用已載入的標籤）
function filterImagesByReview(images) {
  // 需要檢查每張圖片是否有符合條件的標籤
  // 為了效率，我們只檢查已經載入的標籤
  const filtered = [];
  
  for (const img of images) {
    const labels = state.labels[img.id] || [];
    
    let hasMatch = false;
    if (state.reviewFilter === 'ai') {
      hasMatch = labels.some(l => !l.isManual);
    } else if (state.reviewFilter === 'manual') {
      hasMatch = labels.some(l => l.isManual);
    }
    
    if (hasMatch) {
      filtered.push(img);
    }
  }
  
  return filtered;
}

// 異步載入標籤並篩選圖片
async function filterImagesByReviewAsync(images) {
  // 先使用已載入的標籤進行篩選
  let filtered = filterImagesByReview(images);
  
  // 如果當前圖片列表為空，嘗試載入一些標籤
  if (filtered.length === 0 && images.length > 0) {
    // 載入前幾張圖片的標籤
    const sampleSize = Math.min(10, images.length);
    for (let i = 0; i < sampleSize; i++) {
      const img = images[i];
      if (!state.labels[img.id]) {
        try {
          const response = await fetch(`${API_BASE}/api/images/${img.id}/labels`);
          const data = await response.json();
          if (data.success) {
            state.labels[img.id] = data.labels;
            const labels = data.labels;
            let hasMatch = false;
            if (state.reviewFilter === 'ai') {
              hasMatch = labels.some(l => !l.isManual);
            } else if (state.reviewFilter === 'manual') {
              hasMatch = labels.some(l => l.isManual);
            }
            if (hasMatch) {
              filtered.push(img);
            }
          }
        } catch (error) {
          console.error('載入標籤失敗:', error);
        }
      }
    }
  }
  
  return filtered;
}

// 更新 UI
function updateUI() {
  const currentImage = state.filteredImages[state.currentIndex];
  
  if (!currentImage) {
    if (elements.currentImage) elements.currentImage.src = '';
    if (elements.imageFilename) elements.imageFilename.textContent = '沒有圖片';
    if (elements.imageCountry) elements.imageCountry.textContent = '';
    if (elements.currentIndex) elements.currentIndex.textContent = '0';
    if (elements.totalImages) elements.totalImages.textContent = '0';
    return;
  }
  
  // 更新圖片（添加錯誤處理和備用方案）
  if (elements.currentImage) {
    // 標記是否已經嘗試過備用方案
    let hasTriedFallback = false;
    
    // 設置錯誤處理器
    elements.currentImage.onerror = function() {
      const currentSrc = this.src;
      
      // 忽略瀏覽器擴展導致的錯誤（通常是chrome-extension://或moz-extension://）
      if (currentSrc.startsWith('chrome-extension://') || 
          currentSrc.startsWith('moz-extension://') ||
          currentSrc === '' || 
          currentSrc === window.location.origin + '/') {
        return; // 忽略這些錯誤
      }
      
      console.error('❌ 圖片加載失敗:', currentSrc);
      
      // 如果還沒有嘗試過備用方案，嘗試使用備用 API 端點
      if (!hasTriedFallback && !currentSrc.includes('/api/image-file/')) {
        hasTriedFallback = true;
        console.log('⚠️  靜態文件服務失敗，嘗試使用備用 API 端點...');
        const fallbackUrl = currentImage.apiUrl || `/api/image-file/${currentImage.country}/${currentImage.filename}`;
        console.log('🔄 使用備用 URL:', fallbackUrl);
        this.src = fallbackUrl;
        return; // 不顯示錯誤，等待備用方案加載
      }
      
      // 如果備用方案也失敗了，顯示錯誤
      console.error('圖片信息:', {
        id: currentImage.id,
        country: currentImage.country,
        filename: currentImage.filename,
        url: currentImage.url,
        triedFallback: hasTriedFallback
      });
      showError(`圖片加載失敗: ${currentImage.filename}`);
    };
    
    elements.currentImage.onload = function() {
      // 只在非擴展URL時記錄成功
      if (!this.src.startsWith('chrome-extension://') && 
          !this.src.startsWith('moz-extension://')) {
        console.log('✅ 圖片加載成功:', this.src);
      }
      hasTriedFallback = false; // 重置標記
      showLoading(false);
    };
    
    // 設置圖片源（優先使用靜態文件服務）
    // 確保 URL 正確構建
    let imageUrl = currentImage.url;
    if (!imageUrl || imageUrl === '/' || imageUrl.startsWith('http://localhost:3000/')) {
      // 如果 URL 無效，構建正確的 URL
      if (currentImage.country && currentImage.filename) {
        imageUrl = `/images/${currentImage.country}/${currentImage.filename}`;
      } else if (currentImage.path) {
        imageUrl = `/images/${currentImage.path}`;
      } else {
        console.error('❌ 無法構建圖片 URL:', currentImage);
        imageUrl = currentImage.apiUrl || `/api/image-file/${currentImage.country}/${currentImage.filename}`;
      }
    }
    console.log('🔄 加載圖片:', imageUrl);
    elements.currentImage.src = imageUrl;
  } else {
    console.error('❌ currentImage 元素不存在');
  }
  if (elements.imageFilename) elements.imageFilename.textContent = currentImage.filename;
  if (elements.imageCountry) elements.imageCountry.textContent = `國家: ${currentImage.country}`;
  
  // 更新計數器
  if (elements.currentIndex) elements.currentIndex.textContent = state.currentIndex + 1;
  if (elements.totalImages) elements.totalImages.textContent = state.filteredImages.length;
  
  // 更新按鈕狀態
  if (elements.prevBtn) elements.prevBtn.disabled = state.currentIndex === 0;
  if (elements.nextBtn) elements.nextBtn.disabled = state.currentIndex === state.filteredImages.length - 1;
  
  // 載入當前圖片的標籤
  if (state.mode === 'review') {
    // 審核模式：先載入標籤，再顯示
    loadCurrentImageLabels().then(async () => {
      await displayReviewLabels();
    });
    
    // 確保審核模式的標籤選擇器已載入
    if (elements.reviewLabelRadioGroup && elements.reviewLabelRadioGroup.children.length === 0) {
      loadAllCountriesForLabels();
    }
  } else {
    // 標註模式：正常載入標籤
    loadCurrentImageLabels();
  }
  
  // 清空預測結果
  clearPredictions();
}

// 載入當前圖片的標籤
async function loadCurrentImageLabels() {
  const currentImage = state.filteredImages[state.currentIndex];
  if (!currentImage) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/images/${currentImage.id}/labels`);
    const data = await response.json();
    
    if (data.success) {
      state.labels[currentImage.id] = data.labels;
      
      // 標註模式下顯示標籤
      if (state.mode === 'labeling') {
        displayLabels(data.labels);
      }
      
      return data.labels;
    }
  } catch (error) {
    console.error('載入標籤失敗:', error);
    // 如果載入失敗，設置為空數組
    state.labels[currentImage.id] = [];
    return [];
  }
  
  return [];
}

// 顯示標籤
function displayLabels(labels) {
  if (!elements.currentLabels) return;
  
  elements.currentLabels.innerHTML = '';
  
  if (!labels || labels.length === 0) {
    elements.currentLabels.innerHTML = '<p class="empty-state">尚未標註</p>';
    return;
  }
  
  labels.forEach(label => {
    const tag = document.createElement('span');
    tag.className = `label-tag ${label.isManual ? 'manual' : 'ai'} ${label.reviewed ? 'reviewed' : 'unreviewed'}`;
    tag.textContent = label.label;
    if (!label.isManual) {
      tag.title = `AI 分類 (置信度: ${(label.confidence * 100).toFixed(1)}%)`;
    }
    elements.currentLabels.appendChild(tag);
  });
}

// 保存標籤
async function saveLabel(labelToSave = null) {
  const currentImage = state.filteredImages[state.currentIndex];
  
  if (!currentImage) {
    console.error('❌ 沒有當前圖片');
    alert('請先選擇一張圖片');
    return;
  }
  
  // 如果沒有提供標籤，從選中的 radio button 獲取
  let label = labelToSave;
  if (!label) {
    const selectedRadio = document.querySelector('input[name="label"]:checked');
    if (!selectedRadio) {
      alert('請選擇標籤');
      return;
    }
    label = selectedRadio.value;
  }
  
  console.log(`💾 開始保存標籤: ${label} 到圖片 ${currentImage.id}`);
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/images/${currentImage.id}/label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        label: label,
        isManual: !labelToSave, // 如果通過參數傳入，視為 AI 推薦
        confidence: labelToSave ? state.lastAIPrediction?.confidence : 1.0
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '未知錯誤' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ 標籤保存成功:', data);
      
      // 重新載入標籤
      await loadCurrentImageLabels();
      
      // 更新統計（異步更新）
      await updateStats();
      
      // 清空選擇
      if (!labelToSave) {
        const selectedRadio = document.querySelector('input[name="label"]:checked');
        if (selectedRadio) {
          selectedRadio.checked = false;
        }
      }
      
      showSuccess('標籤已保存');
    } else {
      console.error('❌ 保存失敗:', data.error);
      showError(data.error || '保存失敗');
    }
  } catch (error) {
    console.error('❌ 保存標籤失敗:', error);
    showError(`保存標籤失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
  } finally {
    showLoading(false);
  }
}

// 批量自動分類（每個文件夾 10 張圖片）
async function classifyImage() {
  console.log('🚀 開始批量自動分類（每個文件夾 10 張圖片）...');
  
  try {
    showLoading(true);
    
    // 檢查分類按鈕是否可用（避免重複點擊）
    if (elements.classifyBtn) {
      elements.classifyBtn.disabled = true;
      elements.classifyBtn.textContent = '🔄 批量分類中...';
    }
    
    // 調用批量分類 API（每個文件夾最多 10 張）
    const response = await fetch(`${API_BASE}/api/images/batch-classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limitPerCountry: 10, // 每個文件夾最多 10 張
        topK: 1,
        batchSize: 8,
        saveResults: true // 自動保存結果
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '未知錯誤' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ 批量自動分類已開始:', data);
      showSuccess(`批量自動分類已開始！將在每個文件夾分類最多 10 張圖片，共 ${data.total} 張。請查看服務器日誌獲取進度。完成後可在「審核模式」中檢查結果。`);
      
      // 更新統計
      setTimeout(async () => {
        await updateStats();
      }, 2000);
    } else {
      console.error('❌ 批量分類失敗:', data.error);
      showError(data.error || '批量分類失敗');
    }
  } catch (error) {
    console.error('❌ 批量分類請求失敗:', error);
    showError(`批量分類失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
  } finally {
    showLoading(false);
    // 恢復按鈕狀態
    if (elements.classifyBtn) {
      elements.classifyBtn.disabled = false;
      elements.classifyBtn.textContent = '🚀 批量自動分類（每個文件夾 10 張）';
    }
  }
}

// 顯示預測結果
function displayPredictions(predictions) {
  if (!elements.predictions) return;
  
  elements.predictions.innerHTML = '';
  
  if (!predictions || predictions.length === 0) {
    elements.predictions.innerHTML = '<p class="empty-state">無預測結果</p>';
    return;
  }
  
  // 保存預測結果到 state（用於自動保存）
  state.lastAIPrediction = predictions[0];
  
  // 按置信度排序
  predictions.sort((a, b) => b.confidence - a.confidence);
  
  // 獲取最高置信度的預測
  const topPrediction = predictions[0];
  
  predictions.forEach((pred, index) => {
    const item = document.createElement('div');
    item.className = 'prediction-item';
    
    const confidencePercent = (pred.confidence * 100).toFixed(1);
    const isTop = index === 0;
    
    item.innerHTML = `
      <div style="flex: 1;">
        <div class="prediction-label">${pred.label} ${isTop ? '⭐' : ''}</div>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
        </div>
      </div>
      <div class="prediction-confidence">${confidencePercent}%</div>
    `;
    
    elements.predictions.appendChild(item);
  });
  
  // 添加「使用 AI 推薦」按鈕
  const useAIButton = document.createElement('button');
  useAIButton.className = 'btn btn-primary';
  useAIButton.style.width = '100%';
  useAIButton.style.marginTop = '10px';
  useAIButton.textContent = `✅ 使用 AI 推薦: ${topPrediction.label} (${(topPrediction.confidence * 100).toFixed(1)}%)`;
  useAIButton.addEventListener('click', async () => {
    console.log(`🤖 使用 AI 推薦標籤: ${topPrediction.label}`);
    await saveLabel(topPrediction.label);
  });
  
  elements.predictions.appendChild(useAIButton);
  
  // 自動選中對應的 radio button（如果存在）
  const matchingRadio = document.querySelector(`input[name="label"][value="${topPrediction.label}"]`);
  if (matchingRadio) {
    matchingRadio.checked = true;
    console.log(`✅ 自動選中標籤: ${topPrediction.label}`);
  }
}

// 清空預測結果
function clearPredictions() {
  if (elements.predictions) {
    elements.predictions.innerHTML = '<p class="empty-state">點擊「AI 分類」查看預測結果</p>';
  }
}

// 更新統計
async function updateStats() {
  try {
    // 如果是審核模式，顯示當前篩選後的圖片數量
    if (state.mode === 'review') {
      // 計算當前篩選後的已標註和未標註數量
      let labeledInFiltered = 0;
      for (const img of state.filteredImages) {
        if (state.labels[img.id] && state.labels[img.id].length > 0) {
          labeledInFiltered++;
        }
      }
      if (elements.labeledCount) {
        elements.labeledCount.textContent = labeledInFiltered;
      }
      if (elements.unlabeledCount) {
        elements.unlabeledCount.textContent = Math.max(0, state.filteredImages.length - labeledInFiltered);
      }
      return; // 審核模式使用本地統計，不需要從 API 獲取
    }
    
    // 標註模式：統計當前篩選後未標註的圖片
    // 統計當前篩選結果中的未標註圖片數量
    const unlabeledCount = state.filteredImages.length; // 標註模式下filteredImages已經是未標註的圖片
    const totalCount = state.mode === 'review' ? state.filteredImages.length : state.images.length;
    
    // 計算已標註的數量（總數 - 未標註數）
    const labeledCount = Math.max(0, totalCount - unlabeledCount);
    
    if (elements.labeledCount) {
      elements.labeledCount.textContent = labeledCount;
    }
    if (elements.unlabeledCount) {
      elements.unlabeledCount.textContent = unlabeledCount;
    }
  } catch (error) {
    console.error('獲取統計失敗:', error);
    // 如果 API 失敗，使用本地計算（作為備用）
    const labeled = Object.keys(state.labels).length;
    const total = state.mode === 'review' ? state.filteredImages.length : state.images.length;
    if (elements.labeledCount) elements.labeledCount.textContent = labeled;
    if (elements.unlabeledCount) elements.unlabeledCount.textContent = Math.max(0, total - labeled);
  }
}

// 事件監聽器設置
function setupEventListeners() {
  console.log('🔧 設置事件監聽器...');
  
  // 基本導航按鈕
  if (elements.prevBtn) {
    elements.prevBtn.addEventListener('click', () => {
      if (state.currentIndex > 0) {
        state.currentIndex--;
        updateUI();
      }
    });
  }
  
  if (elements.nextBtn) {
    elements.nextBtn.addEventListener('click', () => {
      if (state.currentIndex < state.filteredImages.length - 1) {
        state.currentIndex++;
        updateUI();
      }
    });
  }
  
  // 標籤和分類按鈕
  if (elements.saveLabelBtn) {
    elements.saveLabelBtn.addEventListener('click', saveLabel);
  }
  if (elements.classifyBtn) {
    elements.classifyBtn.addEventListener('click', classifyImage);
  }
  
  // 模式切換按鈕
  if (elements.labelingModeBtn) {
    console.log('✅ 綁定標註模式按鈕');
    elements.labelingModeBtn.addEventListener('click', () => {
      console.log('📝 切換到標註模式');
      switchMode('labeling');
    });
  } else {
    console.error('❌ labelingModeBtn 不存在');
  }
  
  if (elements.reviewModeBtn) {
    console.log('✅ 綁定審核模式按鈕');
    elements.reviewModeBtn.addEventListener('click', () => {
      console.log('✅ 切換到審核模式');
      switchMode('review');
    });
  } else {
    console.error('❌ reviewModeBtn 不存在');
  }
  
  // 審核篩選按鈕
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filter = e.target.dataset.filter;
      console.log('🔍 設置審核篩選:', filter);
      setReviewFilter(filter);
    });
  });
  
  // 審核操作按鈕
  if (elements.reviewCorrectBtn) {
    elements.reviewCorrectBtn.addEventListener('click', markLabelAsReviewed);
  }
  if (elements.reviewDeleteBtn) {
    elements.reviewDeleteBtn.addEventListener('click', deleteSelectedLabel);
  }
  if (elements.reviewAddLabelBtn) {
    elements.reviewAddLabelBtn.addEventListener('click', saveReviewLabel);
  }
  
  // 鍵盤快捷鍵
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && elements.prevBtn) {
      elements.prevBtn.click();
    } else if (e.key === 'ArrowRight' && elements.nextBtn) {
      elements.nextBtn.click();
    }
  });
  
  console.log('✅ 事件監聽器設置完成');
}

// 工具函數
function showLoading(show) {
  const overlay = elements.loading.parentElement; // image-overlay
  if (show) {
    overlay.classList.add('show');
    elements.loading.style.display = 'block';
  } else {
    overlay.classList.remove('show');
    elements.loading.style.display = 'none';
  }
}

function showError(message) {
  alert(`錯誤: ${message}`);
}

function showSuccess(message) {
  // 可以替換為更好的通知方式
  console.log(`成功: ${message}`);
}

// ==================== 模式切換和審核功能 ====================

// 切換模式
function switchMode(mode) {
  state.mode = mode;
  state.selectedLabelId = null;
  
  // 更新按鈕狀態
  if (elements.labelingModeBtn) {
    elements.labelingModeBtn.classList.toggle('active', mode === 'labeling');
  }
  if (elements.reviewModeBtn) {
    elements.reviewModeBtn.classList.toggle('active', mode === 'review');
  }
  
  // 顯示/隱藏面板
  if (elements.labelingPanel) {
    elements.labelingPanel.style.display = mode === 'labeling' ? 'grid' : 'none';
  }
  if (elements.reviewPanel) {
    elements.reviewPanel.style.display = mode === 'review' ? 'block' : 'none';
  }
  
  // 根據模式更新UI
  if (mode === 'review') {
    // 重新載入國家列表（審核模式下顯示有未審核標籤的國家）
    loadCountries().then(() => {
      // 載入所有國家用於標籤選擇器
      if (elements.reviewLabelRadioGroup) {
        loadAllCountriesForLabels();
      }
      // 異步應用篩選，然後顯示標籤
      applyReviewFilter().then(() => {
        // 更新統計（審核模式下的分類數量）
        updateStats();
      });
    });
  } else {
    // 標註模式：重新載入國家列表和未標註的圖片
    loadCountries().then(() => {
      loadImages().then(() => {
        updateUI();
      });
    });
  }
}

// 設置審核篩選
function setReviewFilter(filter) {
  state.reviewFilter = filter;
  
  // 更新按鈕狀態
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  
  // 應用篩選
  applyReviewFilter().then(() => {
    // 更新統計（顯示篩選後的數量）
    updateStats();
  });
}

// 應用審核篩選（從服務器端獲取需要審核的圖片）
async function applyReviewFilter() {
  try {
    showLoading(true);
    
    // 從服務器端 API 獲取需要審核的圖片
    const country = state.selectedCountry || undefined; // 不傳'all'，傳undefined或國家名稱
    const filterType = state.reviewFilter || 'ai';
    
    // 構建查詢參數
    let url = `${API_BASE}/api/images/review?filterType=${filterType}`;
    if (country) {
      url += `&country=${country}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      state.filteredImages = data.images;
      console.log(`✅ 獲取審核圖片成功，總數: ${state.filteredImages.length} (${filterType}, ${country || '全部'})`);
      
      // 調整當前索引
      if (state.filteredImages.length === 0) {
        // 沒有圖片了
        state.currentIndex = 0;
      } else if (state.currentIndex >= state.filteredImages.length) {
        // 如果索引超出範圍（例如：當前是第5張，但列表只剩3張），調整到最後一張
        state.currentIndex = Math.max(0, state.filteredImages.length - 1);
      }
      // 如果索引還在範圍內，保持不變（這樣當前的圖片被移除後，下一張會自動顯示）
      
      // 更新UI（會自動載入標籤並顯示）
      updateUI();
    } else {
      console.error('❌ 獲取審核圖片失敗:', data.error);
      showError(data.error || '獲取審核圖片失敗');
      state.filteredImages = [];
      updateUI();
    }
  } catch (error) {
    console.error('❌ 獲取審核圖片請求失敗:', error);
    showError(`獲取審核圖片失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    state.filteredImages = [];
    updateUI();
  } finally {
    showLoading(false);
  }
}

// 顯示審核標籤
async function displayReviewLabels(labels = null) {
  if (!elements.reviewLabels) return;
  
  const currentImage = state.filteredImages[state.currentIndex];
  if (!currentImage) {
    elements.reviewLabels.innerHTML = '<p class="empty-state">沒有圖片</p>';
    return;
  }
  
  // 如果沒有傳入 labels，從 state 獲取
  if (!labels) {
    // 如果標籤還沒有載入，先嘗試載入
    if (!state.labels[currentImage.id]) {
      labels = await loadCurrentImageLabels() || [];
    } else {
      labels = state.labels[currentImage.id] || [];
    }
    
    // 應用篩選
    if (state.reviewFilter === 'ai') {
      labels = labels.filter(l => !l.isManual && !l.reviewed);
    } else if (state.reviewFilter === 'manual') {
      labels = labels.filter(l => l.isManual && !l.reviewed);
    } else {
      // 如果沒有篩選，只顯示未審核的標籤
      labels = labels.filter(l => !l.reviewed);
    }
  }
  
  elements.reviewLabels.innerHTML = '';
  
  if (labels.length === 0) {
    elements.reviewLabels.innerHTML = '<p class="empty-state">沒有符合條件的標籤（可能需要載入標籤，請稍候...）</p>';
    if (elements.reviewCorrectBtn) elements.reviewCorrectBtn.style.display = 'none';
    if (elements.reviewDeleteBtn) elements.reviewDeleteBtn.style.display = 'none';
    
    // 如果標籤為空，嘗試重新載入
    if (!state.labels[currentImage.id]) {
      setTimeout(async () => {
        const loadedLabels = await loadCurrentImageLabels();
        if (loadedLabels && loadedLabels.length > 0) {
          await displayReviewLabels();
        }
      }, 500);
    }
    return;
  }
  
  labels.forEach(label => {
    const item = document.createElement('div');
    item.className = 'review-label-item';
    item.dataset.labelId = label.id;
    
    if (state.selectedLabelId === label.id) {
      item.classList.add('selected');
    }
    
    const confidencePercent = label.confidence ? (label.confidence * 100).toFixed(1) : '100';
    const source = label.isManual ? 'manual' : 'ai';
    const sourceText = label.isManual ? '✋ 手動標籤' : '🤖 AI 分類';
    
    item.innerHTML = `
      <div class="review-label-info">
        <div class="review-label-name">${label.label}</div>
        <div class="review-label-meta">
          <span class="source ${source}">${sourceText}</span>
          ${!label.isManual ? `<span class="confidence">置信度: ${confidencePercent}%</span>` : ''}
          ${label.reviewed ? '<span style="color: #28a745;">✓ 已審核</span>' : '<span style="color: #ffc107;">⏳ 待審核</span>'}
        </div>
      </div>
    `;
    
    // 點擊選擇標籤
    item.addEventListener('click', () => {
      // 取消之前的選擇
      document.querySelectorAll('.review-label-item').forEach(i => {
        i.classList.remove('selected');
      });
      
      // 選擇當前標籤
      item.classList.add('selected');
      state.selectedLabelId = label.id;
      
      // 顯示操作按鈕
      if (elements.reviewCorrectBtn) {
        elements.reviewCorrectBtn.style.display = label.reviewed ? 'none' : 'inline-block';
      }
      if (elements.reviewDeleteBtn) {
        elements.reviewDeleteBtn.style.display = 'inline-block';
      }
    });
    
    elements.reviewLabels.appendChild(item);
  });
}

// 標記標籤為已審核
async function markLabelAsReviewed() {
  if (!state.selectedLabelId) {
    alert('請先選擇一個標籤');
    return;
  }
  
  const currentImage = state.filteredImages[state.currentIndex];
  if (!currentImage) return;
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/images/${currentImage.id}/labels/${state.selectedLabelId}/review`, {
      method: 'PUT'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showSuccess('標籤已標記為已審核');
      
      // 清空選擇
      state.selectedLabelId = null;
      
      // 重新載入審核圖片列表（因為這張圖片已被標記為已審核，會從列表中移除）
      // applyReviewFilter 會自動調整索引並更新 UI
      // 如果當前圖片被移除，下一張會自動顯示（因為索引保持不變，列表已更新）
      await applyReviewFilter();
      
      // 檢查是否還有需要審核的圖片
      if (state.filteredImages.length === 0) {
        if (elements.reviewLabels) {
          elements.reviewLabels.innerHTML = '<p class="empty-state">✅ 所有圖片已審核完成！</p>';
        }
      }
    } else {
      showError(data.error || '操作失敗');
    }
  } catch (error) {
    console.error('標記審核失敗:', error);
    showError('標記審核失敗');
  } finally {
    showLoading(false);
  }
}

// 在審核模式下保存標籤（添加/更正標籤）
async function saveReviewLabel() {
  const currentImage = state.filteredImages[state.currentIndex];
  if (!currentImage) {
    alert('請先選擇一張圖片');
    return;
  }
  
  // 從選中的 radio button 獲取標籤
  const selectedRadio = document.querySelector('input[name="review-label"]:checked');
  if (!selectedRadio) {
    alert('請選擇一個標籤');
    return;
  }
  
  const label = selectedRadio.value;
  console.log(`💾 在審核模式下保存標籤: ${label} 到圖片 ${currentImage.id}`);
  
  try {
    showLoading(true);
    
    // 保存新標籤（手動標註，已審核）
    const response = await fetch(`${API_BASE}/api/images/${currentImage.id}/label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        label: label,
        isManual: true,
        confidence: 1.0
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '未知錯誤' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ 標籤保存成功:', data);
      
      // 如果之前選中了錯誤的標籤，自動刪除它（因為已經添加了正確的標籤）
      if (state.selectedLabelId) {
        try {
          // 直接刪除，不使用 deleteSelectedLabel 因為它會重新載入整個列表
          const deleteResponse = await fetch(`${API_BASE}/api/images/${currentImage.id}/labels/${state.selectedLabelId}`, {
            method: 'DELETE'
          });
          const deleteData = await deleteResponse.json();
          if (deleteData.success) {
            console.log('✅ 舊標籤已刪除');
          }
        } catch (error) {
          console.error('刪除舊標籤失敗:', error);
          // 即使刪除失敗，新標籤已經保存成功，所以繼續
        }
      }
      
      showSuccess('標籤已保存並標記為已審核');
      
      // 清空選擇
      if (selectedRadio) {
        selectedRadio.checked = false;
      }
      state.selectedLabelId = null;
      
      // 重新載入審核圖片列表（因為這張圖片已被標記為已審核，會從列表中移除）
      // applyReviewFilter 會自動調整索引並更新 UI
      // 如果當前圖片被移除，下一張會自動顯示（因為索引保持不變，列表已更新）
      await applyReviewFilter();
      
      // 更新統計
      await updateStats();
      
      // 檢查是否還有需要審核的圖片
      if (state.filteredImages.length === 0) {
        if (elements.reviewLabels) {
          elements.reviewLabels.innerHTML = '<p class="empty-state">✅ 所有圖片已審核完成！</p>';
        }
      }
    } else {
      console.error('❌ 保存失敗:', data.error);
      showError(data.error || '保存失敗');
    }
  } catch (error) {
    console.error('❌ 保存標籤失敗:', error);
    showError(`保存標籤失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
  } finally {
    showLoading(false);
  }
}

// 刪除選中的標籤
async function deleteSelectedLabel() {
  if (!state.selectedLabelId) {
    alert('請先選擇一個標籤');
    return;
  }
  
  if (!confirm('確定要刪除此標籤嗎？')) {
    return;
  }
  
  const currentImage = state.filteredImages[state.currentIndex];
  if (!currentImage) return;
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/images/${currentImage.id}/labels/${state.selectedLabelId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 重新載入標籤
      await loadCurrentImageLabels();
      await displayReviewLabels();
      
      // 更新統計
      await updateStats();
      
      // 隱藏按鈕
      if (elements.reviewDeleteBtn) elements.reviewDeleteBtn.style.display = 'none';
      if (elements.reviewCorrectBtn) elements.reviewCorrectBtn.style.display = 'none';
      state.selectedLabelId = null;
      
      showSuccess('標籤已刪除');
    } else {
      showError(data.error || '刪除失敗');
    }
  } catch (error) {
    console.error('刪除標籤失敗:', error);
    showError('刪除標籤失敗');
  } finally {
    showLoading(false);
  }
}

// 啟動應用 - 確保 DOM 已加載
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM 已經加載完成
  init();
}

