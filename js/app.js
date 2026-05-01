/**
 * app.js — Main application orchestrator
 */

import { analyzeURL } from './analyzer.js';
import { generateHTML, generateReport, exportJSON } from './report.js';

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

// ── State ─────────────────────────────────────────────────────────────────────
let currentReport = null;
let isAnalyzing = false;
/** @type {string[]} */
let targetKeywords = [];

const STEPS = [
  { key: 'fetch',       label: '🌐 Obteniendo HTML' },
  { key: 'parse',       label: '🔧 Parseando DOM' },
  { key: 'seo',         label: '🔍 SEO On-Page' },
  { key: 'keywords',    label: '🔑 Keywords' },
  { key: 'schema',      label: '📊 Schema' },
  { key: 'structure',   label: '🏗️ Estructura' },
  { key: 'performance', label: '⚡ Performance' },
  { key: 'social',      label: '📱 Social' },
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

// ── Analysis ────────────────────────────────────────────────────────────────────
async function runAnalysis(url) {
  if (isAnalyzing) return;
  isAnalyzing = true;

  // Show progress, hide results
  progressSection.classList.add('visible');
  resultsSection.classList.remove('visible');
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<span class="spinner"></span> Analizando...';

  initProgressSteps();
  updateProgress('fetch', 0);

  try {
    const results = await analyzeURL(url, (step, percent) => {
      updateProgress(step, percent);
    }, targetKeywords);

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

    const proxyMsg = results.proxyUsed ? ` · vía ${results.proxyUsed}` : '';
    showToast(`Análisis completado: ${report.meta.overallScore}/100${proxyMsg}`, 'success');

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
