/**
 * app.js — Main application orchestrator
 */

import { analyzeURL, onSlowConnection } from './analyzer.js';
import { generateHTML, generateReport, exportJSON, exportTXT, renderMultiPageReport } from './report.js';
import { fetchSitemap, extractInternalLinks, filterURLs, crawlPages } from './modules/crawler.js';

// ── DOM Elements ─────────────────────────────────────────────────────────────
const form = document.getElementById('analyzeForm');
const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressSteps = document.getElementById('progressSteps');
const resultsSection = document.getElementById('resultsSection');
const resultsContainer = document.getElementById('resultsContainer');
const themeToggle = document.getElementById('themeToggle');
const toastContainer = document.getElementById('toastContainer');

// ── Keywords panel elements ────────────────────────────────────────────────────
const keywordInput   = document.getElementById('keywordInput');
const keywordChips   = document.getElementById('keywordChips');
const clearKeywords  = document.getElementById('clearKeywords');
const imageUploadBtn = document.getElementById('imageUploadBtn');
const imageFileInput = document.getElementById('imageFileInput');
const ocrLoader      = document.getElementById('ocrLoader');
const ocrLoaderText  = document.getElementById('ocrLoaderText');
const ocrReviewPanel = document.getElementById('ocrReviewPanel');
const ocrTextArea    = document.getElementById('ocrTextArea');
const ocrApplyBtn    = document.getElementById('ocrApplyBtn');
const ocrClearBtn    = document.getElementById('ocrClearBtn');

// ── Multi-page Crawl elements ──────────────────────────────────────────────────
const crawlToggle        = document.getElementById('crawlToggle');
const crawlPanel         = document.getElementById('crawlPanel');
const crawlPageList      = document.getElementById('crawlPageList');
const crawlMaxSlider     = document.getElementById('crawlMaxSlider');
const crawlMaxLabel      = document.getElementById('crawlMaxLabel');
const crawlStartBtn      = document.getElementById('crawlStartBtn');
const crawlFetchBtn      = document.getElementById('crawlFetchBtn');
const crawlProgress      = document.getElementById('crawlProgress');
const crawlProgressText  = document.getElementById('crawlProgressText');
const crawlResultsSection = document.getElementById('crawlResultsSection');
const crawlResultsContainer = document.getElementById('crawlResultsContainer');
const slowConnectionBanner = document.getElementById('slowConnectionBanner');

// ── State ─────────────────────────────────────────────────────────────────────
let currentReport = null;
let isAnalyzing = false;
let isCrawling = false;
/** @type {string[]} */
let targetKeywords = [];
/** @type {string[]} */
let crawlPageURLs = [];

const STEPS = [
  { key: 'fetch',       label: '🌐 Obteniendo HTML' },
  { key: 'parse',       label: '🔧 Parseando DOM' },
  { key: 'seo',         label: '🔍 SEO On-Page' },
  { key: 'keywords',    label: '🔑 Keywords' },
  { key: 'schema',      label: '📊 Schema' },
  { key: 'structure',   label: '🏗️ Estructura' },
  { key: 'performance', label: '⚡ Performance' },
  { key: 'social',      label: '📱 Social' },
  { key: 'marketing',   label: '📈 Marketing' },
  { key: 'gap',         label: '🎯 Gap Analysis' },
  { key: 'done',        label: '✅ Completado' },
];

// ── Theme ─────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('seo-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('seo-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro';
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── URL Validation ─────────────────────────────────────────────────────────────
function isValidURL(str) {
  try {
    const url = str.startsWith('http') ? str : `https://${str}`;
    const parsed = new URL(url);
    return parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

// ── Progress ───────────────────────────────────────────────────────────────────
function initProgressSteps() {
  const visibleSteps = targetKeywords.length > 0
    ? STEPS
    : STEPS.filter(s => s.key !== 'gap');
  progressSteps.innerHTML = visibleSteps.map(s => `
    <span class="progress-step" data-step="${s.key}">${s.label}</span>
  `).join('');
}

function updateProgress(step, percent) {
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;

  const stepIndex = STEPS.findIndex(s => s.key === step);
  STEPS.forEach((s, i) => {
    const el = progressSteps.querySelector(`[data-step="${s.key}"]`);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < stepIndex) el.classList.add('done');
    else if (i === stepIndex) el.classList.add('active');
  });
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info', duration = 3000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ── Demo URLs ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.demo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    urlInput.value = btn.dataset.url;
    urlInput.focus();
  });
});

