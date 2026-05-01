/**
 * marketing.js — Digital Marketing analysis module
 * Analyzes landing page quality, rich results, search intent, and local SEO.
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getTextContent(doc) {
  const body = doc.body;
  if (!body) return '';
  return (body.innerText || body.textContent || '').toLowerCase();
}

// ── Landing Page Quality ───────────────────────────────────────────────────────

const CTA_PATTERNS = [
  'contactar', 'contáctanos', 'solicitar', 'solicita', 'comprar', 'compra',
  'llamar', 'llámanos', 'cotizar', 'cotiza', 'get started', 'empezar',
  'comenzar', 'registrar', 'regístrate', 'suscribir', 'suscríbete',
  'descargar', 'descarga', 'probar', 'prueba gratis', 'contratar',
  'agenda', 'reservar', 'ver más', 'más información',
];

const TRUST_PATTERNS = [
  'garantía', 'garantizado', 'certificado', 'certificación',
  'años de experiencia', 'clientes', 'reseñas', 'opiniones',
  'calificación', 'satisfacción', 'confianza', 'seguro', 'seguridad',
  'respaldo', 'reconocido', 'premiado', 'acreditado',
];

/**
 * Analyze landing page quality for Google Ads Quality Score factors.
 * @param {Document} doc
 * @returns {{ score: number, checks: object[] }}
 */
function analyzeLandingPageQuality(doc) {
  const checks = [];
  let score = 0;

  const bodyText = getTextContent(doc);
  const allText = doc.documentElement.textContent.toLowerCase();

  // ── CTA buttons ─────────────────────────────────────────────
  const buttons = [...doc.querySelectorAll('button, a.btn, a[class*="btn"], a[class*="cta"], [class*="cta"], [class*="button"]')];
  const anchors = [...doc.querySelectorAll('a')];
  const allClickable = [...new Set([...buttons, ...anchors])];

  const foundCTAs = CTA_PATTERNS.filter(pattern =>
    allClickable.some(el => el.textContent.toLowerCase().includes(pattern))
  );

  if (foundCTAs.length >= 2) {
    score += 20;
    checks.push({
      status: 'good',
      title: `CTAs de conversión detectados (${foundCTAs.length})`,
      description: `Se encontraron llamadas a la acción: "${foundCTAs.slice(0, 3).join('", "')}"`,
    });
  } else if (foundCTAs.length === 1) {
    score += 10;
    checks.push({
      status: 'warning',
      title: 'Solo 1 CTA detectado',
      description: `Agrega más llamadas a la acción. Se encontró: "${foundCTAs[0]}". Considera agregar "Contactar", "Cotizar" o "Solicitar".`,
    });
  } else {
    checks.push({
      status: 'error',
      title: 'Sin CTAs de conversión detectados',
      description: 'Agrega botones o enlaces con textos como "Contactar", "Solicitar presupuesto", "Comprar" para mejorar el Quality Score.',
    });
  }

  // ── CTA above the fold ────────────────────────────────────────
  const firstElements = [...doc.querySelectorAll('body > *, body > * > *, header *, nav *, .hero *, [class*="hero"] *, [id*="hero"] *')].slice(0, 80);
  const aboveFoldCTA = CTA_PATTERNS.some(p =>
    firstElements.some(el => el.textContent.toLowerCase().includes(p))
  );
  if (aboveFoldCTA) {
    score += 10;
    checks.push({
      status: 'good',
      title: 'CTA visible al inicio de la página',
      description: 'Hay una llamada a la acción en la parte superior de la página (above the fold).',
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Sin CTA visible al inicio',
      description: 'Coloca un botón de acción visible sin necesidad de hacer scroll para mejorar conversiones.',
    });
  }

  // ── Conversion forms ──────────────────────────────────────────
  const forms = [...doc.querySelectorAll('form')];
  const conversionForms = forms.filter(form => {
    const inputs = [...form.querySelectorAll('input')];
    return inputs.some(inp => {
      const t = (inp.type || '').toLowerCase();
      const n = (inp.name || inp.placeholder || inp.id || '').toLowerCase();
      return t === 'email' || t === 'tel' || n.includes('email') || n.includes('correo') ||
             n.includes('tel') || n.includes('phone') || n.includes('nombre') || n.includes('name');
    });
  });

  if (conversionForms.length > 0) {
    score += 20;
    checks.push({
      status: 'good',
      title: `Formulario de conversión detectado (${conversionForms.length})`,
      description: 'Hay formularios con campos de email/teléfono/nombre para capturar leads.',
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Sin formulario de conversión',
      description: 'Agrega un formulario de contacto con email o teléfono para capturar leads desde Google Ads.',
    });
  }

  // ── Phone number ──────────────────────────────────────────────
  const phoneRegex = /(\+?[\d\s\-().]{7,}[\d])/g;
  const phoneMatches = allText.match(phoneRegex);
  const hasPhone = phoneMatches && phoneMatches.some(m => m.replace(/\D/g, '').length >= 7);

  if (hasPhone) {
    score += 10;
    checks.push({
      status: 'good',
      title: 'Número de teléfono visible',
      description: 'Se detectó un número de teléfono en la página, facilitando el contacto directo.',
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Sin número de teléfono visible',
      description: 'Muestra un número de teléfono visible para aumentar la confianza y las conversiones.',
    });
  }

  // ── Trust signals ──────────────────────────────────────────────
  const foundTrust = TRUST_PATTERNS.filter(p => bodyText.includes(p));
  if (foundTrust.length >= 3) {
    score += 15;
    checks.push({
      status: 'good',
      title: `Señales de confianza detectadas (${foundTrust.length})`,
      description: `Palabras de confianza encontradas: "${foundTrust.slice(0, 4).join('", "')}"`,
    });
  } else if (foundTrust.length > 0) {
    score += 7;
    checks.push({
      status: 'warning',
      title: 'Pocas señales de confianza',
      description: `Solo ${foundTrust.length} señal(es) de confianza. Agrega más: garantías, años de experiencia, certificaciones, número de clientes.`,
    });
  } else {
    checks.push({
      status: 'error',
      title: 'Sin señales de confianza',
      description: 'Agrega elementos de confianza: "Garantía de satisfacción", "10+ años de experiencia", "500+ clientes", certificaciones.',
    });
  }

  return { score: Math.min(100, score), checks };
}

