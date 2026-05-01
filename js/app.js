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

// ── State ─────────────────────────────────────────────────────────────────────
let currentReport = null;
let isAnalyzing = false;

const STEPS = [
  { key: 'fetch', label: '🌐 Obteniendo HTML' },
  { key: 'parse', label: '🔧 Parseando DOM' },
  { key: 'seo', label: '🔍 SEO On-Page' },
  { key: 'keywords', label: '🔑 Keywords' },
  { key: 'schema', label: '📊 Schema' },
  { key: 'structure', label: '🏗️ Estructura' },
  { key: 'performance', label: '⚡ Performance' },
  { key: 'social', label: '📱 Social' },
  { key: 'done', label: '✅ Completado' },
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
  progressSteps.innerHTML = STEPS.map(s => `
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
function showToast(message, type = 'info', duration = 3000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
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
    });

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

    showToast(`Análisis completado: ${report.meta.overallScore}/100`, 'success');

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
    resultsContainer.innerHTML = `
      <div class="error-state">
        <div class="error-icon">😢</div>
        <h3>No se pudo analizar la URL</h3>
        <p>${err.message || 'Error desconocido. Por favor, intenta con otra URL.'}</p>
        <p class="text-muted" style="margin-top:0.5rem;font-size:0.8rem">
          Nota: Algunas páginas bloquean el acceso desde proxies CORS. Intenta con URLs públicas como wikipedia.org, github.com, etc.
        </p>
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