// ── Keywords Panel ─────────────────────────────────────────────────────────────

/**
 * Save targetKeywords to localStorage
 */
function saveKeywords() {
  try {
    localStorage.setItem('seo-target-keywords', JSON.stringify(targetKeywords));
  } catch { /* storage unavailable */ }
}

/**
 * Load keywords from localStorage
 */
function loadKeywords() {
  try {
    const stored = localStorage.getItem('seo-target-keywords');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        parsed.forEach(kw => addKeywordChip(kw));
      }
    }
  } catch { /* ignore */ }
}

/**
 * Add a keyword chip to the panel if not already present.
 * @param {string} kw
 */
function addKeywordChip(kw) {
  const normalized = kw.trim();
  if (!normalized) return;
  if (targetKeywords.some(k => k.toLowerCase() === normalized.toLowerCase())) return;

  targetKeywords.push(normalized);

  const chip = document.createElement('span');
  chip.className = 'kw-chip';
  chip.dataset.keyword = normalized;
  chip.innerHTML = `<span class="kw-chip-text">${escHtml(normalized)}</span><button class="kw-chip-remove" aria-label="Eliminar ${escHtml(normalized)}">×</button>`;
  chip.querySelector('.kw-chip-remove').addEventListener('click', () => {
    targetKeywords = targetKeywords.filter(k => k !== normalized);
    chip.remove();
    saveKeywords();
  });

  keywordChips.appendChild(chip);
  saveKeywords();
}

/**
 * Parse a raw text string and add each segment as a chip.
 * Splits on commas, semicolons, and newlines.
 * @param {string} text
 */
function parseAndAddKeywords(text) {
  text.split(/[,;\n]+/).forEach(part => addKeywordChip(part.trim()));
}

/**
 * Filter OCR output to a clean list of keywords.
 * Goal: keep only text-like keyword lines and ignore icons/table noise.
 * @param {string} text
 * @returns {string}
 */
function filterOCRTextToKeywords(text) {
  const raw = String(text || '')
    // common table icons
    .replace(/[★☆▼▶►◀◄▪●•◆◇✓✔✗✘❌✅⚠️ℹ️]/g, ' ')
    .replace(/\t/g, ' ');

  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();

  for (let line of lines) {
    // remove common leading bullets
    line = line.replace(/^[-–—•·\u2022\u25CF\u25A0\u25AA\u25E6\u2219]+\s*/g, '');

    // ignore table boilerplate
    const upper = line.toUpperCase().replace(/\s+/g, '');
    if (upper === 'NR' || upper === 'N/A' || upper === 'NA') continue;

    // keep only keyword-ish characters
    line = line.replace(/[^0-9a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s\-'.&/+,]/g, ' ');
    line = line.replace(/\s+/g, ' ').trim();

    if (!line) continue;
    if (line.length < 4) continue;

    // avoid noisy lines: require minimum letter ratio
    const letters = (line.match(/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g) || []).length;
    const ratio = letters / Math.max(line.length, 1);
    if (ratio < 0.35) continue;

    // ignore pure numbers
    if (/^[0-9\s]+$/.test(line)) continue;

    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }

  return out.join('\n');
}

// Keyword text input — add on Enter or comma
if (keywordInput) {
  keywordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = keywordInput.value.replace(/,$/, '').trim();
      if (val) {
        addKeywordChip(val);
        keywordInput.value = '';
      }
    }
  });

  keywordInput.addEventListener('blur', () => {
    const val = keywordInput.value.trim();
    if (val) {
      addKeywordChip(val);
      keywordInput.value = '';
    }
  });
}

// Clear all keywords
if (clearKeywords) {
  clearKeywords.addEventListener('click', () => {
    targetKeywords = [];
    keywordChips.innerHTML = '';
    saveKeywords();
  });
}

// ── OCR — Image Upload with Tesseract.js (lazy-loaded) ────────────────────────

const OCR_TIMEOUT_MS = 60_000;
/** Luminance threshold for grayscale→binary conversion (ITU-R BT.601). */
const OCR_GRAYSCALE_THRESHOLD = 140;