// ── Rich Results ───────────────────────────────────────────────────────────────

/**
 * Check for rich result types based on Schema.org markup.
 * @param {Document} doc
 * @returns {{ score: number, checks: object[], richResults: object[] }}
 */
function analyzeRichResults(doc) {
  const checks = [];
  let score = 0;

  // Collect all JSON-LD types
  const jsonLdTypes = new Set();
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const collectTypes = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj['@type']) {
          const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
          types.forEach(t => jsonLdTypes.add(t.toLowerCase()));
        }
        Object.values(obj).forEach(v => {
          if (typeof v === 'object') collectTypes(v);
        });
      };
      collectTypes(data);
    } catch { /* ignore */ }
  });

  // Also check microdata
  const microdataTypes = new Set();
  doc.querySelectorAll('[itemtype]').forEach(el => {
    const type = (el.getAttribute('itemtype') || '').toLowerCase();
    microdataTypes.add(type);
  });

  const richResults = [];

  // ── Reviews / AggregateRating ──────────────────────────────────
  const hasReviews = jsonLdTypes.has('aggregaterating') || jsonLdTypes.has('review') ||
    [...microdataTypes].some(t => t.includes('aggregaterating') || t.includes('review'));
  richResults.push({
    type: 'Reseñas (AggregateRating)',
    icon: '⭐',
    implemented: hasReviews,
    howTo: 'Agrega Schema.org/AggregateRating en JSON-LD con ratingValue, reviewCount y bestRating.',
  });
  if (hasReviews) score += 15;

  // ── FAQ ──────────────────────────────────────────────────────
  const hasFAQ = jsonLdTypes.has('faqpage') || jsonLdTypes.has('question') ||
    doc.querySelectorAll('details, [itemtype*="FAQPage"]').length > 0;
  richResults.push({
    type: 'Preguntas Frecuentes (FAQ)',
    icon: '📋',
    implemented: hasFAQ,
    howTo: 'Agrega Schema.org/FAQPage con @type: "Question" y acceptedAnswer para cada pregunta/respuesta.',
  });
  if (hasFAQ) score += 15;

  // ── Breadcrumbs ───────────────────────────────────────────────
  const hasBreadcrumb = jsonLdTypes.has('breadcrumblist') || jsonLdTypes.has('breadcrumb') ||
    [...microdataTypes].some(t => t.includes('breadcrumb')) ||
    doc.querySelectorAll('[aria-label*="breadcrumb"], nav[class*="breadcrumb"], ol[class*="breadcrumb"]').length > 0;
  richResults.push({
    type: 'Breadcrumbs (Miga de pan)',
    icon: '🍞',
    implemented: hasBreadcrumb,
    howTo: 'Agrega Schema.org/BreadcrumbList con la jerarquía de páginas usando ListItem y position.',
  });
  if (hasBreadcrumb) score += 15;

  // ── Local Business / Organization ─────────────────────────────
  const hasLocalBiz = jsonLdTypes.has('localbusiness') || jsonLdTypes.has('organization') ||
    jsonLdTypes.has('restaurant') || jsonLdTypes.has('store') || jsonLdTypes.has('medicalorganization') ||
    [...microdataTypes].some(t => t.includes('localbusiness') || t.includes('organization'));
  richResults.push({
    type: 'Negocio Local / Organización',
    icon: '🏢',
    implemented: hasLocalBiz,
    howTo: 'Agrega Schema.org/LocalBusiness con name, address, telephone, openingHours y geo (latitud/longitud).',
  });
  if (hasLocalBiz) score += 20;

  // ── Article / BlogPosting ──────────────────────────────────────
  const hasArticle = jsonLdTypes.has('article') || jsonLdTypes.has('blogposting') ||
    jsonLdTypes.has('newsarticle') || [...microdataTypes].some(t => t.includes('article'));
  richResults.push({
    type: 'Artículos / Blog',
    icon: '📰',
    implemented: hasArticle,
    howTo: 'Agrega Schema.org/Article o BlogPosting con headline, author, datePublished y image.',
  });
  if (hasArticle) score += 15;

  // ── Product ──────────────────────────────────────────────────
  const hasProduct = jsonLdTypes.has('product') || jsonLdTypes.has('offer') ||
    [...microdataTypes].some(t => t.includes('product'));
  richResults.push({
    type: 'Productos (eCommerce)',
    icon: '🛒',
    implemented: hasProduct,
    howTo: 'Agrega Schema.org/Product con name, image, description, offers (price, priceCurrency) y aggregateRating.',
  });
  if (hasProduct) score += 20;

  const implemented = richResults.filter(r => r.implemented).length;
  checks.push({
    status: implemented >= 3 ? 'good' : implemented >= 1 ? 'warning' : 'error',
    title: `Rich Results: ${implemented}/${richResults.length} implementados`,
    description: implemented === 0
      ? 'No hay Rich Results implementados. Mejora tu visibilidad en Google con Schema.org.'
      : `Tienes ${implemented} tipos de Rich Results. ${6 - implemented} tipos adicionales podrían mejorar tu presencia en Google.`,
  });

  return { score: Math.min(100, score), checks, richResults };
}

