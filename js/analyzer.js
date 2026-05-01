/**
 * analyzer.js — Core analysis engine
 * Fetches HTML via CORS proxy (cascade) and orchestrates all module calls.
 * Features: exponential backoff retries, slow connection detection.
 */

import { analyzeSEO } from './modules/seo.js';
import { analyzeKeywords } from './modules/keywords.js';
import { analyzeSchema } from './modules/schema.js';
import { analyzeStructure } from './modules/structure.js';
import { analyzePerformance } from './modules/performance.js';
import { analyzeSocial } from './modules/social.js';
import { analyzeGap } from './modules/gap.js';
import { analyzeMarketing } from './modules/marketing.js';

const PROXY_TIMEOUT_MS = 10000;
const SLOW_CONNECTION_MS = 8000;
const MAX_RETRIES = 3; // retries per proxy before moving to next
const MIN_HTML_LENGTH = 500; // minimum chars for valid HTML
const BASE_RETRY_DELAY_MS = 1000;
const RATE_LIMIT_EXTRA_DELAY_MS = 3000;

/**
 * Ordered list of CORS proxy factories.
 * Each returns a full fetch URL for a given target URL.
 */
const PROXIES = [
  { name: 'AllOrigins',   build: url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}` },
  { name: 'corsproxy.io', build: url => `https://corsproxy.io/?${encodeURIComponent(url)}` },
  { name: 'CodeTabs',     build: url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
  { name: 'Thingproxy',   build: url => `https://thingproxy.freeboard.io/fetch/${url}` },
];

// ── Error Classification ───────────────────────────────────────────────────────

/**
 * Classify an error and return a user-friendly message.
 * @param {Error} err
 * @returns {{ message: string, isRateLimit: boolean, isTimeout: boolean }}
 */
function classifyError(err) {
  const msg = (err.message || '').toLowerCase();
  const isTimeout = err.name === 'AbortError' || msg.includes('abort') || msg.includes('timeout') || msg.includes('time out');
  const isRateLimit = msg.includes('429') || msg.includes('rate') || msg.includes('too many');
  const isEmpty = msg.includes('vacía') || msg.includes('empty');

  let message;
  if (isTimeout) {
    message = 'La página tardó demasiado, reintentando...';
  } else if (isRateLimit) {
    message = 'Límite de solicitudes alcanzado, esperando...';
  } else if (isEmpty) {
    message = 'Respuesta vacía del proxy, reintentando...';
  } else {
    message = err.message || 'Error desconocido';
  }

  return { message, isRateLimit, isTimeout };
}

// ── Slow Connection Detector ───────────────────────────────────────────────────

let _slowConnectionCallback = null;

/**
 * Register a callback to be called when a proxy takes >8s.
 * @param {Function} cb
 */
export function onSlowConnection(cb) {
  _slowConnectionCallback = cb;
}

// ── Proxy Fetch with Retries ───────────────────────────────────────────────────

/**
 * Attempt to fetch HTML via a single proxy with timeout and retries.
 * Retries up to MAX_RETRIES times with exponential backoff (1s, 2s, 4s).
 * @param {{ name: string, build: function }} proxy
 * @param {string} url
 * @param {Function} [onRetry] - callback(attempt, maxRetries, message)
 * @returns {Promise<{ html: string, proxyName: string }>} 
 */
async function tryProxyWithRetries(proxy, url, onRetry = () => {}) {
  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const proxyURL = proxy.build(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    // Slow connection warning timer
    let slowTimer = null;
    if (_slowConnectionCallback) {
      slowTimer = setTimeout(() => {
        if (_slowConnectionCallback) _slowConnectionCallback();
      }, SLOW_CONNECTION_MS);
    }

    try {
      const response = await fetch(proxyURL, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let html;

      if (contentType.includes('application/json')) {
        const data = await response.json();
        html = data.contents || data.body || null;
      } else {
        html = await response.text();
      }

      if (!html || html.trim().length === 0) {
        throw new Error('Respuesta vacía del proxy');
      }
      if (html.trim().length < MIN_HTML_LENGTH || !html.includes('<html')) {
        throw new Error('HTML demasiado corto o inválido');
      }

      return { html, proxyName: proxy.name };
    } catch (err) {
      lastErr = err;
      const { message, isRateLimit } = classifyError(err);

      if (attempt < MAX_RETRIES) {
        onRetry(attempt, MAX_RETRIES, message);
        // Exponential backoff: 1s, 2s, 4s
        const delay = (isRateLimit ? RATE_LIMIT_EXTRA_DELAY_MS : 0) + (BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } finally {
      clearTimeout(timer);
      if (slowTimer) clearTimeout(slowTimer);
    }
  }

  throw lastErr;
}

/**
 * Tries each proxy in order (with per-proxy retries) until one succeeds.
 * Also retries with 'https://www.' prefix if all fail for the base URL.
 * @param {string} url
 * @param {Function} [onRetry] - callback(attempt, maxRetries, message)
 * @returns {Promise<{ html: string, proxyName: string }>}
 */
async function fetchHTMLCascade(url, onRetry = () => {}) {
  const urlsToTry = [url];

  // If it's https://domain.com (without www), also try https://www.domain.com
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.startsWith('www.')) {
      urlsToTry.push(`${parsed.protocol}//www.${parsed.hostname}${parsed.pathname}${parsed.search}`);
    }
  } catch { /* invalid URL, continue */ }

  const errors = [];

  for (const targetURL of urlsToTry) {
    for (const proxy of PROXIES) {
      try {
        return await tryProxyWithRetries(proxy, targetURL, onRetry);
      } catch (err) {
        errors.push(`[${proxy.name} → ${targetURL}]: ${err.message}`);
      }
    }
  }

  throw new Error(
    'No se pudo acceder al sitio. Puede estar bloqueando proxies externos. ' +
    'Intenta con otra URL.\n\nDetalles: ' + errors.slice(0, 4).join(' | ')
  );
}

/**
 * Parses an HTML string into a DOM Document
 * @param {string} html
 * @returns {Document}
 */
function parseHTML(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Main analysis orchestrator
 * @param {string} url - The URL to analyze
 * @param {Function} [onProgress] - Optional callback(step, percent)
 * @param {string[]} [targetKeywords] - Optional array of user-defined keywords for gap analysis
 * @param {Function} [onRetry] - Optional callback(attempt, maxRetries, message) for retry notifications
 * @returns {Promise<Object>} Full analysis results
 */
export async function analyzeURL(url, onProgress = () => {}, targetKeywords = [], onRetry = () => {}) {
  // Normalize URL: add https:// if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  onProgress('fetch', 5);

  let html, proxyUsed;

  try {
    ({ html, proxyName: proxyUsed } = await fetchHTMLCascade(url, onRetry));
  } catch (err) {
    throw new Error(err.message || 'No se pudo obtener el contenido de la página.');
  }

  onProgress('parse', 15);
  const doc = parseHTML(html);

  onProgress('seo', 25);
  const seo = analyzeSEO(doc, url);

  onProgress('keywords', 38);
  const keywords = analyzeKeywords(doc, url);

  onProgress('schema', 50);
  const schema = analyzeSchema(doc, url);

  onProgress('structure', 62);
  const structure = analyzeStructure(doc, url);

  onProgress('performance', 74);
  const performance = analyzePerformance(doc, url);

  onProgress('social', 84);
  const social = analyzeSocial(doc, url);

  onProgress('marketing', 91);
  const marketing = analyzeMarketing(doc, url);

  onProgress('gap', 97);
  const gap = targetKeywords.length > 0 ? analyzeGap(doc, url, targetKeywords) : null;

  onProgress('done', 100);

  return {
    url,
    analyzedAt: new Date().toISOString(),
    proxyUsed,
    fromCache: false,
    modules: { seo, keywords, schema, structure, performance, social, marketing },
    gap,
  };
}
