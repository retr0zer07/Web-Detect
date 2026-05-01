/**
 * social.js — Social media presence analysis
 */

export function analyzeSocial(doc, url) {
  const checks = [];
  let score = 0;

  // Helper
  const getMeta = (selector) =>
    doc.querySelector(selector)?.getAttribute('content') || '';

  // ── Open Graph ────────────────────────────────────────────────────────────
  const ogTitle = getMeta('meta[property="og:title"]');
  const ogDescription = getMeta('meta[property="og:description"]');
  const ogImage = getMeta('meta[property="og:image"]');
  const ogUrl = getMeta('meta[property="og:url"]');
  const ogType = getMeta('meta[property="og:type"]');
  const ogSiteName = getMeta('meta[property="og:site_name"]');
  const ogLocale = getMeta('meta[property="og:locale"]');

  const ogFields = [
    { key: 'og:title', value: ogTitle, weight: 15, required: true },
    { key: 'og:description', value: ogDescription, weight: 15, required: true },
    { key: 'og:image', value: ogImage, weight: 15, required: true },
    { key: 'og:url', value: ogUrl, weight: 10, required: true },
    { key: 'og:type', value: ogType, weight: 5, required: false },
    { key: 'og:site_name', value: ogSiteName, weight: 5, required: false },
    { key: 'og:locale', value: ogLocale, weight: 5, required: false },
  ];

  const ogScore = ogFields.reduce((acc, f) => (f.value ? acc + f.weight : acc), 0);
  const maxOgScore = ogFields.reduce((acc, f) => acc + f.weight, 0);
  const ogPercent = Math.round((ogScore / maxOgScore) * 100);

  score += Math.round((ogScore / maxOgScore) * 40);

  ogFields.forEach(field => {
    if (field.value) {
      checks.push({
        id: `og-${field.key.replace(':', '-')}`,
        status: 'good',
        title: `${field.key} presente`,
        description: field.required ? 'Campo requerido para compartidos en Facebook/LinkedIn.' : 'Campo opcional presente.',
        value: field.value.slice(0, 80),
      });
    } else if (field.required) {
      checks.push({
        id: `og-${field.key.replace(':', '-')}-missing`,
        status: 'error',
        title: `${field.key} ausente`,
        description: `Campo requerido para un compartido perfecto en redes sociales.`,
      });
    } else {
      checks.push({
        id: `og-${field.key.replace(':', '-')}-missing`,
        status: 'info',
        title: `${field.key} no configurado`,
        description: 'Campo opcional de Open Graph. Considera agregarlo.',
      });
    }
  });

  // og:image size hint
  if (ogImage) {
    checks.push({
      id: 'og-image-hint',
      status: 'info',
      title: 'Dimensiones recomendadas para og:image',
      description: 'Facebook recomienda 1200×630px. LinkedIn: 1200×627px. Verifica que la imagen cumpla estas dimensiones.',
      value: ogImage.slice(0, 80),
    });
  }

  // ── Twitter Cards ─────────────────────────────────────────────────────────
  const twCard = getMeta('meta[name="twitter:card"]');
  const twTitle = getMeta('meta[name="twitter:title"]') || ogTitle;
  const twDescription = getMeta('meta[name="twitter:description"]') || ogDescription;
  const twImage = getMeta('meta[name="twitter:image"]') || ogImage;
  const twSite = getMeta('meta[name="twitter:site"]');
  const twCreator = getMeta('meta[name="twitter:creator"]');

  const twFields = [
    { key: 'twitter:card', value: twCard, weight: 10, required: true },
    { key: 'twitter:title', value: twTitle, weight: 10, required: true },
    { key: 'twitter:description', value: twDescription, weight: 8, required: true },
    { key: 'twitter:image', value: twImage, weight: 10, required: true },
    { key: 'twitter:site', value: twSite, weight: 5, required: false },
    { key: 'twitter:creator', value: twCreator, weight: 5, required: false },
  ];

  const twScore = twFields.reduce((acc, f) => (f.value ? acc + f.weight : acc), 0);
  const maxTwScore = twFields.reduce((acc, f) => acc + f.weight, 0);
  score += Math.round((twScore / maxTwScore) * 35);

  twFields.forEach(field => {
    if (field.value) {
      checks.push({
        id: `tw-${field.key.replace(':', '-').replace('/', '-')}`,
        status: 'good',
        title: `${field.key} presente`,
        description: field.required ? 'Requerido para Twitter/X Cards.' : 'Campo opcional presente.',
        value: field.value.slice(0, 80),
      });
    } else if (field.required) {
      const usedFallback = (field.key === 'twitter:title' && ogTitle) ||
                           (field.key === 'twitter:description' && ogDescription) ||
                           (field.key === 'twitter:image' && ogImage);
      checks.push({
        id: `tw-${field.key.replace(':', '-')}-missing`,
        status: usedFallback ? 'warning' : 'error',
        title: `${field.key} no declarado${usedFallback ? ' (usa fallback OG)' : ''}`,
        description: usedFallback
          ? `Twitter/X usará el valor de Open Graph como fallback.`
          : `Agrega ${field.key} para control total de cómo se comparte en X/Twitter.`,
      });
    } else {
      checks.push({
        id: `tw-${field.key.replace(':', '-')}-missing`,
        status: 'info',
        title: `${field.key} no configurado`,
        description: 'Opcional. Permite asociar el handle de Twitter al contenido.',
      });
    }
  });

  // ── Score summary ─────────────────────────────────────────────────────────
  const requiredOgMissing = ogFields.filter(f => f.required && !f.value).length;
  const requiredTwMissing = twFields.filter(f => f.required && !f.value && !(
    (f.key === 'twitter:title' && ogTitle) ||
    (f.key === 'twitter:description' && ogDescription) ||
    (f.key === 'twitter:image' && ogImage)
  )).length;

  if (requiredOgMissing === 0 && requiredTwMissing === 0) {
    score += 25;
    checks.push({
      id: 'social-complete',
      status: 'good',
      title: '¡Presencia social completa!',
      description: 'Todas las etiquetas esenciales de Open Graph y Twitter Card están configuradas.',
    });
  } else if (requiredOgMissing + requiredTwMissing <= 2) {
    score += 12;
    checks.push({
      id: 'social-almost',
      status: 'warning',
      title: 'Presencia social casi completa',
      description: `Solo ${requiredOgMissing + requiredTwMissing} etiqueta(s) requerida(s) ausente(s).`,
    });
  } else {
    checks.push({
      id: 'social-incomplete',
      status: 'error',
      title: 'Presencia social incompleta',
      description: `Faltan ${requiredOgMissing} etiquetas Open Graph y ${requiredTwMissing} de Twitter Card.`,
    });
  }

  const normalizedScore = Math.min(100, Math.round(score));

  return {
    name: 'Redes Sociales',
    icon: '📱',
    score: normalizedScore,
    checks,
    ogScore: ogPercent,
    twitterScore: Math.round((twScore / maxTwScore) * 100),
    summary: buildSummary(checks),
  };
}

function buildSummary(checks) {
  const good = checks.filter(c => c.status === 'good').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const errors = checks.filter(c => c.status === 'error').length;
  return { good, warnings, errors };
}