// ── Search Intent Analysis ─────────────────────────────────────────────────────

const INTENT_PATTERNS = {
  transactional: ['comprar', 'precio', 'cotizar', 'contratar', 'oferta', 'descuento', 'pago',
    'tienda', 'envío', 'carrito', 'checkout', 'compra', 'pedido', 'order', 'buy', 'shop', 'sale'],
  informational: ['cómo', 'como', 'qué es', 'que es', 'guía', 'tutorial', 'consejos', 'tips',
    'aprende', 'aprende', 'explicación', 'definición', 'meaning', 'how to', 'what is', 'guide'],
  navigational: ['inicio', 'home', 'nosotros', 'about', 'contacto', 'contact', 'login',
    'acceder', 'mi cuenta', 'perfil', 'dashboard', 'portal'],
  commercial: ['mejor', 'mejores', 'comparar', 'comparación', 'vs', 'alternativas', 'reseñas',
    'opiniones', 'review', 'top', 'ranking', 'recomendaciones', 'best', 'compare'],
};

/**
 * Analyze search intent based on page text content.
 * @param {Document} doc
 * @returns {{ score: number, checks: object[], intentData: object }}
 */
function analyzeSearchIntent(doc) {
  const checks = [];
  const bodyText = getTextContent(doc);
  const words = bodyText.split(/\s+/).filter(Boolean);
  const totalWords = Math.max(words.length, 1);

  const counts = {};
  let totalMatches = 0;

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    let count = 0;
    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const matches = bodyText.match(regex);
      if (matches) count += matches.length;
    }
    counts[intent] = count;
    totalMatches += count;
  }

  // Calculate percentages
  const percentages = {};
  for (const [intent, count] of Object.entries(counts)) {
    percentages[intent] = totalMatches > 0 ? Math.round((count / totalMatches) * 100) : 0;
  }

  // Determine dominant intent
  const dominant = Object.entries(percentages).sort((a, b) => b[1] - a[1])[0];

  // Generate recommendation
  let recommendation = '';
  if (dominant && dominant[1] > 0) {
    const recs = {
      transactional: 'Tu contenido tiene fuerte intención transaccional. Asegúrate de tener precios claros, proceso de compra fácil y señales de confianza.',
      informational: 'Contenido principalmente informacional. Complementa con CTAs para convertir visitantes informacionales en clientes.',
      navigational: 'El contenido es mayormente navegacional. Asegúrate de que la estructura de navegación sea clara y los usuarios encuentren lo que buscan.',
      commercial: 'Fuerte intención comercial/comparativa. Aprovecha para destacar ventajas sobre competidores y casos de éxito.',
    };
    recommendation = recs[dominant[0]] || '';
  } else {
    recommendation = 'No se detectó una intención de búsqueda clara. Enriquece el contenido con palabras específicas para tu audiencia objetivo.';
  }

  const score = totalMatches > 0 ? Math.min(100, 50 + (dominant ? dominant[1] : 0) / 2) : 30;

  checks.push({
    status: totalMatches > 0 ? 'good' : 'warning',
    title: `Intención dominante: ${dominant ? intentLabels[dominant[0]] : 'No detectada'}`,
    description: recommendation,
  });

  return {
    score: Math.round(score),
    checks,
    intentData: {
      percentages,
      counts,
      dominant: dominant ? dominant[0] : null,
    },
  };
}

