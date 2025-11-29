// API 基礎 URL
const API_BASE = window.location.origin;

// 狀態管理
let state = {
  images: [],
  filteredImages: [],
  currentIndex: 0,
  countries: [],
  selectedCountry: 'all',
  labels: {}, // imageId -> labels
  mode: 'labeling', // 'labeling' 或 'review'
  reviewFilter: 'ai', // 'ai', 'manual', 'all'
  selectedLabelId: null // 審核模式下選中的標籤ID
};

// DOM 元素
const elements = {
  countriesList: document.getElementById('countries-list'),
  totalCount: document.getElementById('total-count'),
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
  reviewAddLabelBtn: document.getElementById('review-add-label-btn')
};

// 初始化
async function init() {
  await loadCountries();
  await loadImages();
  setupEventListeners();
  await updateStats(); // 載入統計數據
  updateUI();
}

// 載入國家列表
async function loadCountries() {
  try {
    const response = await fetch(`${API_BASE}/api/countries`);
    const data = await response.json();
    
    if (data.success) {
      state.countries = data.countries;
      
      // 更新國家列表 UI
      data.countries.forEach(country => {
        const btn = document.createElement('button');
        btn.className = 'country-btn';
        btn.dataset.country = country.name;
        btn.textContent = `${country.name} (${country.count})`;
        btn.addEventListener('click', () => filterByCountry(country.name));
        elements.countriesList.appendChild(btn);
      });
      
      // 更新標籤單選按鈕組
      updateLabelRadioGroup(data.countries);
      
      // 更新總數
      const total = data.countries.reduce((sum, c) => sum + c.count, 0);
      elements.totalCount.textContent = total;
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

// 載入圖片列表
async function loadImages() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/images`);
    const data = await response.json();
    
    if (data.success) {
      state.images = data.images;
      state.filteredImages = data.images;
      state.currentIndex = 0;
      updateUI();
    }
  } catch (error) {
    console.error('載入圖片失敗:', error);
    showError('載入圖片失敗');
  } finally {
    showLoading(false);
  }
}

// 按國家篩選
function filterByCountry(country) {
  console.log('篩選國家:', country);
  state.selectedCountry = country;
  
  // 更新按鈕狀態
  document.querySelectorAll('.country-btn').forEach(btn => {
    const btnCountry = btn.dataset.country;
    btn.classList.toggle('active', btnCountry === country);
  });
  
  // 篩選圖片
  let filtered = [];
  if (country === 'all') {
    filtered = state.images;
  } else {
    filtered = state.images.filter(img => img.country === country);
  }
  
  // 如果處於審核模式，應用審核篩選
  // 注意：審核篩選是同步的，使用已載入的標籤數據
  // 如果需要完整篩選，應使用 applyReviewFilter()
  
  state.filteredImages = filtered;
  console.log(`顯示圖片，總數:`, state.filteredImages.length);
  
  state.currentIndex = 0;
  updateUI();
}

// 根據審核條件篩選圖片
function filterImagesByReview(images) {
  if (state.reviewFilter === 'all') {
    return images;
  }
  
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
    elements.currentImage.src = '';
    elements.imageFilename.textContent = '沒有圖片';
    elements.imageCountry.textContent = '';
    elements.currentIndex.textContent = '0';
    elements.totalImages.textContent = '0';
    return;
  }
  
  // 更新圖片（添加錯誤處理）
  elements.currentImage.onerror = function() {
    console.error('❌ 圖片加載失敗:', currentImage.url);
    console.error('圖片信息:', {
      id: currentImage.id,
      country: currentImage.country,
      filename: currentImage.filename,
      url: currentImage.url
    });
    // 保持灰色占位符，顯示錯誤信息
    showError(`圖片加載失敗: ${currentImage.filename}`);
  };
  
  elements.currentImage.onload = function() {
    console.log('✅ 圖片加載成功:', currentImage.url);
    // 確保加載完成後隱藏 overlay
    showLoading(false);
  };
  
  // 設置圖片源
  console.log('🔄 加載圖片:', currentImage.url);
  // 圖片開始加載時顯示 loading（可選）
  // showLoading(true);
  elements.currentImage.src = currentImage.url;
  elements.imageFilename.textContent = currentImage.filename;
  elements.imageCountry.textContent = `國家: ${currentImage.country}`;
  
  // 更新計數器
  elements.currentIndex.textContent = state.currentIndex + 1;
  elements.totalImages.textContent = state.filteredImages.length;
  
  // 更新按鈕狀態
  elements.prevBtn.disabled = state.currentIndex === 0;
  elements.nextBtn.disabled = state.currentIndex === state.filteredImages.length - 1;
  
  // 載入當前圖片的標籤
  loadCurrentImageLabels();
  
  // 清空預測結果
  clearPredictions();
  
  // 根據模式更新UI
  if (state.mode === 'review') {
    displayReviewLabels();
  }
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
      displayLabels(data.labels);
    }
  } catch (error) {
    console.error('載入標籤失敗:', error);
  }
}

// 顯示標籤
function displayLabels(labels) {
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
async function saveLabel() {
  const currentImage = state.filteredImages[state.currentIndex];
  const selectedRadio = document.querySelector('input[name="label"]:checked');
  
  if (!currentImage || !selectedRadio) {
    alert('請選擇標籤');
    return;
  }
  
  const label = selectedRadio.value;
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/images/${currentImage.id}/label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        label: label,
        isManual: true
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 重新載入標籤
      await loadCurrentImageLabels();
      
      // 更新統計（異步更新）
      await updateStats();
      
      // 清空選擇
      selectedRadio.checked = false;
      
      showSuccess('標籤已保存');
    } else {
      showError(data.error || '保存失敗');
    }
  } catch (error) {
    console.error('保存標籤失敗:', error);
    showError('保存標籤失敗');
  } finally {
    showLoading(false);
  }
}

// AI 分類
async function classifyImage() {
  const currentImage = state.filteredImages[state.currentIndex];
  if (!currentImage) return;
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/images/${currentImage.id}/classify`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      displayPredictions(data.predictions);
    } else {
      showError(data.error || '分類失敗');
    }
  } catch (error) {
    console.error('分類失敗:', error);
    showError('分類失敗');
  } finally {
    showLoading(false);
  }
}