let tesseractLoaded = false;

/**
 * Dynamically load Tesseract.js from CDN (only once).
 * @returns {Promise<void>}
 */
function loadTesseract() {
  if (tesseractLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => { tesseractLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('No se pudo cargar Tesseract.js desde CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Pre-process an image file for better OCR accuracy:
 * scale ×2, convert to grayscale, apply contrast threshold.
 * @param {File} file
 * @returns {Promise<string>} data URL of the processed image
 */
function preprocessImageForOCR(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectURL = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth  * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext('2d');

        // Draw scaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to grayscale + threshold
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const THRESHOLD = OCR_GRAYSCALE_THRESHOLD;
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = lum < THRESHOLD ? 0 : 255;
          data[i] = data[i + 1] = data[i + 2] = val;
          // alpha unchanged
        }
        ctx.putImageData(imageData, 0, 0);

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectURL);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error('No se pudo cargar la imagen para preprocesado'));
    };
    img.src = objectURL;
  });
}

/**
 * Update the OCR loader text to show progress.
 * @param {string} status - Tesseract status string
 * @param {number} progress - 0–1
 */
function updateOCRProgress(status, progress) {
  if (!ocrLoaderText) return;
  const pct = Math.round((progress || 0) * 100);
  const labels = {
    loading_tesseract_core: 'Cargando motor',
    initializing_tesseract: 'Iniciando motor',
    initialized_tesseract: 'Motor listo',
    loading_language_traineddata: 'Cargando idioma',
    loaded_language_traineddata: 'Idioma cargado',
    initializing_api: 'Iniciando API',
    recognizing_text: 'Reconociendo texto',
  };
  const label = labels[status] || status || 'Procesando';
  ocrLoaderText.textContent = `OCR: ${pct}% (${label})`;
}

/** Hide OCR review panel and clear textarea. */
function resetOCRPanel() {
  if (ocrReviewPanel) ocrReviewPanel.style.display = 'none';
  if (ocrTextArea) ocrTextArea.value = '';
}

if (imageUploadBtn && imageFileInput) {
  imageUploadBtn.addEventListener('click', () => imageFileInput.click());

  imageFileInput.addEventListener('change', async () => {
    const file = imageFileInput.files[0];
    if (!file) return;

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Formato no soportado. Usa JPG, PNG o WEBP.', 'error');
      return;
    }

    resetOCRPanel();

    // Show loader
    if (ocrLoader) ocrLoader.style.display = 'flex';
    if (ocrLoaderText) ocrLoaderText.textContent = 'Cargando OCR...';
    imageUploadBtn.disabled = true;

    try {
      await loadTesseract();

      if (!window.Tesseract) {
        throw new Error('Tesseract.js no está disponible. Recarga la página e inténtalo de nuevo.');
      }

      // Pre-process image for better accuracy
      if (ocrLoaderText) ocrLoaderText.textContent = 'Preprocesando imagen...';
      const processedDataURL = await preprocessImageForOCR(file);

      // Run OCR with progress logging and a 60 s timeout
      let timeoutId;
      let recognitionDone = false;
      timeoutId = setTimeout(() => {
        if (!recognitionDone) {
          showToast('El OCR tardó demasiado (>60 s). Intenta con una imagen más pequeña.', 'error', 6000);
        }
      }, OCR_TIMEOUT_MS);

      try {
        const { data: { text } } = await window.Tesseract.recognize(processedDataURL, 'spa+eng', {
          logger: ({ status, progress }) => updateOCRProgress(status, progress),
        });

        recognitionDone = true;

        if (!text || !text.trim()) {
          showToast('No se detectó texto en la imagen. Prueba con otra imagen.', 'warning', 4000);
          return;
        }

        // Show review panel with extracted text — do NOT add keywords yet
        if (ocrTextArea) ocrTextArea.value = text.trim();
        if (ocrReviewPanel) ocrReviewPanel.style.display = 'flex';
        showToast('Texto extraído. Revísalo y pulsa "Usar texto para keywords".', 'success', 4000);
      } finally {
        recognitionDone = true;
        clearTimeout(timeoutId);
      }
    } catch (err) {
      showToast(`Error en OCR: ${err.message}`, 'error', 6000);
    } finally {
      if (ocrLoader) ocrLoader.style.display = 'none';
      imageUploadBtn.disabled = false;
      imageFileInput.value = '';
    }
  });
}

