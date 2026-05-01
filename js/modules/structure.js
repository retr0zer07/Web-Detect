/**
 * structure.js — HTML structure & accessibility analysis
 */

export function analyzeStructure(doc, url) {
  const checks = [];
  let score = 0;

  // ── Images without alt ────────────────────────────────────────────────────
  const images = [...doc.querySelectorAll('img')];
  const imgsNoAlt = images.filter(img => !img.hasAttribute('alt'));
  const imgsEmptyAlt = images.filter(img => img.hasAttribute('alt') && img.getAttribute('alt').trim() === '');
  const imgsGoodAlt = images.length - imgsNoAlt.length - imgsEmptyAlt.length;

  if (images.length === 0) {
    checks.push({
      id: 'no-images',
      status: 'info',
      title: 'No se encontraron imágenes',
      description: 'La página no tiene elementos <img>.',
    });
  } else if (imgsNoAlt.length === 0 && imgsEmptyAlt.length === 0) {
    score += 15;
    checks.push({
      id: 'alt-all-good',
      status: 'good',
      title: `Todas las imágenes tienen alt (${images.length})`,
      description: 'Excelente accesibilidad. Todos los <img> tienen atributo alt.',
    });
  } else {
    if (imgsNoAlt.length > 0) {
      checks.push({
        id: 'alt-missing',
        status: 'error',
        title: `${imgsNoAlt.length} imagen(es) sin atributo alt`,
        description: 'Las imágenes sin alt son inaccesibles para lectores de pantalla y no aportan SEO.',
        value: imgsNoAlt.slice(0, 3).map(img => img.getAttribute('src') || '[sin src]').join(', '),
      });
    }
    if (imgsEmptyAlt.length > 0) {
      score += 5;
      checks.push({
        id: 'alt-empty',
        status: 'warning',
        title: `${imgsEmptyAlt.length} imagen(es) con alt vacío`,
        description: 'Alt vacío es válido para imágenes decorativas, pero verifica que sea intencional.',
      });
    }
    if (imgsGoodAlt > 0) {
      score += Math.min(10, imgsGoodAlt * 2);
    }
  }

  // ── Links without descriptive text ───────────────────────────────────────
  const links = [...doc.querySelectorAll('a')];
  const emptyLinks = links.filter(a => {
    const text = a.textContent.trim();
    const hasImg = a.querySelector('img[alt]');
    const ariaLabel = a.getAttribute('aria-label');
    return !text && !hasImg && !ariaLabel;
  });

  if (links.length > 0) {
    if (emptyLinks.length === 0) {
      score += 10;
      checks.push({
        id: 'links-descriptive',
        status: 'good',
        title: `Todos los links tienen texto descriptivo (${links.length} total)`,
        description: 'Buena accesibilidad y SEO en los enlaces.',
      });
    } else {
      checks.push({
        id: 'links-empty',
        status: 'warning',
        title: `${emptyLinks.length} enlace(s) sin texto descriptivo`,
        description: 'Los enlaces vacíos no aportan contexto a bots ni lectores de pantalla.',
        value: `${emptyLinks.length} de ${links.length} enlaces`,
      });
      score += 5;
    }
  }

  // ── Semantic HTML tags ────────────────────────────────────────────────────
  const semanticTags = ['header', 'nav', 'main', 'footer', 'article', 'section', 'aside'];
  const presentTags = semanticTags.filter(tag => doc.querySelector(tag));
  const missingTags = semanticTags.filter(tag => !doc.querySelector(tag));

  const semanticScore = Math.round((presentTags.length / semanticTags.length) * 20);
  score += semanticScore;

  if (presentTags.length >= 5) {
    checks.push({
      id: 'semantic-html-good',
      status: 'good',
      title: `Buen uso de HTML semántico (${presentTags.length}/${semanticTags.length} etiquetas)`,
      description: `Encontradas: ${presentTags.join(', ')}.`,
      value: presentTags.join(', '),
    });
  } else if (presentTags.length >= 3) {
    checks.push({
      id: 'semantic-html-partial',
      status: 'warning',
      title: `HTML semántico parcial (${presentTags.length}/${semanticTags.length})`,
      description: `Faltan: ${missingTags.join(', ')}. El HTML semántico mejora accesibilidad y SEO.`,
      value: `Presentes: ${presentTags.join(', ')}`,
    });
  } else {
    checks.push({
      id: 'semantic-html-poor',
      status: 'error',
      title: `Poco uso de HTML semántico (${presentTags.length}/${semanticTags.length})`,
      description: `Agrega etiquetas como: ${missingTags.slice(0, 4).join(', ')}. Mejoran la estructura y el SEO.`,
    });
  }

  // ── DOM depth ─────────────────────────────────────────────────────────────
  function getMaxDepth(el, currentDepth = 0) {
    if (!el.children || el.children.length === 0) return currentDepth;
    let max = currentDepth;
    for (const child of el.children) {
      const depth = getMaxDepth(child, currentDepth + 1);
      if (depth > max) max = depth;
      if (max > 20) break; // cap for performance
    }
    return max;
  }

  const domDepth = getMaxDepth(doc.body || doc.documentElement);

  if (domDepth <= 12) {
    score += 8;
    checks.push({
      id: 'dom-depth-good',
      status: 'good',
      title: `Profundidad del DOM aceptable (${domDepth} niveles)`,
      description: 'Estructura DOM bien organizada.',
    });
  } else if (domDepth <= 15) {
    score += 5;
    checks.push({
      id: 'dom-depth-warning',
      status: 'warning',
      title: `DOM moderadamente profundo (${domDepth} niveles)`,
      description: 'Considera simplificar la estructura HTML.',
    });
  } else {
    checks.push({
      id: 'dom-depth-deep',
      status: 'error',
      title: `DOM excesivamente profundo (${domDepth}+ niveles)`,
      description: 'Un DOM muy anidado puede ralentizar el renderizado y dificultar el rastreo.',
    });
  }

  // ── Text vs HTML ratio ────────────────────────────────────────────────────
  const htmlLength = doc.documentElement.innerHTML.length;
  const textLength = (doc.body?.textContent || '').trim().length;
  const ratio = htmlLength > 0 ? Math.round((textLength / htmlLength) * 100) : 0;

  if (ratio >= 15) {
    score += 8;
    checks.push({
      id: 'text-ratio-good',
      status: 'good',
      title: `Ratio texto/HTML bueno (${ratio}%)`,
      description: 'El contenido textual es proporcional al código HTML.',
    });
  } else if (ratio >= 8) {
    score += 4;
    checks.push({
      id: 'text-ratio-ok',
      status: 'warning',
      title: `Ratio texto/HTML bajo (${ratio}%)`,
      description: 'Más del 85% del código es HTML/CSS/JS. Considera simplificar el marcado.',
    });
  } else {
    checks.push({
      id: 'text-ratio-poor',
      status: 'error',
      title: `Ratio texto/HTML muy bajo (${ratio}%)`,
      description: 'Muy poco contenido textual respecto al código. Puede afectar la indexación.',
    });
  }

  // ── Forms without labels ──────────────────────────────────────────────────
  const inputs = [...doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')];
  if (inputs.length > 0) {
    const noLabel = inputs.filter(input => {
      const id = input.getAttribute('id');
      const hasLabel = id ? doc.querySelector(`label[for="${id}"]`) : null;
      const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
      const parentLabel = input.closest('label');
      return !hasLabel && !hasAriaLabel && !parentLabel;
    });

    if (noLabel.length === 0) {
      score += 8;
      checks.push({
        id: 'form-labels-ok',
        status: 'good',
        title: `Formulario accesible (${inputs.length} inputs con label)`,
        description: 'Todos los campos tienen label o aria-label.',
      });
    } else {
      checks.push({
        id: 'form-labels-missing',
        status: 'error',
        title: `${noLabel.length} input(s) sin label`,
        description: 'Los campos sin label son inaccesibles. Agrega <label for="..."> o aria-label.',
        value: `${noLabel.length} de ${inputs.length} sin label`,
      });
    }
  }

  // ── Tables ────────────────────────────────────────────────────────────────
  const tables = [...doc.querySelectorAll('table')];
  if (tables.length > 0) {
    const tablesNoCaption = tables.filter(t => !t.querySelector('caption'));
    const tablesNoTh = tables.filter(t => !t.querySelector('th'));

    if (tablesNoCaption.length === 0 && tablesNoTh.length === 0) {
      score += 5;
      checks.push({
        id: 'tables-accessible',
        status: 'good',
        title: `Tablas accesibles (${tables.length} total)`,
        description: 'Todas las tablas tienen <caption> y <th>.',
      });
    } else {
      const issues = [];
      if (tablesNoCaption.length > 0) issues.push(`${tablesNoCaption.length} sin <caption>`);
      if (tablesNoTh.length > 0) issues.push(`${tablesNoTh.length} sin <th>`);
      checks.push({
        id: 'tables-inaccessible',
        status: 'warning',
        title: `Tablas con problemas de accesibilidad`,
        description: `${issues.join(', ')}. Las tablas sin caption y th son difíciles de entender.`,
        value: issues.join(', '),
      });
    }
  }

  const normalizedScore = Math.min(100, Math.round((score / 84) * 100));

  return {
    name: 'Estructura HTML',
    icon: '🏗️',
    score: normalizedScore,
    checks,
    stats: {
      totalImages: images.length,
      totalLinks: links.length,
      semanticTagsPresent: presentTags.length,
      domDepth,
      textRatio: ratio,
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
