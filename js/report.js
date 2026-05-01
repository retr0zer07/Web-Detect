/**
 * report.js — Report generation, export, and DOM rendering
 */

// Module weights for overall score
const MODULE_WEIGHTS = {
  seo: 0.30,
  keywords: 0.20,
  schema: 0.15,
  structure: 0.15,
  performance: 0.12,
  social: 0.08,
};

const STATUS_EMOJI = {
  good: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
};

const STATUS_LABEL = {
  good: 'Bueno',
  warning: 'Advertencia',
  error: 'Error',
  info: 'Info',
};

/**
 * Calculate weighted overall score
 */
export function calculateOverallScore(modules) {
  let total = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(MODULE_WEIGHTS)) {
    if (modules[key]) {
      total += modules[key].score * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? Math.round(total / totalWeight) : 0;
}

/**
 * Get score color based on value
 */
export function getScoreColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}

/**
 * Get score label
 */
function getScoreLabel(score) {
  if (score >= 80) return '🌟 Excelente';
  if (score >= 60) return '👍 Bueno';
  if (score >= 40) return '⚠️ Mejorable';
  return '❌ Necesita trabajo';
}

/**
 * Generate full report object
 */
export function generateReport(results) {
  const overallScore = calculateOverallScore(results.modules);
  return {
    meta: {
      url: results.url,
      analyzedAt: results.analyzedAt,
      overallScore,
      label: getScoreLabel(overallScore),
    },
    modules: results.modules,
  };
}

/**
 * Export report as JSON file download
 */
