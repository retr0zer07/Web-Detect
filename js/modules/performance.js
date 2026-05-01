/**
 * performance.js — Static HTML performance hints analysis
 */

export function analyzePerformance(doc, url) {
  const checks = [];
  let score = 0;

  // ── Blocking scripts in <head> ────────────────────────────────────────────
  const head = doc.head;
  const headScripts = head ? [...head.querySelectorAll('script[src]')] : [];
  const blockingScripts = headScripts.filter(
    s => !s.hasAttribute('async') && !s.hasAttribute('defer')
  );

  if (blockingScripts.length === 0) {
    score += 20;
    checks.push({
      id: 'no-blocking-scripts',
      status: 'good',
      title: 'Sin scripts bloqueantes en <head>',
      description: 'No se encontraron scripts que bloqueen el renderizado en el <head>.',
    });
  } else {
    checks.push({
      id: 'blocking-scripts',
      status: 'error',
      title: `${blockingScripts.length} script(s) bloqueante(s) en <head>`,
      description: 'Scripts sin async/defer en el <head> bloquean el renderizado. Agrega defer o async.',
      value: blockingScripts.slice(0, 3).map(s => s.getAttribute('src') || '').join(', '),
    });
    if (blockingScripts.length <= 2) score += 8;
  }

  // ── Total external resources ──────────────────────────────────────────────
  const externalScripts = [...doc.querySelectorAll('script[src]')];
  const externalCSS = [...doc.querySelectorAll('link[rel="stylesheet"]')];
  const externalFonts = [...doc.querySelectorAll('link[rel*="font"]')];
  const totalResources = externalScripts.length + externalCSS.length;

  checks.push({
    id: 'resource-count',
    status: totalResources > 20 ? 'warning' : totalResources > 10 ? 'info' : 'good',
    title: `${totalResources} recursos externos encontrados`,
    description: `${externalScripts.length} scripts, ${externalCSS.length} hojas CSS, ${externalFonts.length} fuentes.`,
    value: `JS: ${externalScripts.length} | CSS: ${externalCSS.length} | Fonts: ${externalFonts.length}`,
  });

  if (totalResources <= 10) {
    score += 15;
  } else if (totalResources <= 20) {
    score += 8;
  } else {
    score += 3;
  }

  // ── Lazy loading ──────────────────────────────────────────────────────────
  const images = [...doc.querySelectorAll('img')];
  const lazyImages = images.filter(img => img.getAttribute('loading') === 'lazy');
  const iframes = [...doc.querySelectorAll('iframe')];
  const lazyIframes = iframes.filter(f => f.getAttribute('loading') === 'lazy');

  if (images.length === 0) {
    checks.push({
      id: 'no-images-lazy',
      status: 'info',
      title: 'No hay imágenes para evaluar lazy loading',
      description: 'No se encontraron etiquetas <img>.',
    });
    score += 10;
  } else {
    const lazyRatio = images.length > 0 ? lazyImages.length / images.length : 1;
    if (lazyRatio >= 0.7) {
      score += 15;
      checks.push({
        id: 'lazy-loading-good',
        status: 'good',
        title: `Lazy loading bien implementado (${lazyImages.length}/${images.length} imágenes)`,
        description: 'La mayoría de las imágenes usan loading="lazy".',
      });
    } else if (lazyRatio >= 0.3) {
      score += 8;
      checks.push({
        id: 'lazy-loading-partial',
        status: 'warning',
        title: `Lazy loading parcial (${lazyImages.length}/${images.length} imágenes)`,
        description: `${images.length - lazyImages.length} imagen(es) sin loading="lazy". Agrégalo para mejorar el LCP.`,
      });
    } else {
      checks.push({
        id: 'lazy-loading-missing',
        status: 'error',
        title: `Sin lazy loading (${lazyImages.length}/${images.length} imágenes)`,
        description: 'Agrega loading="lazy" a las imágenes below-the-fold para mejorar el tiempo de carga.',
      });
    }
  }

  // ── Images without width/height (CLS) ────────────────────────────────────
  if (images.length > 0) {
    const imgsNoSize = images.filter(img => !img.hasAttribute('width') || !img.hasAttribute('height'));
    if (imgsNoSize.length === 0) {
      score += 10;
      checks.push({
        id: 'img-dimensions-good',
        status: 'good',
        title: 'Todas las imágenes tienen width y height',
        description: 'Evita el Cumulative Layout Shift (CLS) al reservar espacio para las imágenes.',
      });
    } else {
      checks.push({
        id: 'img-dimensions-missing',
        status: 'warning',
        title: `${imgsNoSize.length} imagen(es) sin width/height`,
        description: 'Las imágenes sin dimensiones pueden causar Layout Shift (CLS). Define width y height.',
        value: `${imgsNoSize.length} de ${images.length}`,
      });
      score += Math.max(0, 5 - imgsNoSize.length);
    }
  }

  // ── Preload / Preconnect ──────────────────────────────────────────────────
  const preloads = [...doc.querySelectorAll('link[rel="preload"]')];
  const preconnects = [...doc.querySelectorAll('link[rel="preconnect"]')];
  const dnsPrefetch = [...doc.querySelectorAll('link[rel="dns-prefetch"]')];

  if (preloads.length > 0 || preconnects.length > 0) {
    score += 10;
    checks.push({
      id: 'preload-present',
      status: 'good',
      title: `Optimizaciones de carga detectadas`,
      description: `${preloads.length} preload, ${preconnects.length} preconnect, ${dnsPrefetch.length} dns-prefetch.`,
      value: `preload: ${preloads.length} | preconnect: ${preconnects.length}`,
    });
  } else {
    checks.push({
      id: 'preload-missing',
      status: 'warning',
      title: 'Sin <link rel="preload"> o preconnect',
      description: 'Usa preload para recursos críticos y preconnect para dominios externos frecuentes.',
    });
  }

  // ── Favicon ───────────────────────────────────────────────────────────────
  const favicon =
    doc.querySelector('link[rel="icon"]') ||
    doc.querySelector('link[rel="shortcut icon"]') ||
    doc.querySelector('link[rel="apple-touch-icon"]');

  if (favicon) {
    score += 5;
    checks.push({
      id: 'favicon-present',
      status: 'good',
      title: 'Favicon presente',
      description: 'El sitio tiene favicon configurado.',
      value: favicon.getAttribute('href') || '',
    });
  } else {
    checks.push({
      id: 'favicon-missing',
      status: 'warning',
      title: 'Favicon no encontrado',
      description: 'Agrega <link rel="icon" href="/favicon.ico"> para mejorar la identidad de marca.',
    });
  }

  // ── Inline styles ─────────────────────────────────────────────────────────
  const inlineStyles = [...doc.querySelectorAll('[style]')];
  if (inlineStyles.length > 20) {
    checks.push({
      id: 'inline-styles-many',
      status: 'warning',
      title: `Muchos estilos inline (${inlineStyles.length})`,
      description: 'El exceso de estilos inline dificulta el mantenimiento y puede afectar el rendimiento.',
      value: `${inlineStyles.length} elementos con estilo inline`,
    });
  } else {
    score += 5;
    checks.push({
      id: 'inline-styles-ok',
      status: 'good',
      title: `Uso controlado de estilos inline (${inlineStyles.length})`,
      description: 'No se detecta abuso de estilos inline.',
    });
  }

  const normalizedScore = Math.min(100, Math.round((score / 90) * 100));

  return {
    name: 'Performance',
    icon: '⚡',
    score: normalizedScore,
    checks,
    stats: {
      blockingScripts: blockingScripts.length,
      externalScripts: externalScripts.length,
      externalCSS: externalCSS.length,
      lazyImages: lazyImages.length,
      totalImages: images.length,
      preloads: preloads.length,
      preconnects: preconnects.length,
    },
    summary: buildSummary(checks),
  };
}

function buildSummary(checks) {
  const good = checks.filter(c => c.status === 'good').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const errors = checks.filter(c => c.status === 'error').length;
  return { good, warnings, errors };
}
