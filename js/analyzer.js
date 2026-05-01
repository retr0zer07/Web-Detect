/**
 * analyzer.js — Core analysis engine
 * Fetches HTML via CORS proxy (cascade) and orchestrates all module calls
 */

import { analyzeSEO } from './modules/seo.js';
import { analyzeKeywords } from './modules/keywords.js';
import { analyzeSchema } from './modules/schema.js';
import { analyzeStructure } from './modules/structure.js';
import { analyzePerformance } from './modules/performance.js';
import { analyzeSocial } from './modules/social.js';
import { analyzeGap } from './modules/gap.js';

const PROXY_TIMEOUT_MS = 10000;

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

/**
 * Attempt to fetch HTML via a single proxy with a timeout.
 * Returns { html, proxyName } on success, throws on failure.
 * @param {{ name: string, build: function }} proxy
 * @param {string} url
 * @returns {Promise<{ html: string, proxyName: string }>}
 */
async function tryProxy(proxy, url) {
  const proxyURL = proxy.build(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const response = await fetch(proxyURL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let html;

    if (contentType.includes('application/json')) {
      const data = await response.json();
      // AllOrigins-style: { contents: "..." }
      html = data.contents || data.body || null;
    } else {
      html = await response.text();
    }

    if (!html || html.trim().length === 0) {
      throw new Error('Respuesta vacía del proxy');
    }

    return { html, proxyName: proxy.name };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries each proxy in order until one succeeds.
 * Also retries with 'https://www.' prefix if all fail for the base URL.
 * @param {string} url
 * @returns {Promise<{ html: string, proxyName: string }>}
 */
async function fetchHTMLCascade(url) {
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
        return await tryProxy(proxy, targetURL);
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
 * @returns {Promise<Object>} Full analysis results
 */
export async function analyzeURL(url, onProgress = () => {}, targetKeywords = []) {
  // Normalize URL: add https:// if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  onProgress('fetch', 5);

  let html, proxyUsed;
  try {
    ({ html, proxyName: proxyUsed } = await fetchHTMLCascade(url));
  } catch (err) {
    throw new Error(err.message || 'No se pudo obtener el contenido de la página.');
  }

  onProgress('parse', 15);
  const doc = parseHTML(html);

  onProgress('seo', 25);
  const seo = analyzeSEO(doc, url);

  onProgress('keywords', 40);
  const keywords = analyzeKeywords(doc, url);

  onProgress('schema', 55);
  const schema = analyzeSchema(doc, url);

  onProgress('structure', 68);
  const structure = analyzeStructure(doc, url);

  onProgress('performance', 80);
  const performance = analyzePerformance(doc, url);

  onProgress('social', 92);
  const social = analyzeSocial(doc, url);

  onProgress('gap', 97);
  const gap = targetKeywords.length > 0 ? analyzeGap(doc, url, targetKeywords) : null;

  onProgress('done', 100);

  return {
    url,
    analyzedAt: new Date().toISOString(),
    proxyUsed,
    modules: { seo, keywords, schema, structure, performance, social },
    gap,
  };
}