const intentLabels = {
  transactional: '🛒 Transaccional',
  informational: '🔍 Informacional',
  navigational: '🧭 Navegacional',
  commercial: '🤝 Comercial',
};

const intentColors = {
  transactional: '#22c55e',
  informational: '#3b82f6',
  navigational: '#f59e0b',
  commercial: '#a855f7',
};

// ── Local SEO Checklist ────────────────────────────────────────────────────────

/**
 * Check local SEO signals: NAP, LocalBusiness schema, Google Maps, hours.
 * @param {Document} doc
 * @returns {{ score: number, checks: object[] }}
 */
function analyzeLocalSEO(doc) {
  const checks = [];
  let score = 0;

  const allText = (doc.documentElement.textContent || '').toLowerCase();

  // ── NAP (Name, Address, Phone) ────────────────────────────────
  const hasAddress = /\b(calle|avenida|av\.|carrera|cra\.|boulevard|blvd|street|st\.|avenue|ave\.|\d+\s+\w+\s+(street|st|ave|blvd|road|rd|lane|ln|drive|dr))/i.test(allText);
  const hasPhone = /(\+?[\d][\d\s\-().]{6,}[\d])/.test(allText);
  const napCount = (hasAddress ? 1 : 0) + (hasPhone ? 1 : 0);

  if (napCount >= 2) {
    score += 25;
    checks.push({
      status: 'good',
      title: 'NAP detectado (Nombre, Dirección, Teléfono)',
      description: 'Se encontraron dirección y teléfono en la página. El NAP consistente mejora el SEO local.',
    });
  } else if (napCount === 1) {
    score += 10;
    checks.push({
      status: 'warning',
      title: 'NAP incompleto',
      description: `Falta${!hasAddress ? ' dirección física' : ''}${!hasPhone ? ' número de teléfono' : ''}. Agrega los datos completos de la empresa para SEO local.`,
    });
  } else {
    checks.push({
      status: 'error',
      title: 'Sin NAP detectado',
      description: 'Agrega el nombre, dirección y teléfono de la empresa de forma visible en la página.',
    });
  }

  // ── Schema LocalBusiness ──────────────────────────────────────
  let hasLocalSchema = false;
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const checkObj = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        const t = (obj['@type'] || '').toLowerCase();
        if (t.includes('localbusiness') || t.includes('organization') || t.includes('store')) {
          hasLocalSchema = true;
        }
        Object.values(obj).forEach(v => { if (typeof v === 'object') checkObj(v); });
      };
      checkObj(data);
    } catch { /* ignore */ }
  });

  if (hasLocalSchema) {
    score += 30;
    checks.push({
      status: 'good',
      title: 'Schema LocalBusiness / Organization presente',
      description: 'El marcado Schema.org ayuda a Google a mostrar información de tu negocio en resultados locales.',
    });
  } else {
    checks.push({
      status: 'error',
      title: 'Sin Schema LocalBusiness',
      description: 'Agrega Schema.org/LocalBusiness con name, address, telephone, openingHours y geo para mejor posicionamiento local.',
    });
  }

  // ── Google Maps embed ─────────────────────────────────────────
  const hasMap = doc.querySelectorAll('iframe[src*="maps.google"], iframe[src*="google.com/maps"], iframe[src*="maps.googleapis"]').length > 0;
  if (hasMap) {
    score += 25;
    checks.push({
      status: 'good',
      title: 'Google Maps embed detectado',
      description: 'El mapa de Google incrustado mejora la experiencia de usuario y señales locales.',
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Sin Google Maps embed',
      description: 'Considera agregar un mapa de Google incrustado para mostrar tu ubicación física.',
    });
  }

  // ── Opening hours ─────────────────────────────────────────────
  const hoursPatterns = ['horario', 'hours', 'abierto', 'open', 'lunes', 'monday', 'lun a vie', 'mon-fri',
    'am', 'pm', '9:00', '10:00', '8:00'];
  const hasHours = hoursPatterns.some(p => allText.includes(p));

  if (hasHours) {
    score += 20;
    checks.push({
      status: 'good',
      title: 'Horario de atención mencionado',
      description: 'Se detectó información sobre el horario de atención, importante para SEO local y experiencia de usuario.',
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Sin horario de atención visible',
      description: 'Agrega el horario de atención en la página y en el Schema LocalBusiness/openingHours.',
    });
  }

  return { score: Math.min(100, score), checks };
}

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Main marketing analysis function.
 * @param {Document} doc
 * @param {string} url
 * @returns {{ name: string, icon: string, score: number, checks: object[], summary: object, details: object }}
 */