export function exportJSON(report) {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `seo-report-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Collect all error/warning checks sorted by severity
 */
function getPriorityIssues(modules, limit = 5) {
  const issues = [];
  for (const [, mod] of Object.entries(modules)) {
    for (const check of (mod.checks || [])) {
      if (check.status === 'error' || check.status === 'warning') {
        issues.push({
          module: mod.name,
          icon: mod.icon,
          ...check,
          priority: check.status === 'error' ? 0 : 1,
        });
      }
    }
  }
  issues.sort((a, b) => a.priority - b.priority);
  return issues.slice(0, limit);
}

/**
 * Escape HTML to prevent XSS
 */
function esc(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render a list of checks into HTML
 */
function renderChecks(checks) {
  if (!checks || checks.length === 0) return '<p class="text-muted">Sin datos disponibles.</p>';
  return `<div class="checks-list">
    ${checks.map(check => `
      <div class="check-item ${esc(check.status)}">
        <span class="check-badge">${STATUS_EMOJI[check.status] || 'ℹ️'}</span>
        <div class="check-content">
          <div class="check-title">${esc(check.title)}</div>
          ${check.description ? `<div class="check-description">${esc(check.description)}</div>` : ''}
          ${check.value ? `<div class="check-value">${esc(check.value)}</div>` : ''}
        </div>
        <span class="badge badge-${esc(check.status)}">${STATUS_LABEL[check.status] || check.status}</span>
      </div>
    `).join('')}
  </div>`;
}

/**
 * Render keyword cloud
 */
function renderKeywordCloud(topKeywords) {
  if (!topKeywords || topKeywords.length === 0) return '';
  const max = topKeywords[0].count;
  return `
    <div class="collapsible-header" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
      🌐 Nube de palabras clave
      <span class="collapsible-arrow">▼</span>
    </div>
    <div class="collapsible-body">
      <div class="keyword-cloud">
        ${topKeywords.map(kw => {
          const size = 0.75 + (kw.count / max) * 0.85;
          return `<span class="keyword-tag" style="font-size:${size.toFixed(2)}rem" title="${esc(kw.count + ' ocurrencias')}">${esc(kw.word)} <small>(${kw.count})</small></span>`;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Render JSON-LD data
 */
function renderJsonLd(jsonLdData) {
  if (!jsonLdData || jsonLdData.length === 0) return '';
  return `
    <div class="collapsible-header" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
      📋 JSON-LD encontrado (${jsonLdData.length} bloque${jsonLdData.length !== 1 ? 's' : ''})
      <span class="collapsible-arrow">▼</span>
    </div>
    <div class="collapsible-body">
      ${jsonLdData.map(item => `
        <div class="schema-card">
          <h4>@type: ${esc(Array.isArray(item.type) ? item.type.join(', ') : String(item.type))}</h4>
          <pre>${esc(JSON.stringify(item.raw, null, 2))}</pre>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render stats grid
 */
function renderStats(stats) {
  if (!stats) return '';
  const entries = Object.entries(stats);
  if (entries.length === 0) return '';
  const labels = {
    totalImages: '🖼️ Imágenes',
    totalLinks: '🔗 Links',
    semanticTagsPresent: '🏷️ Tags semánticos',
    domDepth: '🌲 Profundidad DOM',
    textRatio: '📝 Ratio texto/HTML',
    blockingScripts: '🚫 Scripts bloqueantes',
    externalScripts: '📜 Scripts externos',
    externalCSS: '🎨 CSS externos',
    lazyImages: '💤 Lazy images',
    preloads: '⏩ Preloads',
    preconnects: '🔌 Preconnects',
    totalWords: '📖 Palabras',
    ogScore: '🌐 OG Score',
    twitterScore: '🐦 Twitter Score',
  };
  return `
    <div class="stats-grid">
      ${entries.map(([k, v]) => `
        <div class="stat-card">
          <span class="stat-value">${typeof v === 'number' ? v : esc(String(v))}</span>
          <span class="stat-label">${labels[k] || esc(k)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render score bar color
 */
function scoreBarColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}

/**
 * Main render function — writes everything to the DOM
 */
export function generateHTML(results, container) {
  const report = generateReport(results);
  const { overallScore, url, analyzedAt, label } = report.meta;
  const { modules } = results;

  // Gauge circumference for r=54: C = 2πr ≈ 339.29
  const circumference = 339.29;
  const offset = circumference - (overallScore / 100) * circumference;
  const gaugeColor = getScoreColor(overallScore);
  const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  // Score breakdowns
  const scoreBreakdown = Object.entries(MODULE_WEIGHTS).map(([key, weight]) => {
    const mod = modules[key];
    if (!mod) return '';
    const s = mod.score;
    const color = scoreBarColor(s);
    return `<span class="score-module-badge">
      <span class="badge-dot" style="background:${color}"></span>
      ${mod.icon} ${mod.name}: <strong>${s}</strong>
    </span>`;
  }).join('');

  // Priority issues
  const priorityIssues = getPriorityIssues(modules);
  const priorityHTML = priorityIssues.length === 0
    ? '<p class="text-good fw-600">✅ No se encontraron problemas críticos.</p>'
    : `<div class="priority-list">
        ${priorityIssues.map((issue, i) => `
          <div class="priority-item">
            <div class="priority-number">${i + 1}</div>
            <div class="priority-content">
              <strong>${issue.icon} [${esc(issue.module)}] ${esc(issue.title)}</strong>
              <p>${esc(issue.description || '')}</p>
            </div>
            <span class="badge badge-${esc(issue.status)}">${STATUS_EMOJI[issue.status]} ${STATUS_LABEL[issue.status]}</span>
          </div>
        `).join('')}
      </div>`;

  // Tab definitions
  const tabs = [
    {
      key: 'seo',
      label: `${modules.seo?.icon || '🔍'} SEO`,
      extra: '',
    },
    {
      key: 'keywords',
      label: `${modules.keywords?.icon || '🔑'} Keywords`,
      extra: renderKeywordCloud(modules.keywords?.topKeywords),
    },
    {
      key: 'schema',
      label: `${modules.schema?.icon || '📊'} Schema`,
      extra: renderJsonLd(modules.schema?.jsonLdData),
    },
    {
      key: 'structure',
      label: `${modules.structure?.icon || '🏗️'} Estructura`,
      extra: renderStats(modules.structure?.stats),
    },
    {
      key: 'performance',
      label: `${modules.performance?.icon || '⚡'} Performance`,
      extra: renderStats(modules.performance?.stats),
    },
    {
      key: 'social',
      label: `${modules.social?.icon || '📱'} Social`,
      extra: '',
    },
  ];

  const tabsNav = tabs.map((t, i) => {
    const mod = modules[t.key];
    const s = mod?.score ?? 0;
    const color = scoreBarColor(s);
    return `<button class="tab-btn ${i === 0 ? 'active' : ''}" data-tab="${t.key}">
      ${t.label} <span class="tab-score-badge" style="color:${color};background:${color}20">${s}</span>
    </button>`;
  }).join('');

  const tabsPanes = tabs.map((t, i) => {
    const mod = modules[t.key];
    if (!mod) return '';
    const s = mod.score;
    const color = scoreBarColor(s);
    const summary = mod.summary || {};
    return `
      <div class="tab-pane ${i === 0 ? 'active' : ''}" id="tab-${t.key}">
        <div class="module-header">
          <div class="module-title">${mod.icon} ${esc(mod.name)}</div>
          <div class="module-score">
            <div class="module-score-bar">
              <div class="module-score-fill" style="width:${s}%;background:${color}"></div>
            </div>
            <span class="module-score-text" style="color:${color}">${s}/100</span>
          </div>
        </div>
        <p class="text-muted" style="font-size:0.8rem;margin-bottom:1rem">
          ✅ ${summary.good || 0} bueno &nbsp;⚠️ ${summary.warnings || 0} advertencias &nbsp;❌ ${summary.errors || 0} errores
        </p>
        ${t.extra}
        ${renderChecks(mod.checks)}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <!-- Score Overview -->
    <div class="score-overview">
      <div class="score-gauge-container">
        <svg class="score-gauge-svg" viewBox="0 0 120 120">
          <circle class="score-gauge-bg" cx="60" cy="60" r="54"/>
          <circle class="score-gauge-fill"
            cx="60" cy="60" r="54"
            stroke="${gaugeColor}"
            style="stroke-dashoffset:${offset.toFixed(2)}"
          />
        </svg>
        <div class="score-number">
          <span class="score-value">${overallScore}</span>
          <span class="score-label">/100</span>
        </div>
      </div>
      <div class="score-details">
        <h2>${label}</h2>
        <p>Análisis de <strong>${esc(domain)}</strong> · ${new Date(analyzedAt).toLocaleString('es-ES')}</p>
        <div class="score-breakdown">${scoreBreakdown}</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="results-actions">
      <button class="btn-secondary" id="exportBtn">📥 Exportar JSON</button>
      <button class="btn-secondary" id="newAnalysisBtn">🔄 Nuevo análisis</button>
    </div>

    <!-- Module Tabs -->
    <div class="tabs-wrapper">
      <nav class="tabs-nav" role="tablist">${tabsNav}</nav>
      ${tabsPanes}
    </div>

    <!-- Priority Recommendations -->
    <div class="recommendations-section">
      <div class="recommendations-title">🎯 Recomendaciones Prioritarias</div>
      ${priorityHTML}
    </div>
  `;

  // Animate gauge
  requestAnimationFrame(() => {
    const gaugeFill = container.querySelector('.score-gauge-fill');
    if (gaugeFill) {
      gaugeFill.style.strokeDashoffset = offset.toFixed(2);
    }
  });

  // Tab switching
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = container.querySelector(`#tab-${btn.dataset.tab}`);
      if (pane) pane.classList.add('active');
    });
  });

  return report;
}
