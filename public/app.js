// API 基礎 URL
const API_BASE = window.location.origin;

// 狀態管理
let state = {
  images: [],
  filteredImages: [],
  currentIndex: 0,
  countries: [],
  selectedCountry: 'all',
  labels: {} // imageId -> labels
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
  saveLabelBtn: document.getElementById('save-label-btn'),
  currentLabels: document.getElementById('current-labels'),
  predictions: document.getElementById('predictions'),
  loading: document.getElementById('loading')
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
      
      // 更新標籤選擇器
      updateLabelSelect(data.countries);
      
      // 更新總數
      const total = data.countries.reduce((sum, c) => sum + c.count, 0);
      elements.totalCount.textContent = total;
    }
  } catch (error) {
    console.error('載入國家列表失敗:', error);
    showError('載入國家列表失敗');
  }
}

// 更新標籤選擇器
function updateLabelSelect(countries) {
  elements.labelSelect.innerHTML = '<option value="">選擇標籤...</option>';
  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country.name;
    option.textContent = country.name;
    elements.labelSelect.appendChild(option);
  });
  // 注意：「其他」選項已經在 API 返回的國家列表中包含了，不需要再次添加
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
  if (country === 'all') {
    state.filteredImages = state.images;
    console.log('顯示所有圖片，總數:', state.filteredImages.length);
  } else {
    state.filteredImages = state.images.filter(img => img.country === country);
    console.log(`顯示 ${country} 的圖片，總數:`, state.filteredImages.length);
  }
  
  state.currentIndex = 0;
  updateUI();
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
    tag.className = `label-tag ${label.isManual ? 'manual' : 'ai'}`;
    tag.textContent = label.label;
    elements.currentLabels.appendChild(tag);
  });
}

// 保存標籤
async function saveLabel() {
  const currentImage = state.filteredImages[state.currentIndex];
  const label = elements.labelSelect.value;
  
  if (!currentImage || !label) {
    alert('請選擇標籤');
    return;
  }
  
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
      elements.labelSelect.value = '';
      
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

// 啟動應用
init();