// 顯示預測結果
function displayPredictions(predictions) {
  elements.predictions.innerHTML = '';
  
  if (!predictions || predictions.length === 0) {
    elements.predictions.innerHTML = '<p class="empty-state">無預測結果</p>';
    return;
  }
  
  // 按置信度排序
  predictions.sort((a, b) => b.confidence - a.confidence);
  
  predictions.forEach(pred => {
    const item = document.createElement('div');
    item.className = 'prediction-item';
    
    const confidencePercent = (pred.confidence * 100).toFixed(1);
    
    item.innerHTML = `
      <div style="flex: 1;">
        <div class="prediction-label">${pred.label}</div>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
        </div>
      </div>
      <div class="prediction-confidence">${confidencePercent}%</div>
    `;
    
    elements.predictions.appendChild(item);
  });
}

// 清空預測結果
function clearPredictions() {
  elements.predictions.innerHTML = '<p class="empty-state">點擊「AI 分類」查看預測結果</p>';
}

// 更新統計
async function updateStats() {
  try {
    // 從 API 獲取真實統計數據
    const response = await fetch(`${API_BASE}/api/stats/labels`);
    const data = await response.json();
    
    if (data.success) {
      const stats = data.stats;
      elements.labeledCount.textContent = stats.totalLabeled || 0;
      
      // 計算未標註數量 = 總圖片數 - 已標註數
      const totalImages = state.images.length;
      const unlabeled = totalImages - (stats.totalLabeled || 0);
      elements.unlabeledCount.textContent = unlabeled;
    }
  } catch (error) {
    console.error('獲取統計失敗:', error);
    // 如果 API 失敗，使用本地計算（作為備用）
    const labeled = Object.keys(state.labels).length;
    const total = state.images.length;
    elements.labeledCount.textContent = labeled;
    elements.unlabeledCount.textContent = total - labeled;
  }
}

