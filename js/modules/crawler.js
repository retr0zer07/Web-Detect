/**
 * crawler.js — Multi-page crawl module
 * Fetches sitemap or extracts internal links, then analyzes each page.
 */

const CRAWL_DELAY_MS = 1500;
const MAX_URLS = 20;

// Non-HTML extensions to skip
const SKIP_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|ico|css|js|json|xml|zip|gz|mp4|mp3|woff|woff2|ttf|eot)(\?.*)?$/i;

/**
 * Attempt to fetch a resource URL via a single CORS proxy with timeout.
 * @param {string} proxyUrl
 * @returns {Promise<string>}
 */
async function fetchViaProxy(proxyUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(proxyUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      return data.contents || data.body || '';
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try to fetch a URL using all available CORS proxies in cascade.
 * @param {string} url
 * @returns {Promise<string>} raw text content
 */
async function fetchCascade(url) {
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://thingproxy.freeboard.io/fetch/${url}`,
  ];
  for (const proxy of proxies) {
    try {
      const text = await fetchViaProxy(proxy);
      if (text && text.trim().length > 0) return text;
    } catch { /* try next */ }
  }
  throw new Error(`No se pudo obtener: ${url}`);
}

/**
 * Parse sitemap XML and extract all <loc> URLs.
 * Handles both sitemap index files and regular sitemaps.
 * @param {string} xml
 * @returns {string[]}
 */
export function parseSitemap(xml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    // Check parse errors
    if (doc.querySelector('parsererror')) return [];

    // Sitemap index: contains <sitemap><loc>
    const sitemapLocs = [...doc.querySelectorAll('sitemap > loc')];
    if (sitemapLocs.length > 0) {
      // Return the first index entry locs (we won't recurse here)
      return sitemapLocs.map(el => el.textContent.trim()).filter(Boolean);
    }

    // Regular sitemap: contains <url><loc>
    const urlLocs = [...doc.querySelectorAll('url > loc')];
    return urlLocs.map(el => el.textContent.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Extract internal links from a parsed DOM document.
 * Only returns same-origin hrefs that look like pages.
 * @param {Document} doc
 * @param {string} baseUrl
 * @returns {string[]}
 */
export function extractInternalLinks(doc, baseUrl) {
  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const seen = new Set();
  const links = [];

  doc.querySelectorAll('a[href]').forEach(a => {
    try {
      const href = a.getAttribute('href') || '';
      // Skip fragments, javascript:, mailto:, tel:
      if (href.startsWith('#') || href.startsWith('javascript:') ||
          href.startsWith('mailto:') || href.startsWith('tel:')) return;

      const resolved = new URL(href, baseUrl).href;

      // Must be same origin
      if (!resolved.startsWith(origin)) return;

      // Skip non-HTML extensions
      if (SKIP_EXTENSIONS.test(resolved)) return;

      // Strip fragment
      const clean = resolved.split('#')[0];
      if (!seen.has(clean)) {
        seen.add(clean);
        links.push(clean);
      }
    } catch { /* invalid URL */ }
  });

  return links;
}

/**
 * Attempt to fetch the sitemap for a given base URL.
 * Tries /sitemap.xml, /sitemap_index.xml, /page-sitemap.xml in order.
 * @param {string} baseUrl
 * @returns {Promise<string[]>} list of page URLs found in the sitemap
 */
export async function fetchSitemap(baseUrl) {
  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/page-sitemap.xml`,
    `${origin}/sitemap/`,
  ];

  for (const sitemapUrl of candidates) {
    try {
      const xml = await fetchCascade(sitemapUrl);
      if (xml && xml.includes('<loc>')) {
        const urls = parseSitemap(xml);
        if (urls.length > 0) return urls;
      }
    } catch { /* try next candidate */ }
  }

  return [];
}

/**
 * Filter and deduplicate a list of URLs:
 * - Remove duplicates
 * - Remove non-HTML resource URLs
 * - Cap at MAX_URLS
 * @param {string[]} urls
 * @returns {string[]}
 */
export function filterURLs(urls) {
  const seen = new Set();
  const result = [];
  for (const url of urls) {
    try {
      const clean = url.split('#')[0].trim();
      if (!clean) continue;
      new URL(clean); // validate
      if (SKIP_EXTENSIONS.test(clean)) continue;
      if (!seen.has(clean)) {
        seen.add(clean);
        result.push(clean);
      }
      if (result.length >= MAX_URLS) break;
    } catch { /* invalid */ }
  }
  return result;
}

/**
 * Crawl a list of page URLs, calling onProgress for each.
 * Delays 1.5s between requests to avoid proxy rate-limiting.
 * @param {string[]} urls
 * @param {function(index: number, total: number, url: string, result: object|null, error: string|null): void} onProgress
 * @param {function(url: string): Promise<object>} analyzeURL
 * @returns {Promise<Array<{url: string, result: object|null, error: string|null}>>}
 */
export async function crawlPages(urls, onProgress, analyzeURL) {
  const results = [];
  const total = Math.min(urls.length, MAX_URLS);

  for (let i = 0; i < total; i++) {
    const url = urls[i];
    onProgress(i, total, url, null, null);

    let result = null;
    let error = null;

    try {
      result = await analyzeURL(url);
    } catch (err) {
      error = err.message || 'Error desconocido';
    }

    results.push({ url, result, error });
    onProgress(i + 1, total, url, result, error);

    // Delay between pages (except after the last one)
    if (i < total - 1) {
      await new Promise(resolve => setTimeout(resolve, CRAWL_DELAY_MS));
    }
  }

  return results;
}
