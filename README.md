# 🔎 Web-Detect — Analizador SEO Web

![Estado](https://img.shields.io/badge/estado-activo-brightgreen)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-listo-blue)
![Licencia](https://img.shields.io/badge/licencia-MIT-purple)
![Tecnología](https://img.shields.io/badge/tecnología-Vanilla%20JS-yellow)

> Analiza el SEO de cualquier sitio web al instante — 100% frontend, sin backend, listo para GitHub Pages.

---

## 🚀 Demo

Puedes ver el proyecto en vivo en: `https://retr0zer07.github.io/Web-Detect/`

---

## ✨ Características

- 🔍 **SEO On-Page** — title, meta description, robots, canonical, headings H1-H6, lang, charset, viewport
- 🔑 **Palabras Clave** — extracción de keywords, densidad, keyword stuffing, nube de palabras
- 📊 **Schema & Datos Estructurados** — JSON-LD, Open Graph, Twitter Cards, Microdata
- 🏗️ **Estructura HTML** — imágenes sin alt, links vacíos, HTML semántico, profundidad DOM, ratio texto/HTML, formularios, tablas
- ⚡ **Performance** — scripts bloqueantes, lazy loading, CLS hints, preload/preconnect, favicon
- 📱 **Redes Sociales** — Open Graph completo, Twitter Card, score de presencia social
- 🌙 **Dark/Light mode** con persistencia en localStorage
- 📥 **Exportar reporte en JSON**
- 📈 **Score general** tipo gauge circular (0–100)
- 🎯 **Recomendaciones prioritarias** con los 5 issues más críticos

---

## 📋 Módulos de Análisis

| Módulo | Peso | Qué analiza |
|---|---|---|
| 🔍 SEO On-Page | 30% | title, meta description, robots, canonical, headings, lang, charset, viewport |
| 🔑 Palabras Clave | 20% | densidad, stuffing, keywords en title/H1/meta, nube visual |
| 📊 Schema | 15% | JSON-LD, Open Graph (7 campos), Twitter Cards (6 campos), Microdata |
| 🏗️ Estructura HTML | 15% | alt en imágenes, links descriptivos, HTML semántico, DOM depth, ratio texto |
| ⚡ Performance | 12% | scripts bloqueantes, lazy loading, dimensiones de imágenes, preload, favicon |
| 📱 Redes Sociales | 8% | completitud OG y Twitter Card, hints de dimensiones |

---

## 🛠️ Tecnologías

- **HTML5** — estructura semántica
- **CSS3** — variables, animaciones, grid, modo oscuro/claro
- **JavaScript ES6+** — módulos (`type="module"`), async/await, DOMParser
- **AllOrigins** — proxy CORS para obtener HTML de URLs externas
- **Google Fonts** — Inter

---

## 📦 Estructura de Archivos

```
Web-Detect/
├── index.html                  # UI principal
├── css/
│   └── styles.css              # Estilos con temas claro/oscuro
├── js/
│   ├── app.js                  # Orquestador principal
│   ├── analyzer.js             # Motor de análisis (CORS proxy + DOMParser)
│   ├── report.js               # Generador de reportes y renderizado
│   └── modules/
│       ├── seo.js              # SEO On-Page
│       ├── keywords.js         # Palabras clave
│       ├── schema.js           # Schema & datos estructurados
│       ├── structure.js        # Estructura HTML
│       ├── performance.js      # Hints de performance
│       └── social.js           # Redes sociales
└── README.md
```

---

## 🖥️ Uso

1. **Abre** `index.html` en tu navegador (o visita la URL de GitHub Pages)
2. **Ingresa** la URL del sitio web que deseas analizar
3. **Haz clic** en "🔍 Analizar"
4. **Explora** los resultados por módulo en las pestañas
5. **Exporta** el reporte en JSON con el botón "📥 Exportar JSON"

### URLs de prueba sugeridas

```
https://es.wikipedia.org/wiki/SEO
https://www.github.com
https://developer.mozilla.org/es/docs/Web
https://www.bbc.com
```

> **Nota:** Algunas páginas pueden bloquear el proxy CORS. En ese caso, intenta con otras URLs públicas.

---

## 🚀 Despliegue en GitHub Pages

1. Haz **fork** o clona este repositorio
2. Ve a **Settings → Pages**
3. En "Source" selecciona **Branch: main** y carpeta **/ (root)**
4. Haz clic en **Save**
5. Tu app estará disponible en `https://TU_USUARIO.github.io/Web-Detect/`

---

## 🔧 Cómo funciona

```
Usuario ingresa URL
        ↓
   Validación URL (JS)
        ↓
   fetch via AllOrigins CORS Proxy
   https://api.allorigins.win/get?url=...
        ↓
   DOMParser → Document object
        ↓
   ┌─────────────────────────┐
   │  Módulos de análisis    │
   │  • seo.js               │
   │  • keywords.js          │
   │  • schema.js            │
   │  • structure.js         │
   │  • performance.js       │
   │  • social.js            │
   └─────────────────────────┘
        ↓
   report.js → Score ponderado + HTML
        ↓
   Resultados en pantalla
```

---

## 📄 Licencia

MIT © 2025 [retr0zer07](https://github.com/retr0zer07)
