/**
 * schema.js — Structured data & social meta analysis
 */

export function analyzeSchema(doc, url) {
  const checks = [];
  let score = 0;

  // ── JSON-LD ───────────────────────────────────────────────────────────────
  const jsonLdScripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  const jsonLdData = [];

  if (jsonLdScripts.length === 0) {
    checks.push({
      id: 'jsonld-missing',
      status: 'warning',
      title: 'Sin JSON-LD / Schema.org',
      description: 'No se encontró structured data en JSON-LD. Añadir schema mejora los rich results en Google.',
    });
  } else {
    score += 20;
    jsonLdScripts.forEach((script, i) => {
      try {
        const data = JSON.parse(script.textContent);
        const type = data['@type'] || (Array.isArray(data) && data[0]?.['@type']) || 'Unknown';
        jsonLdData.push({ type, raw: data });
        checks.push({
          id: `jsonld-${i}`,
          status: 'good',
          title: `JSON-LD encontrado: ${Array.isArray(type) ? type.join(', ') : type}`,
          description: 'Schema estructurado correctamente en JSON-LD.',
          value: `@type: ${Array.isArray(type) ? type.join(', ') : type}`,
        });
        score += 5;
      } catch {
        checks.push({
          id: `jsonld-invalid-${i}`,
          status: 'error',
          title: 'JSON-LD inválido',
          description: 'Se encontró un bloque JSON-LD pero no se pudo parsear. Verifica la sintaxis.',
        });
      }
    });

    // Bonus for common high-value schemas
    const types = jsonLdData.map(d => String(d.type).toLowerCase());
    const highValue = ['article', 'product', 'faqpage', 'breadcrumblist', 'organization', 'website', 'localbusiness'];
    const hasHighValue = highValue.some(hv => types.some(t => t.includes(hv)));
    if (hasHighValue) {
      score += 10;
      checks.push({
        id: 'jsonld-rich-type',
        status: 'good',
        title: 'Schema de alta relevancia detectado',
        description: 'Tipos como Article, Product, FAQPage, BreadcrumbList mejoran los rich snippets.',
      });
    }
  }

  // ── Open Graph ────────────────────────────────────────────────────────────
  const ogTags = {
    title: doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
    description: doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
    image: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
    url: doc.querySelector('meta[property="og:url"]')?.getAttribute('content') || '',
    type: doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || '',
    siteName: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '',
  };

  const ogPresent = Object.values(ogTags).filter(Boolean).length;

  if (ogTags.title && ogTags.description && ogTags.image && ogTags.url) {
    score += 20;
    checks.push({
      id: 'og-complete',
      status: 'good',
      title: 'Open Graph completo',
      description: 'og:title, og:description, og:image y og:url están presentes.',
      value: `og:title: "${ogTags.title.slice(0, 60)}"`,
    });
  } else {
    const missing = [];
    if (!ogTags.title) missing.push('og:title');
    if (!ogTags.description) missing.push('og:description');
    if (!ogTags.image) missing.push('og:image');
    if (!ogTags.url) missing.push('og:url');

    if (ogPresent === 0) {
      checks.push({
        id: 'og-missing',
        status: 'warning',
        title: 'Sin etiquetas Open Graph',
        description: 'Agrega og:title, og:description, og:image y og:url para mejorar cómo se comparte en redes sociales.',
      });
    } else {
      score += 8;
      checks.push({
        id: 'og-incomplete',
        status: 'warning',
        title: `Open Graph incompleto (faltan: ${missing.join(', ')})`,
        description: 'Completa las etiquetas Open Graph para compartidos perfectos en Facebook, LinkedIn, etc.',
        value: missing.join(', '),
      });
    }
  }

  // og:image hint
  if (ogTags.image) {
    score += 5;
    checks.push({
      id: 'og-image',
      status: 'good',
      title: 'og:image presente',
      description: 'Recomendado: 1200×630px. La imagen aparecerá al compartir en redes.',
      value: ogTags.image.slice(0, 80),
    });
  }

  if (ogTags.type) {
    score += 3;
    checks.push({
      id: 'og-type',
      status: 'good',
      title: `og:type: "${ogTags.type}"`,
      description: 'Tipo de contenido Open Graph declarado.',
    });
  } else if (ogPresent > 0) {
    checks.push({
      id: 'og-type-missing',
      status: 'info',
      title: 'og:type no declarado',
      description: 'Agrega og:type (ej. website, article) para clasificar mejor el contenido.',
    });
  }

  // ── Twitter Cards ─────────────────────────────────────────────────────────
  const twCard = doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || '';
  const twTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '';
  const twDesc = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '';
  const twImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';

  if (twCard) {
    score += 10;
    const twComplete = !!(twTitle || ogTags.title) && !!(twDesc || ogTags.description) && !!(twImage || ogTags.image);
    checks.push({
      id: 'twitter-card',
      status: twComplete ? 'good' : 'warning',
      title: `Twitter Card "${twCard}" ${twComplete ? 'completa' : 'incompleta'}`,
      description: twComplete
        ? 'La página tiene Twitter Card configurada correctamente.'
        : 'Agrega twitter:title, twitter:description y twitter:image.',
      value: twCard,
    });
    if (twComplete) score += 5;
  } else {
    checks.push({
      id: 'twitter-card-missing',
      status: 'warning',
      title: 'Sin Twitter Card',
      description: 'Agrega <meta name="twitter:card" content="summary_large_image"> para mejorar cómo se comparte en X/Twitter.',
    });
  }

  // ── Microdata ─────────────────────────────────────────────────────────────
  const microdataItems = doc.querySelectorAll('[itemscope]');
  if (microdataItems.length > 0) {
    score += 5;
    const types = [...microdataItems]
      .map(el => el.getAttribute('itemtype') || 'sin tipo')
      .filter(Boolean)
      .slice(0, 3);
    checks.push({
      id: 'microdata-found',
      status: 'good',
      title: `${microdataItems.length} elemento(s) con Microdata encontrados`,
      description: 'Se detectaron atributos itemscope/itemtype en el HTML.',
      value: types.join(', '),
    });
  }

  const normalizedScore = Math.min(100, Math.round((score / 83) * 100));

  return {
    name: 'Schema & Datos Estructurados',
    icon: '📊',
    score: normalizedScore,
    checks,
    jsonLdData,
    ogTags,
    twitterCard: { card: twCard, title: twTitle, description: twDesc, image: twImage },
    summary: buildSummary(checks),
  };
}

function buildSummary(checks) {
  const good = checks.filter(c => c.status === 'good').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const errors = checks.filter(c => c.status === 'error').length;
  return { good, warnings, errors };
}