// OCR Apply button — parse textarea text into keyword chips
if (ocrApplyBtn) {
  ocrApplyBtn.addEventListener('click', () => {
    const text = ocrTextArea ? ocrTextArea.value : '';
    if (!text.trim()) {
      showToast('El área de texto está vacía. Primero carga una imagen.', 'warning');
      return;
    }

    const filtered = filterOCRTextToKeywords(text);
    if (!filtered.trim()) {
      showToast('No se detectaron keywords válidas. Recorta solo la columna "Palabra clave".', 'warning', 5000);
      return;
    }

    // show cleaned output briefly (helps debugging)
    if (ocrTextArea) ocrTextArea.value = filtered;

    parseAndAddKeywords(filtered);
    resetOCRPanel();
    showToast('Keywords añadidas correctamente.', 'success');
  });
}

// OCR Clear button — reset panel
if (ocrClearBtn) {
  ocrClearBtn.addEventListener('click', () => {
    resetOCRPanel();
  });
}

// ── Slow connection indicator ──────────────────────────────────────────────────
onSlowConnection(() => {
  if (slowConnectionBanner) slowConnectionBanner.style.display = 'flex';
});

// ── Analysis ───────────────────────────────────────────────────────────────────
async function runAnalysis(url) {
  if (isAnalyzing) return;
  isAnalyzing = true;

  // Hide slow connection banner
  if (slowConnectionBanner) slowConnectionBanner.style.display = 'none';

  // Show progress, hide results
  progressSection.classList.add('visible');
  resultsSection.classList.remove('visible');
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<span class="spinner"></span> Analizando...';

  initProgressSteps();
  updateProgress('fetch', 0);

  try {
    const results = await analyzeURL(
      url,
      (step, percent) => { updateProgress(step, percent); },
      targetKeywords,
      (attempt, maxRetries, message) => {
        showToast(`⚠️ ${message} (intento ${attempt}/${maxRetries})`, 'warning', 2500);
      }
    );

    // Hide slow connection banner on success
    if (slowConnectionBanner) slowConnectionBanner.style.display = 'none';

    // Render results
    const report = generateHTML(results, resultsContainer);
    currentReport = report;

    // Save to localStorage
    try {
      localStorage.setItem('seo-last-result', JSON.stringify({
        url: results.url,
        analyzedAt: results.analyzedAt,
        score: report.meta.overallScore,
      }));
    } catch { /* storage full or unavailable */ }

    // Show results
    progressSection.classList.remove('visible');
    resultsSection.classList.add('visible');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const cacheMsg = results.fromCache ? ' · ⚡ caché' : '';
    const proxyMsg = (results.proxyUsed && results.proxyUsed !== 'cache') ? ` · vía ${results.proxyUsed}` : '';
    showToast(`Análisis completado: ${report.meta.overallScore}/100${proxyMsg}${cacheMsg}`, 'success');

    // Bind export & new analysis buttons (created by generateHTML)
    const exportBtn = document.getElementById('exportBtn');
    const newAnalysisBtn = document.getElementById('newAnalysisBtn');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportJSON(currentReport);
        showToast('Reporte exportado como JSON', 'success');
      });
    }

    const exportTxtBtn = document.getElementById('exportTxtBtn');
    if (exportTxtBtn) {
      exportTxtBtn.addEventListener('click', () => {
        exportTXT(currentReport);
        showToast('Reporte TXT exportado correctamente', 'success');
      });
    }

    if (newAnalysisBtn) {
      newAnalysisBtn.addEventListener('click', () => {
        resultsSection.classList.remove('visible');
        urlInput.value = '';
        urlInput.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  } catch (err) {
    if (slowConnectionBanner) slowConnectionBanner.style.display = 'none';
    progressSection.classList.remove('visible');
    const errMsg = err.message
      ? escHtml(err.message)
      : 'Error desconocido. Por favor, intenta con otra URL.';
    resultsContainer.innerHTML = `
      <div class="error-state">
        <div class="error-icon">😢</div>
        <h3>No se pudo analizar la URL</h3>
        <p>${errMsg}</p>
      </div>
    `;
    resultsSection.classList.add('visible');
    showToast(`Error: ${err.message?.slice(0, 60) || 'Error al analizar'}`, 'error', 5000);
  } finally {
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '🔍 Analizar';
  }
}

// ── Multi-page Crawl ───────────────────────────────────────────────────────────

// Toggle crawl panel
if (crawlToggle && crawlPanel) {
  crawlToggle.addEventListener('click', () => {
    const isOpen = crawlPanel.style.display !== 'none';
    crawlPanel.style.display = isOpen ? 'none' : 'block';
    crawlToggle.setAttribute('aria-expanded', String(!isOpen));
    crawlToggle.classList.toggle('crawl-toggle-active', !isOpen);
  });
}

// Update slider label
if (crawlMaxSlider && crawlMaxLabel) {
  crawlMaxSlider.addEventListener('input', () => {
    crawlMaxLabel.textContent = crawlMaxSlider.value;
  });
}

/**
 * Render checkbox list of discovered URLs
 */
function renderCrawlPageList(urls) {
  if (!crawlPageList) return;
  if (urls.length === 0) {
    crawlPageList.innerHTML = '<p class="text-muted" style="font-size:0.8rem">No se encontraron subpáginas.</p>';
    return;
  }

  crawlPageList.innerHTML = `
    <div class="crawl-select-all-row">
      <label class="crawl-checkbox-label">
        <input type="checkbox" id="crawlSelectAll" checked>
        <span>Seleccionar todas (${urls.length})</span>
      </label>
    </div>
    ${urls.map((url, i) => {
      let path;
      try { path = new URL(url).pathname || '/'; } catch { path = url; }
      return `
        <label class="crawl-checkbox-label">
          <input type="checkbox" class="crawl-page-cb" value="${escHtml(url)}" checked>
          <span class="crawl-page-path" title="${escHtml(url)}">${escHtml(path)}</span>
        </label>
      `;
    }).join('')}
  `;

  // Select all logic
  const selectAll = crawlPageList.querySelector('#crawlSelectAll');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      crawlPageList.querySelectorAll('.crawl-page-cb').forEach(cb => {
        cb.checked = selectAll.checked;
      });
    });
  }
}