export function analyzeMarketing(doc, url) {
  const landing = analyzeLandingPageQuality(doc);
  const rich = analyzeRichResults(doc);
  const intent = analyzeSearchIntent(doc);
  const local = analyzeLocalSEO(doc);

  // Combine all checks
  const allChecks = [
    { section: '🎯 Calidad de Landing Page', checks: landing.checks },
    { section: '🌟 Rich Results', checks: rich.checks },
    { section: '🔍 Intención de Búsqueda', checks: intent.checks },
    { section: '📍 SEO Local', checks: local.checks },
  ];

  const flatChecks = allChecks.flatMap(s =>
    s.checks.map(c => ({ ...c, section: s.section }))
  );

  // Overall marketing score: weighted average
  const score = Math.round(
    landing.score * 0.30 +
    rich.score * 0.25 +
    intent.score * 0.20 +
    local.score * 0.25
  );

  const good = flatChecks.filter(c => c.status === 'good').length;
  const warnings = flatChecks.filter(c => c.status === 'warning').length;
  const errors = flatChecks.filter(c => c.status === 'error').length;

  return {
    name: 'Marketing Digital',
    icon: '📈',
    score,
    checks: flatChecks,
    summary: { good, warnings, errors },
    details: {
      landing: { score: landing.score, checks: landing.checks },
      richResults: { score: rich.score, checks: rich.checks, items: rich.richResults },
      intent: { score: intent.score, checks: intent.checks, data: intent.intentData },
      local: { score: local.score, checks: local.checks },
      intentLabels,
      intentColors,
    },
  };
}
