/**
 * analyzer.js — Core analysis engine
 * Fetches HTML via CORS proxy and orchestrates all module calls
 */

import { analyzeSEO } from './modules/seo.js';
import { analyzeKeywords } from './modules/keywords.js';
import { analyzeSchema } from './modules/schema.js';
import { analyzeStructure } from './modules/structure.js';
import { analyzePerformance } from './modules/performance.js';
import { analyzeSocial } from './modules/social.js';

const CORS_PROXY = 'https://api.allorigins.win/get?url=';
const TIMEOUT_MS = 15000;

/**
 * Fetches raw HTML for a URL via AllOrigins CORS proxy
 * @param {string} url
 * @returns {Promise<string>} HTML string
 */
async function fetchHTML(url) {
  const proxyURL = `${CORS_PROXY}${encodeURIComponent(url)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(proxyURL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (!data.contents) {
      throw new Error('El proxy no devolvió contenido. La URL puede estar bloqueada o ser inaccesible.');
    }
    return data.contents;
  } finally {
    clearTimeout(timer);
  }
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
 * @returns {Promise<Object>} Full analysis results
 */
export async function analyzeURL(url, onProgress = () => {}) {
  // Normalize URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  onProgress('fetch', 5);

  let html;
  try {
    html = await fetchHTML(url);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado (15s). La URL puede estar caída o bloqueando el proxy.');
    }
    throw new Error(`No se pudo obtener el contenido: ${err.message}`);
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

  onProgress('done', 100);

  return {
    url,
    analyzedAt: new Date().toISOString(),
    modules: { seo, keywords, schema, structure, performance, social },
  };
}