/**
 * Fetch sitemap or extract links for the entered URL
 */
async function fetchCrawlPages() {
  const url = urlInput.value.trim();
  if (!url || !isValidURL(url)) {
    showToast('Primero ingresa una URL válida en el campo de arriba', 'warning');
    return;
  }

  const normalized = (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url}`;

  if (crawlFetchBtn) {
    crawlFetchBtn.disabled = true;
    crawlFetchBtn.innerHTML = '<span class="spinner spinner-dark"></span> Buscando...';
  }
  if (crawlPageList) crawlPageList.innerHTML = '<p class="text-muted" style="font-size:0.8rem">Buscando subpáginas...</p>';

  try {
    // Try sitemap first
    let urls = await fetchSitemap(normalized);

    // Fallback to internal links from the main page
    if (urls.length === 0) {
      showToast('Sin sitemap. Extrayendo links internos...', 'info', 2500);

      // Use cascade fetch to get the page HTML and extract links
      const proxiesToTry = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(normalized)}`,
        `https://corsproxy.io/?${encodeURIComponent(normalized)}`,
      ];

      for (const proxyUrl of proxiesToTry) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);
          let resp;
          try {
            resp = await fetch(proxyUrl, { signal: controller.signal });
          } finally {
            clearTimeout(timer);
          }
          if (resp.ok) {
            const ct = resp.headers.get('content-type') || '';
            let html;
            if (ct.includes('application/json')) {
              const data = await resp.json();
              html = data.contents || data.body || '';
            } else {
              html = await resp.text();
            }
            if (html && html.includes('<')) {
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');
              urls = extractInternalLinks(doc, normalized);
              if (urls.length > 0) break;
            }
          }
        } catch { /* try next proxy */ }
      }
    }

    crawlPageURLs = filterURLs(urls);

    if (crawlPageURLs.length === 0) {
      showToast('No se encontraron subpáginas para rastrear', 'warning');
      if (crawlPageList) crawlPageList.innerHTML = '<p class="text-muted" style="font-size:0.8rem">No se encontraron subpáginas. Verifica la URL o prueba con una página diferente.</p>';
    } else {
      showToast(`${crawlPageURLs.length} subpáginas encontradas`, 'success');
      renderCrawlPageList(crawlPageURLs);
    }
  } catch (err) {
    showToast(`Error al buscar subpáginas: ${err.message?.slice(0, 50)}`, 'error', 4000);
    if (crawlPageList) crawlPageList.innerHTML = `<p class="text-muted" style="font-size:0.8rem">Error: ${escHtml(err.message?.slice(0, 80) || 'Error desconocido')}</p>`;
  } finally {
    if (crawlFetchBtn) {
      crawlFetchBtn.disabled = false;
      crawlFetchBtn.innerHTML = '🔍 Buscar subpáginas';
    }
  }
}

