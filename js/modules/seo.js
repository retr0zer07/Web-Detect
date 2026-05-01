/**
 * seo.js — On-page SEO analysis module
 */

export function analyzeSEO(doc, url) {
  const checks = [];
  let score = 0;
  const maxScore = 100;

  // ── Title ─────────────────────────────────────────────────────────────────
  const titleEl = doc.querySelector('title');
  const titleText = titleEl ? titleEl.textContent.trim() : '';

  if (!titleText) {
    checks.push({
      id: 'title-missing',
      status: 'error',
      title: 'Etiqueta <title> ausente',
      description: 'La página no tiene etiqueta <title>. Es el factor SEO más importante.',
    });
  } else {
    const len = titleText.length;
    if (len >= 50 && len <= 60) {
      score += 15;
      checks.push({
        id: 'title-length',
        status: 'good',
        title: 'Longitud del <title> óptima',
        description: `${len} caracteres (ideal: 50–60).`,
        value: titleText,
      });
    } else if (len >= 40 && len <= 70) {
      score += 10;
      checks.push({
        id: 'title-length',
        status: 'warning',
        title: '<title> tiene longitud aceptable',
        description: `${len} caracteres (ideal: 50–60). Ajusta para mejor CTR.`,
        value: titleText,
      });
    } else {
      score += 5;
      checks.push({
        id: 'title-length',
        status: 'error',
        title: len < 40 ? '<title> demasiado corto' : '<title> demasiado largo',
        description: `${len} caracteres (ideal: 50–60). ${len < 40 ? 'Amplía' : 'Acorta'} el título.`,
        value: titleText,
      });
    }
  }

  // ── Meta Description ──────────────────────────────────────────────────────
  const metaDesc = doc.querySelector('meta[name="description"]');
  const descContent = metaDesc ? (metaDesc.getAttribute('content') || '').trim() : '';

  if (!descContent) {
    checks.push({
      id: 'meta-description-missing',
      status: 'error',
      title: 'Meta description ausente',
      description: 'Sin meta description los buscadores generan un snippet automático, generalmente menos efectivo.',
    });
  } else {
    const len = descContent.length;
    if (len >= 120 && len <= 160) {
      score += 12;
      checks.push({
        id: 'meta-description-length',
        status: 'good',
        title: 'Meta description óptima',
        description: `${len} caracteres (ideal: 120–160).`,
        value: descContent,
      });
    } else if (len >= 80 && len <= 180) {
      score += 8;
      checks.push({
        id: 'meta-description-length',
        status: 'warning',
        title: 'Meta description mejorable',
        description: `${len} caracteres (ideal: 120–160). ${len < 120 ? 'Amplíala' : 'Acórtala'} para mayor efectividad.`,
        value: descContent,
      });
    } else {
      score += 4;
      checks.push({
        id: 'meta-description-length',
        status: 'error',
        title: len < 80 ? 'Meta description muy corta' : 'Meta description muy larga',
        description: `${len} caracteres (ideal: 120–160). Revisa la descripción.`,
        value: descContent,
      });
    }
  }

  // ── Meta Robots ───────────────────────────────────────────────────────────
  const metaRobots = doc.querySelector('meta[name="robots"]');
  if (metaRobots) {
    const content = (metaRobots.getAttribute('content') || '').toLowerCase();
    if (content.includes('noindex')) {
      checks.push({
        id: 'meta-robots-noindex',
        status: 'error',
        title: 'Página marcada como noindex',
        description: 'Los motores de búsqueda no indexarán esta página. Verifica si es intencional.',
        value: content,
      });
    } else if (content.includes('nofollow')) {
      score += 5;
      checks.push({
        id: 'meta-robots-nofollow',
        status: 'warning',
        title: 'Meta robots con nofollow',
        description: 'Los bots no seguirán los enlaces de esta página.',
        value: content,
      });
    } else {
      score += 8;
      checks.push({
        id: 'meta-robots-ok',
        status: 'good',
        title: 'Meta robots correcta',
        description: 'La página es indexable y rastreable.',
        value: content,
      });
    }
  } else {
    score += 5;
    checks.push({
      id: 'meta-robots-missing',
      status: 'info',
      title: 'Meta robots no especificada',
      description: 'Sin esta etiqueta, los bots usan el comportamiento por defecto (index, follow).',
    });
  }

  // ── Canonical ─────────────────────────────────────────────────────────────
  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical) {
    const href = canonical.getAttribute('href') || '';
    score += 8;
    checks.push({
      id: 'canonical-present',
      status: 'good',
      title: 'URL canónica presente',
      description: 'Evita contenido duplicado señalando la URL preferida.',
      value: href,
    });
  } else {
    checks.push({
      id: 'canonical-missing',
      status: 'warning',
      title: 'URL canónica ausente',
      description: 'Agrega <link rel="canonical"> para evitar penalizaciones por contenido duplicado.',
    });
  }

  // ── Headings ─────────────────────────────────────────────────────────────
  const h1s = [...doc.querySelectorAll('h1')];
  const h2s = [...doc.querySelectorAll('h2')];
  const h3s = [...doc.querySelectorAll('h3')];

  if (h1s.length === 0) {
    checks.push({
      id: 'h1-missing',
      status: 'error',
      title: 'H1 ausente',
      description: 'Toda página debe tener exactamente un H1 que describa el tema principal.',
    });
  } else if (h1s.length === 1) {
    score += 12;
    checks.push({
      id: 'h1-ok',
      status: 'good',
      title: 'H1 único presente',
      description: `"${h1s[0].textContent.trim().slice(0, 80)}"`,
      value: h1s[0].textContent.trim(),
    });
  } else {
    score += 5;
    checks.push({
      id: 'h1-multiple',
      status: 'warning',
      title: `Múltiples H1 (${h1s.length})`,
      description: 'La página tiene más de un H1. Usa solo uno para indicar el tema principal.',
      value: h1s.map(h => h.textContent.trim().slice(0, 50)).join(' | '),
    });
  }

  // Heading structure
  if (h2s.length > 0) {
    score += 5;
    checks.push({
      id: 'h2-present',
      status: 'good',
      title: `${h2s.length} subtítulos H2 encontrados`,
      description: 'Buena estructura de contenido con subtítulos H2.',
    });
  } else if (h1s.length > 0) {
    checks.push({
      id: 'h2-missing',
      status: 'warning',
      title: 'Sin H2',
      description: 'Usa H2 para organizar el contenido en secciones.',
    });
  }

  if (h3s.length > 0) {
    score += 3;
    checks.push({
      id: 'h3-present',
      status: 'good',
      title: `${h3s.length} subtítulos H3 encontrados`,
      description: 'Buena jerarquía de headings.',
    });
  }

  // ── Lang attribute ────────────────────────────────────────────────────────
  const htmlEl = doc.documentElement;
  const lang = htmlEl.getAttribute('lang') || '';
  if (lang) {
    score += 5;
    checks.push({
      id: 'lang-present',
      status: 'good',
      title: 'Atributo lang presente',
      description: 'Ayuda a los buscadores y lectores de pantalla a determinar el idioma.',
      value: lang,
    });
  } else {
    checks.push({
      id: 'lang-missing',
      status: 'warning',
      title: 'Atributo lang ausente en <html>',
      description: 'Agrega lang="es" (o el idioma correspondiente) al elemento <html>.',
    });
  }

  // ── Charset ───────────────────────────────────────────────────────────────
  const charset =
    doc.querySelector('meta[charset]') ||
    doc.querySelector('meta[http-equiv="Content-Type"]');
  if (charset) {
    score += 3;
    checks.push({
      id: 'charset-present',
      status: 'good',
      title: 'Meta charset presente',
      description: 'Declaración de codificación de caracteres encontrada.',
      value: charset.getAttribute('charset') || charset.getAttribute('content') || '',
    });
  } else {
    checks.push({
      id: 'charset-missing',
      status: 'warning',
      title: 'Meta charset ausente',
      description: 'Agrega <meta charset="UTF-8"> para declarar la codificación.',
    });
  }

  // ── Viewport ──────────────────────────────────────────────────────────────
  const viewport = doc.querySelector('meta[name="viewport"]');
  if (viewport) {
    score += 5;
    checks.push({
      id: 'viewport-present',
      status: 'good',
      title: 'Meta viewport presente',
      description: 'La página está optimizada para dispositivos móviles.',
      value: viewport.getAttribute('content') || '',
    });
  } else {
    checks.push({
      id: 'viewport-missing',
      status: 'error',
      title: 'Meta viewport ausente',
      description: 'Sin viewport la página no se adaptará correctamente en móviles. Google penaliza esto.',
    });
  }

  // Normalize score to 0-100
  const normalizedScore = Math.min(100, Math.round((score / 96) * 100));

  return {
    name: 'SEO On-Page',
    icon: '🔍',
    score: normalizedScore,
    checks,
    summary: buildSummary(checks),
  };
}

function buildSummary(checks) {
  const good = checks.filter(c => c.status === 'good').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const errors = checks.filter(c => c.status === 'error').length;
  return { good, warnings, errors };
}
