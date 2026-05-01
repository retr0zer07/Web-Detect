/**
 * keywords.js — Keyword frequency and density analysis
 */

const STOPWORDS = new Set([
  // Spanish
  'de','la','el','en','y','a','que','los','del','se','las','por','un','con',
  'una','su','para','es','al','lo','como','más','pero','sus','le','ya','o',
  'este','sí','porque','esta','entre','cuando','muy','sin','sobre','ser','tiene',
  'también','me','hasta','hay','donde','quien','desde','todo','nos','durante',
  'todos','uno','les','ni','contra','otros','ese','eso','ante','ellos','e',
  'esto','mí','antes','algunos','qué','unos','yo','otro','otras','otra','él',
  'tanto','esa','estos','mucho','quienes','nada','muchos','cual','poco','ella',
  'estar','haber','si','mi','he','tu','te','no','fue','está','son','dos','ha',
  'han','era','más','así','siendo','sido',
  // English
  'the','be','to','of','and','a','in','that','have','it','for','not','on',
  'with','he','as','you','do','at','this','but','his','by','from','they',
  'we','say','her','she','or','an','will','my','one','all','would','there',
  'their','what','so','up','out','if','about','who','get','which','go','me',
  'when','make','can','like','time','no','just','him','know','take','people',
  'into','year','your','good','some','could','them','see','other','than','then',
  'now','look','only','come','its','over','think','also','back','after','use',
  'two','how','our','work','first','well','way','even','new','want','because',
  'any','these','give','day','most','us','is','are','was','were','been','has',
  'had','did','does','said','each','she','which','do','their','if','will',
]);

/**
 * Extract visible text from body, excluding nav/footer/scripts/styles
 */
function extractVisibleText(doc) {
  const body = doc.body;
  if (!body) return '';

  const clone = body.cloneNode(true);
  // Remove non-content elements
  ['script', 'style', 'nav', 'footer', 'noscript', 'iframe', 'head'].forEach(tag => {
    clone.querySelectorAll(tag).forEach(el => el.remove());
  });

  return clone.textContent || '';
}

/**
 * Tokenize text into words
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\sáéíóúüñàèìòùâêîôû]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Get top N keywords by frequency
 */
function getTopKeywords(words, n = 10) {
  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}