// 事件監聽器設置
function setupEventListeners() {
  // 為「全部」按鈕添加點擊事件
  const allBtn = document.querySelector('.country-btn[data-country="all"]');
  if (allBtn) {
    allBtn.addEventListener('click', () => filterByCountry('all'));
  }
  
  elements.prevBtn.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      updateUI();
    }
  });
  
  elements.nextBtn.addEventListener('click', () => {
    if (state.currentIndex < state.filteredImages.length - 1) {
      state.currentIndex++;
      updateUI();
    }
  });
  
  elements.saveLabelBtn.addEventListener('click', saveLabel);
  elements.classifyBtn.addEventListener('click', classifyImage);
  
  // 模式切換
  if (elements.labelingModeBtn) {
    elements.labelingModeBtn.addEventListener('click', () => switchMode('labeling'));
  }
  if (elements.reviewModeBtn) {
    elements.reviewModeBtn.addEventListener('click', () => switchMode('review'));
  }
  
  // 審核篩選按鈕
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filter = e.target.dataset.filter;
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
    elements.reviewAddLabelBtn.addEventListener('click', () => {
      switchMode('labeling');
      // 觸發添加標籤流程
    });
  }
  
  // 鍵盤快捷鍵
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      elements.prevBtn.click();
    } else if (e.key === 'ArrowRight') {
      elements.nextBtn.click();
    }
  });
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
    displayReviewLabels();
    applyReviewFilter();
  } else {
    updateUI();
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
  applyReviewFilter();
}

// 應用審核篩選
async function applyReviewFilter() {
  // 重新篩選圖片列表
  let filtered = [];
  if (state.selectedCountry === 'all') {
    filtered = state.images;
  } else {
    filtered = state.images.filter(img => img.country === state.selectedCountry);
  }
  
  filtered = await filterImagesByReview(filtered);
  state.filteredImages = filtered;
  
  // 調整當前索引（確保不超出範圍）
  if (state.currentIndex >= state.filteredImages.length) {
    state.currentIndex = Math.max(0, state.filteredImages.length - 1);
  }
  
  // 更新UI
  updateUI();
  
  // 顯示審核標籤
  if (state.mode === 'review') {
    displayReviewLabels();
  }
}

// 顯示審核標籤
function displayReviewLabels(labels = null) {
  if (!elements.reviewLabels) return;
  
  const currentImage = state.filteredImages[state.currentIndex];
  if (!currentImage) {
    elements.reviewLabels.innerHTML = '<p class="empty-state">沒有圖片</p>';
    return;
  }
  
  // 如果沒有傳入 labels，從 state 獲取
  if (!labels) {
    labels = state.labels[currentImage.id] || [];
    
    // 應用篩選
    if (state.reviewFilter === 'ai') {
      labels = labels.filter(l => !l.isManual);
    } else if (state.reviewFilter === 'manual') {
      labels = labels.filter(l => l.isManual);
    }
  }
  
  elements.reviewLabels.innerHTML = '';
  
  if (labels.length === 0) {
    elements.reviewLabels.innerHTML = '<p class="empty-state">沒有符合條件的標籤</p>';
    if (elements.reviewCorrectBtn) elements.reviewCorrectBtn.style.display = 'none';
    if (elements.reviewDeleteBtn) elements.reviewDeleteBtn.style.display = 'none';
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
      // 重新載入標籤
      await loadCurrentImageLabels();
      displayReviewLabels();
      
      // 隱藏按鈕
      if (elements.reviewCorrectBtn) elements.reviewCorrectBtn.style.display = 'none';
      state.selectedLabelId = null;
      
      showSuccess('標籤已標記為已審核');
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
      displayReviewLabels();
      
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

// 啟動應用
init();

