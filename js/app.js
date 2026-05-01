/**
 * app.js — Main application orchestrator
 */

import { analyzeURL, onSlowConnection } from './analyzer.js';
import { generateHTML, generateReport, exportJSON, renderMultiPageReport } from './report.js';
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

// ── Theme ──────────────────────────────────────────────────────────────────────
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

// ── Progress ────────────────────────────────────────────────────────────────────
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

// ── Toast ───────────────────────────────────────────────────────────────────────
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

// ── Demo URLs ───────────────────────────────────────────────────────────────────
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
    script.onerror = () => reject(new Error('No se pudo cargar Tesseract.js'));
    document.head.appendChild(script);
  });
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

    // Show loader
    if (ocrLoader) ocrLoader.style.display = 'flex';
    imageUploadBtn.disabled = true;

    try {
      await loadTesseract();

      // Tesseract.js v5 exposes window.Tesseract
      const { data: { text } } = await window.Tesseract.recognize(file, 'spa+eng', {
        logger: () => {},
      });

      // Parse extracted text into keyword chips
      const cleaned = text.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9\s,.\-]/g, ' ');
      parseAndAddKeywords(cleaned);

      showToast('Texto extraído correctamente de la imagen', 'success');
    } catch (err) {
      showToast(`Error en OCR: ${err.message}`, 'error', 5000);
    } finally {
      if (ocrLoader) ocrLoader.style.display = 'none';
      imageUploadBtn.disabled = false;
      imageFileInput.value = '';
    }
  });
}

// ── Slow connection indicator ──────────────────────────────────────────────────
onSlowConnection(() => {
  if (slowConnectionBanner) slowConnectionBanner.style.display = 'flex';
});

// ── Analysis ────────────────────────────────────────────────────────────────────
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

// ── Multi-page Crawl ──────────────────────────────────────────────────────────

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

  const normalized = url.startsWith('http') ? url : `https://${url}`;

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
      try {
        const { analyzeURL: _analyzeURL } = await import('./analyzer.js');
        const result = await _analyzeURL(normalized);
        const parser = new DOMParser();
        const doc = parser.parseFromString(result._html || '', 'text/html');
        // We don't have the raw HTML via analyzeURL. Use a direct fetch via proxy instead.
      } catch { /* ignore */ }

      // Use cascade fetch to get the page HTML and extract links
      const allOrigins = `https://api.allorigins.win/get?url=${encodeURIComponent(normalized)}`;
      try {
        const resp = await fetch(allOrigins, { signal: AbortSignal.timeout(12000) });
        if (resp.ok) {
          const data = await resp.json();
          const html = data.contents || '';
          if (html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            urls = extractInternalLinks(doc, normalized);
          }
        }
      } catch { /* ignore fallback errors */ }
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
        return analyzeURL(url, () => {}, targetKeywords);
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

// ── Form submit ─────────────────────────────────────────────────────────────────
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

// ── Init ────────────────────────────────────────────────────────────────────────
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