export function analyzeKeywords(doc, url) {
  const checks = [];
  let score = 0;

  const text = extractVisibleText(doc);
  const allWords = tokenize(text);
  const totalWords = allWords.length;

  // Stats
  checks.push({
    id: 'total-words',
    status: 'info',
    title: 'Total de palabras en el contenido',
    description: `${totalWords} palabras encontradas en el cuerpo de la página.`,
    value: `${totalWords} palabras`,
  });

  if (totalWords < 300) {
    checks.push({
      id: 'thin-content',
      status: 'error',
      title: 'Contenido escaso (thin content)',
      description: 'Menos de 300 palabras. Google puede considerarlo contenido de baja calidad.',
    });
  } else if (totalWords < 600) {
    score += 8;
    checks.push({
      id: 'content-length-ok',
      status: 'warning',
      title: 'Contenido por debajo de lo recomendado',
      description: `${totalWords} palabras. Se recomienda al menos 600 para artículos informativos.`,
    });
  } else {
    score += 15;
    checks.push({
      id: 'content-length-good',
      status: 'good',
      title: 'Longitud de contenido adecuada',
      description: `${totalWords} palabras. Buen volumen de contenido para indexación.`,
    });
  }

  // Top keywords
  const topKeywords = getTopKeywords(allWords, 10);

  if (topKeywords.length === 0) {
    checks.push({
      id: 'no-keywords',
      status: 'error',
      title: 'Sin texto significativo detectado',
      description: 'No se encontraron palabras clave relevantes en el contenido.',
    });
  } else {
    score += 10;
    const topWord = topKeywords[0];
    const density = totalWords > 0 ? ((topWord.count / totalWords) * 100).toFixed(2) : 0;

    checks.push({
      id: 'top-keyword',
      status: 'info',
      title: `Palabra clave principal: "${topWord.word}"`,
      description: `Aparece ${topWord.count} veces (${density}% del contenido).`,
      value: topKeywords.slice(0, 5).map(k => `${k.word} (${k.count})`).join(', '),
    });

    // Keyword stuffing check
    if (parseFloat(density) > 5) {
      checks.push({
        id: 'keyword-stuffing',
        status: 'error',
        title: 'Posible keyword stuffing detectado',
        description: `"${topWord.word}" tiene densidad del ${density}% (>5%). Esto puede resultar en penalización.`,
      });
    } else if (parseFloat(density) >= 2 && parseFloat(density) <= 5) {
      score += 10;
      checks.push({
        id: 'keyword-density-good',
        status: 'good',
        title: 'Densidad de keyword óptima',
        description: `Densidad del ${density}% para "${topWord.word}" (ideal: 2–5%).`,
      });
    } else {
      score += 5;
      checks.push({
        id: 'keyword-density-low',
        status: 'warning',
        title: 'Densidad de keyword baja',
        description: `Densidad del ${density}% para "${topWord.word}" (ideal: 2–5%).`,
      });
    }
  }

  // Check presence in title, description, H1
  const titleText = (doc.querySelector('title')?.textContent || '').toLowerCase();
  const metaDesc = (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').toLowerCase();
  const h1Text = (doc.querySelector('h1')?.textContent || '').toLowerCase();
  const first100Words = allWords.slice(0, 100).join(' ');

  if (topKeywords.length > 0) {
    const mainKw = topKeywords[0].word;

    if (titleText.includes(mainKw)) {
      score += 10;
      checks.push({
        id: 'kw-in-title',
        status: 'good',
        title: 'Keyword principal en el título',
        description: `"${mainKw}" aparece en el <title>.`,
      });
    } else {
      checks.push({
        id: 'kw-not-in-title',
        status: 'warning',
        title: 'Keyword principal no está en el título',
        description: `Considera incluir "${mainKw}" en el <title> para mejor posicionamiento.`,
      });
    }

    if (metaDesc.includes(mainKw)) {
      score += 8;
      checks.push({
        id: 'kw-in-meta',
        status: 'good',
        title: 'Keyword en meta description',
        description: `"${mainKw}" aparece en la meta description.`,
      });
    } else {
      checks.push({
        id: 'kw-not-in-meta',
        status: 'warning',
        title: 'Keyword no está en meta description',
        description: `Incluir "${mainKw}" en la meta description puede mejorar el CTR.`,
      });
    }

    if (h1Text.includes(mainKw)) {
      score += 8;
      checks.push({
        id: 'kw-in-h1',
        status: 'good',
        title: 'Keyword en H1',
        description: `"${mainKw}" aparece en el H1.`,
      });
    } else if (h1Text) {
      checks.push({
        id: 'kw-not-in-h1',
        status: 'warning',
        title: 'Keyword principal no está en H1',
        description: `Considera incluir "${mainKw}" en el H1 para reforzar la relevancia temática.`,
      });
    }

    if (first100Words.includes(mainKw)) {
      score += 5;
      checks.push({
        id: 'kw-in-intro',
        status: 'good',
        title: 'Keyword en introducción',
        description: `"${mainKw}" aparece en las primeras 100 palabras del contenido.`,
      });
    } else {
      checks.push({
        id: 'kw-not-in-intro',
        status: 'info',
        title: 'Keyword no aparece en la introducción',
        description: `Mencionar "${mainKw}" en el primer párrafo refuerza la relevancia.`,
      });
    }
  }

  const normalizedScore = Math.min(100, Math.round((score / 66) * 100));

  return {
    name: 'Palabras Clave',
    icon: '🔑',
    score: normalizedScore,
    checks,
    topKeywords,
    totalWords,
    summary: buildSummary(checks),
  };
}

function buildSummary(checks) {
  const good = checks.filter(c => c.status === 'good').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const errors = checks.filter(c => c.status === 'error').length;
  return { good, warnings, errors };
}
