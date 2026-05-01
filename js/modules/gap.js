/**
 * gap.js — Keyword Gap Analysis module
 * Checks how well user-defined target keywords are present on the analyzed page.
 */

/** Number of keyword occurrences that triggers a "keyword stuffing" warning */
const KEYWORD_STUFFING_THRESHOLD = 15;

/**
 * Minimal HTML escaping for values embedded in recommendation HTML strings.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Split body text into first-N-words and rest.
 * @param {string} text
 * @param {number} limit
 * @returns {{ first: string, rest: string }}
 */
function splitBody(text, limit = 200) {
  const words = text.trim().split(/\s+/);
  return {
    first: words.slice(0, limit).join(' '),
    rest: words.slice(limit).join(' '),
  };
}

/**
 * Count case-insensitive occurrences of a keyword in a text string.
 * @param {string} text
 * @param {string} keyword
 * @returns {number}
 */
function countOccurrences(text, keyword) {
  if (!text || !keyword) return 0;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'gi');
  return (text.match(re) || []).length;
}

/**
 * Check presence of a keyword in text (case-insensitive).
 * @param {string} text
 * @param {string} keyword
 * @returns {boolean}
 */
function contains(text, keyword) {
  return countOccurrences(text, keyword) > 0;
}

/**
 * Analyse a single keyword across the page's content zones.
 * @param {string} keyword
 * @param {{ title, description, h1, h2h3, altTexts, bodyFirst, bodyRest, pageURL }} zones
 * @returns {Object} per-keyword result
 */
function analyzeKeyword(keyword, zones) {
  const kw = keyword.toLowerCase();

  // Presence flags
  const inTitle       = contains(zones.title, kw);
  const inDescription = contains(zones.description, kw);
  const inH1          = contains(zones.h1, kw);
  const inH2H3        = contains(zones.h2h3, kw);
  const inAlt         = contains(zones.altTexts, kw);
  const inBodyFirst   = contains(zones.bodyFirst, kw);
  const inBodyRest    = contains(zones.bodyRest, kw);
  const inURL         = contains(zones.pageURL, kw);

  // Total occurrences across the whole page
  const fullText = [zones.title, zones.description, zones.h1, zones.h2h3,
                    zones.altTexts, zones.bodyFirst, zones.bodyRest].join(' ');
  const totalCount = countOccurrences(fullText, kw);

  // High-weight locations (⭐⭐⭐)
  const highWeightPresences = [inTitle, inDescription, inH1, inURL].filter(Boolean).length;

  // Classify status
  let status;
  if (totalCount > KEYWORD_STUFFING_THRESHOLD) {
    status = 'stuffing'; // 🔥
  } else if (highWeightPresences >= 3) {
    status = 'good';     // ✅
  } else if (totalCount === 0) {
    status = 'absent';   // ❌
  } else {
    status = 'improvable'; // ⚠️
  }

  // Build specific recommendations
  const recommendations = [];
  const kwSafe = escHtml(keyword);
  const titleSafe = escHtml(zones.title || '(vacío)');

  if (!inTitle && status !== 'stuffing') {
    recommendations.push({
      field: 'title',
      text: `Agrega <strong>${kwSafe}</strong> al &lt;title&gt; — actualmente es: "${titleSafe}"`,
    });
  }
  if (!inDescription && status !== 'stuffing') {
    recommendations.push({
      field: 'description',
      text: `Incluye <strong>${kwSafe}</strong> en el &lt;meta description&gt;${zones.description ? '' : ' — actualmente no existe'}`,
    });
  }
  if (!inH1 && status !== 'stuffing') {
    recommendations.push({
      field: 'h1',
      text: `Usa <strong>${kwSafe}</strong> en el &lt;h1&gt; principal`,
    });
  }
  if (!inH2H3 && status !== 'stuffing') {
    recommendations.push({
      field: 'h2h3',
      text: `Usa <strong>${kwSafe}</strong> en al menos un &lt;h2&gt; o &lt;h3&gt;`,
    });
  }
  if (!inBodyFirst && status !== 'stuffing') {
    recommendations.push({
      field: 'body',
      text: `Menciona <strong>${kwSafe}</strong> en los primeros párrafos del contenido`,
    });
  }
  if (!inAlt && status !== 'stuffing') {
    recommendations.push({
      field: 'alt',
      text: `Agrega <strong>${kwSafe}</strong> en el atributo alt de alguna imagen relevante`,
    });
  }
  if (inURL) {
    recommendations.unshift({
      field: 'url',
      text: `✅ Ventaja: <strong>${kwSafe}</strong> aparece en la URL`,
    });
  }
  if (status === 'stuffing') {
    recommendations.push({
      field: 'stuffing',
      text: `⚠️ <strong>${kwSafe}</strong> aparece ${totalCount} veces — considera reducir la repetición para evitar penalizaciones`,
    });
  }

  // Compute a per-keyword score (0-100)
  let score = 0;
  if (inTitle)       score += 20;
  if (inDescription) score += 20;
  if (inH1)          score += 20;
  if (inURL)         score += 15;
  if (inH2H3)        score += 10;
  if (inAlt)         score += 8;
  if (inBodyFirst)   score += 7;
  score = Math.min(score, 100);
  if (status === 'stuffing') score = Math.max(score - 20, 0);

  return {
    keyword,
    status,
    score,
    totalCount,
    presence: { inTitle, inDescription, inH1, inH2H3, inAlt, inBodyFirst, inBodyRest, inURL },
    recommendations,
  };
}

/**
 * Main gap analysis function.
 * @param {Document} doc - Parsed DOM document
 * @param {string} pageURL - The analyzed URL
 * @param {string[]} targetKeywords - User-defined target keywords
 * @returns {Object} Gap analysis results
 */
export function analyzeGap(doc, pageURL, targetKeywords) {
  if (!targetKeywords || targetKeywords.length === 0) {
    return null;
  }

  // Extract text zones from DOM
  const title       = doc.querySelector('title')?.textContent?.trim() || '';
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
  const h1          = Array.from(doc.querySelectorAll('h1')).map(el => el.textContent).join(' ').trim();
  const h2h3        = Array.from(doc.querySelectorAll('h2,h3')).map(el => el.textContent).join(' ').trim();
  const altTexts    = Array.from(doc.querySelectorAll('img[alt]')).map(el => el.getAttribute('alt')).join(' ');

  // Body text (remove script/style content)
  const bodyClone = doc.body ? doc.body.cloneNode(true) : doc.createElement('body');
  bodyClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  const fullBodyText = bodyClone.textContent || '';
  const { first: bodyFirst, rest: bodyRest } = splitBody(fullBodyText, 200);

  const zones = {
    title,
    description,
    h1,
    h2h3,
    altTexts,
    bodyFirst,
    bodyRest,
    pageURL: pageURL.toLowerCase(),
  };

  // Analyse each keyword
  const keywordResults = targetKeywords.map(kw => analyzeKeyword(kw.trim(), zones));

  // Overall score: average of individual scores
  const avgScore = keywordResults.length
    ? Math.round(keywordResults.reduce((acc, r) => acc + r.score, 0) / keywordResults.length)
    : 0;

  // Summary counts
  const summary = {
    good:       keywordResults.filter(r => r.status === 'good').length,
    improvable: keywordResults.filter(r => r.status === 'improvable').length,
    absent:     keywordResults.filter(r => r.status === 'absent').length,
    stuffing:   keywordResults.filter(r => r.status === 'stuffing').length,
  };

  return {
    score: avgScore,
    summary,
    keywords: keywordResults,
    zones: { title, description, h1Count: doc.querySelectorAll('h1').length },
  };
}