if (crawlFetchBtn) {
  crawlFetchBtn.addEventListener('click', fetchCrawlPages);
}

/**
 * Start the multi-page crawl
 */
async function startCrawl() {
  if (isCrawling) return;

  // Get selected URLs
  const checked = crawlPageList
    ? [...crawlPageList.querySelectorAll('.crawl-page-cb:checked')].map(cb => cb.value)
    : [];

  if (checked.length === 0) {
    showToast('Selecciona al menos una página para analizar', 'warning');
    return;
  }

  const maxPages = crawlMaxSlider ? parseInt(crawlMaxSlider.value, 10) : 5;
  const selectedURLs = checked.slice(0, maxPages);

  isCrawling = true;
  if (crawlStartBtn) {
    crawlStartBtn.disabled = true;
    crawlStartBtn.innerHTML = '<span class="spinner spinner-dark"></span> Analizando...';
  }
  if (crawlProgress) crawlProgress.style.display = 'block';
  if (crawlResultsSection) crawlResultsSection.style.display = 'none';

  try {
    const crawlResults = await crawlPages(
      selectedURLs,
      (index, total, url, result, error) => {
        if (crawlProgressText) {
          let path;
          try { path = new URL(url).pathname || '/'; } catch { path = url; }
          crawlProgressText.textContent = index < total
            ? `Analizando página ${index + 1} de ${total}: ${path}`
            : `✅ Análisis completado (${total} páginas)`;
        }
        if (crawlProgress) {
          const bar = crawlProgress.querySelector('.crawl-progress-bar');
          if (bar) bar.style.width = `${Math.round((index / total) * 100)}%`;
        }
      },
      async (url) => {
        return analyzeURL(url, () => {}, targetKeywords, (attempt, maxRetries, message) => {
          showToast(`⚠️ ${message} (intento ${attempt}/${maxRetries})`, 'warning', 2000);
        });
      }
    );

    // Show results
    if (crawlResultsSection && crawlResultsContainer) {
      crawlResultsSection.style.display = 'block';
      renderMultiPageReport(crawlResults, crawlResultsContainer);
      crawlResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const successCount = crawlResults.filter(r => r.result).length;
    showToast(`Crawl completado: ${successCount}/${crawlResults.length} páginas analizadas`, 'success');
  } catch (err) {
    showToast(`Error en crawl: ${err.message?.slice(0, 60)}`, 'error', 5000);
  } finally {
    isCrawling = false;
    if (crawlStartBtn) {
      crawlStartBtn.disabled = false;
      crawlStartBtn.innerHTML = '▶️ Iniciar análisis';
    }
  }
}

if (crawlStartBtn) {
  crawlStartBtn.addEventListener('click', startCrawl);
}

// ── Form submit ─────────────────────────────────��──────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();

  if (!url) {
    showToast('Por favor ingresa una URL', 'warning');
    urlInput.focus();
    return;
  }

  if (!isValidURL(url)) {
    showToast('URL no válida. Ej: https://ejemplo.com', 'error');
    urlInput.focus();
    return;
  }

  await runAnalysis(url);
});

// ── Init ───────────────────────────────────────────────────────────────────────
initTheme();
loadKeywords();

// Show last analyzed URL hint
const lastResult = (() => {
  try { return JSON.parse(localStorage.getItem('seo-last-result')); } catch { return null; }
})();

if (lastResult?.url) {
  const hint = document.getElementById('lastAnalysisHint');
  if (hint) {
    hint.textContent = `Último análisis: ${lastResult.url} (${lastResult.score}/100)`;
    hint.style.display = 'block';
  }
}
