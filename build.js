const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const { markedHighlight } = require("marked-highlight");
const hljs = require('highlight.js');
const matter = require('gray-matter');

// Configure Marked with Highlight.js
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);

// --- Configuration ---
const CONFIG_PATH = './config.json';
const THEME_PATH = './theme.json';
const CONTENT_DIR = './content';
const PUBLIC_DIR = './public';
const DIST_DIR = './dist';

// --- Helpers ---
function escapeXml(unsafe) {
    if (!unsafe) return "";
    return unsafe.replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

async function generateDynamicImage(title, slug, theme, type = 'cover') {
    const dir = path.join(DIST_DIR, 'assets', type === 'hero' ? 'heroes' : 'covers');
    await fs.ensureDir(dir);
    
    // Adaptive Font Sizing & Wrapping
    let fontSize = type === 'hero' ? 80 : 64; 
    let height = type === 'hero' ? 400 : 630;
    
    if (title.length > 50) fontSize = fontSize * 0.75;
    if (title.length > 100) fontSize = fontSize * 0.75;

    const words = title.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        if (currentLine.length + words[i].length < (type === 'hero' ? 25 : 20)) { 
            currentLine += ' ' + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    if (lines.length > 4) lines = lines.slice(0, 4);

    const textSvg = lines.map((line, i) => {
        const dy = i === 0 ? "0" : "1.2em";
        return `<tspan x="50%" dy="${dy}">${escapeXml(line)}</tspan>`;
    }).join('');

    // Center vertical alignment adjustment based on line count
    const yStart = 50 - ((lines.length - 1) * 3); 

    // SVG with Theme Gradient
    const svg = `
    <svg width="1200" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${theme.colors.primary};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${theme.colors.secondary};stop-opacity:1" />
            </linearGradient>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${theme.colors.on_primary}" stroke-width="1" opacity="0.1"/>
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        <text x="50%" y="${yStart}%" dominant-baseline="middle" text-anchor="middle" font-family="'Roboto', sans-serif" font-weight="bold" font-size="${fontSize}" fill="${theme.colors.on_primary}">
            ${textSvg}
        </text>
        
        ${type !== 'hero' ? `<rect x="45%" y="85%" width="10%" height="6" fill="${theme.colors.tertiary || theme.colors.on_primary}" rx="3" />` : ''}
    </svg>
    `;
    
    // Ensure slug is safe file name (replace / with -)
    const safeFilename = slug.replace(/\//g, '-') + '.svg';
    const filePath = path.join(dir, safeFilename);
    await fs.writeFile(filePath, svg);
    return `/assets/${type === 'hero' ? 'heroes' : 'covers'}/${safeFilename}`;
}

async function generateFavicon(config, theme) {
    const iconPath = path.join(DIST_DIR, 'favicon.svg');
    if (await fs.pathExists(iconPath)) return;

    const initial = config.site_title ? config.site_title[0].toUpperCase() : 'S';
    
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="20" fill="${theme.colors.primary}" />
        <text x="50" y="50" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="60" fill="${theme.colors.on_primary}">
            ${initial}
        </text>
    </svg>`;
    
    await fs.writeFile(iconPath, svg);
    console.log('✨ Generated favicon.svg');
}

function calculateReadingTime(content) {
    const wordsPerMinute = 200;
    const words = content.replace(/[#*`]/g, '').split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
}

async function loadJSON(filepath) {
  if (await fs.pathExists(filepath)) {
    return fs.readJSON(filepath);
  }
  return {};
}

async function getFilesRecursively(dir) {
    let results = [];
    const list = await fs.readdir(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(await getFilesRecursively(filePath));
        } else {
            results.push(filePath);
        }
    }
    return results;
}

async function generateBlogRSS(posts, config) {
    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
 <title>${escapeXml(config.site_title)} - Blog</title>
 <description>${escapeXml(config.site_description)}</description>
 <link>${config.domain}/blog</link>
 <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
 <pubDate>${new Date().toUTCString()}</pubDate>
 <ttl>1800</ttl>
 ${posts.map(post => `
  <item>
   <title>${escapeXml(post.title)}</title>
   <description>${escapeXml(post.description || 'No description')}</description>
   <link>${config.domain}/blog/${post.slug}.html</link>
   <guid isPermaLink="true">${config.domain}/blog/${post.slug}.html</guid>
   <pubDate>${new Date(post.date).toUTCString()}</pubDate>
  </item>`).join('')}
</channel>
</rss>`;
    
    await fs.writeFile(path.join(DIST_DIR, 'rss.xml'), rss);
    console.log('📰 Generated Blog RSS Feed (rss.xml)');
}

async function generateTagIndicies(tagsMap, config, theme, css) {
    const tagsDir = path.join(DIST_DIR, 'tags');
    await fs.ensureDir(tagsDir);

    const sortedTags = Object.keys(tagsMap).sort();

    // 1. Tag Index Page (List of all tags)
    const tagsListHtml = sortedTags.map(tag => `
        <a href="/tags/${tag}.html" style="text-decoration:none; color:inherit;">
            <div style="padding:1rem; margin-bottom:1rem; border:1px solid #ddd; border-radius:8px; display:flex; justify-content:space-between; align-items:center; background: var(--md-sys-color-surface);">
                <span style="font-weight:bold; font-size:1.2rem;">#${tag}</span>
                <span style="background:var(--md-sys-color-primary-container); color:var(--md-sys-color-on-primary-container); padding:0.2rem 0.6rem; border-radius:12px; font-size:0.9rem;">
                    ${tagsMap[tag].length} posts
                </span>
            </div>
        </a>
    `).join('');

    const indexHtml = renderLayout(`
        <h1>Topics</h1>
        <p>Explore content by category.</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1rem; margin-top:2rem;">
            ${tagsListHtml}
        </div>
    `, 'Tags', config, css, { path: '/tags/index.html', description: 'All Topics' });

    await fs.outputFile(path.join(tagsDir, 'index.html'), indexHtml);

    // 2. Individual Tag Pages
    for (const tag of sortedTags) {
        const posts = tagsMap[tag].sort((a, b) => b.dateObj - a.dateObj);
        const postsHtml = posts.map(p => `
            <div class="card">
                 ${p.coverImage ? `<a href="/blog/${p.slug}.html"><img src="${p.coverImage}" style="height: 200px; object-fit: cover; width: 100%; margin: 0 0 1rem 0;" /></a>` : ''}
                <h2><a href="/blog/${p.slug}.html">${p.title}</a></h2>
                <p class="meta"><small>${p.date} • ${p.readingTime || ''}</small></p>
            </div>
        `).join('');

        const tagPageHtml = renderLayout(`
            <h1>#${tag}</h1>
            <p><a href="/tags/index.html">← All Topics</a></p>
            <div class="grid">${postsHtml}</div>
        `, `#${tag}`, config, css, { path: `/tags/${tag}.html`, description: `Posts tagged with ${tag}` });
        
        await fs.outputFile(path.join(tagsDir, `${tag}.html`), tagPageHtml);
    }
    console.log(`🏷️ Generated ${sortedTags.length} Tag Pages.`);
}

// ... existing code ...

// --- Layout Template ---


function generateCSS(theme) {
  if (!theme || !theme.colors) return '';
  
  // Extract font names for Google Fonts Import
  const headingFontName = theme.fonts.heading.split(',')[0].replace(/['"]/g, '').trim();
  const bodyFontName = theme.fonts.body.split(',')[0].replace(/['"]/g, '').trim();
  const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${headingFontName}:wght@400;700&family=${bodyFontName}:wght@300;400;600&display=swap`;

  return `
    @import url('${googleFontsUrl}');

    :root {
      /* Colors */
      --md-sys-color-primary: ${theme.colors.primary};
      --md-sys-color-on-primary: ${theme.colors.on_primary};
      --md-sys-color-primary-container: ${theme.colors.primary_container};
      --md-sys-color-on-primary-container: ${theme.colors.on_primary_container};
      --md-sys-color-secondary: ${theme.colors.secondary};
      --md-sys-color-secondary-container: ${theme.colors.secondary_container};
      --md-sys-color-surface: ${theme.colors.surface};
      --md-sys-color-on-surface: ${theme.colors.on_surface};
      --md-sys-color-outline: ${theme.colors.outline};
      
      /* Fonts */
      --md-sys-typescale-headline-font: ${theme.fonts.heading};
      --md-sys-typescale-body-font: ${theme.fonts.body};
      
      /* Scale */
      --md-sys-shape-corner: ${theme.scale.border_radius};
      --spacing: ${theme.scale.spacing_unit};
      
      /* Widths */
      --max-width: 900px;
    }

    /* Modern Reset */
    *, *::before, *::after { box-sizing: border-box; }
    body {
        font-family: var(--md-sys-typescale-body-font);
        background-color: var(--md-sys-color-surface);
        color: var(--md-sys-color-on-surface);
        margin: 0;
        padding: 0;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
    }

    /* Layout */
    header {
        background: var(--md-sys-color-surface);
        color: var(--md-sys-color-on-surface);
        padding: 1rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(0,0,0,0.1);
        position: sticky;
        top: 0;
        z-index: 1000;
        backdrop-filter: blur(10px);
    }
    
    header .brand h1 { margin: 0; font-size: 1.5rem; color: var(--md-sys-color-primary); }

    nav { display: flex; align-items: center; gap: 1.5rem; }
    nav a { 
        text-decoration: none; 
        color: var(--md-sys-color-on-surface); 
        font-weight: 500; 
        transition: color 0.2s;
    }
    nav a:hover { color: var(--md-sys-color-primary); }

    main {
        max-width: var(--max-width);
        margin: 3rem auto;
        padding: 0 1.5rem;
        min-height: 80vh;
    }

    footer {
        background: var(--md-sys-color-secondary-container);
        color: var(--md-sys-color-on-secondary-container);
        text-align: center;
        padding: 3rem 1rem;
        margin-top: 4rem;
    }
    
    /* Typography */
    h1, h2, h3, h4 { font-family: var(--md-sys-typescale-headline-font); color: var(--md-sys-color-on-surface); line-height: 1.2; }
    h1 { font-size: 3rem; margin-bottom: 1.5rem; color: var(--md-sys-color-primary); }
    h2 { font-size: 2rem; margin-top: 2.5rem; margin-bottom: 1rem; }
    p { margin-bottom: 1.5rem; font-size: 1.125rem; }
    a { color: var(--md-sys-color-primary); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    a:hover { color: var(--md-sys-color-secondary); }

    /* Components */
    img { max-width: 100%; height: auto; border-radius: var(--md-sys-shape-corner); display: block; margin: 2rem 0; }
    
    blockquote {
        margin: 2rem 0;
        padding-left: 1.5rem;
        border-left: 4px solid var(--md-sys-color-primary);
        font-style: italic;
        color: var(--md-sys-color-secondary);
    }

    .btn-support {
        display: inline-block;
        background: var(--md-sys-color-primary);
        color: var(--md-sys-color-on-primary) !important;
        padding: 0.6rem 1.2rem;
        border-radius: 50px;
        text-decoration: none;
        font-weight: 600;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn-support:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0,0,0,0.15);
        color: var(--md-sys-color-on-primary);
    }

    .card {
        background: white;
        border: 1px solid rgba(0,0,0,0.05);
        padding: 2rem;
        border-radius: var(--md-sys-shape-corner);
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        margin-bottom: 1.5rem;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(0,0,0,0.1);
    }
    .card h2 { margin-top: 0; font-size: 1.75rem; }
    .card h2 a { text-decoration: none; color: inherit; }
    .card h2 a:hover { color: var(--md-sys-color-primary); }

    /* Meta text */
    .meta { font-size: 0.9rem; color: var(--md-sys-color-outline); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }

    /* Mobile Responsiveness */
    @media (max-width: 768px) {
        h1 { font-size: 2.5rem; }
        header { flex-direction: column; gap: 1rem; padding: 1.5rem; }
        nav { flex-wrap: wrap; justify-content: center; gap: 1rem; }
        main { padding: 0 1rem; }
        .card { padding: 1.5rem; }
    }
  `;
}

// --- Layout Template ---
// Simple function to wrap content in full HTML document
// --- Layout Template ---
function renderLayout(bodyContent, pageTitle, config, cssContent, seo = {}) {
    const navLinks = config.nav_links.map(l => `<a href="${l.url}">${l.label}</a>`).join(' ');
    
    // Feature Links based on Config
    let featureLinks = '';
    if (config.features.blog.mode === 'internal') featureLinks += `<a href="/blog/index.html">${config.features.blog.label}</a> `;
    else if (config.features.blog.mode === 'external') featureLinks += `<a href="${config.features.blog.external_url}" target="_blank">${config.features.blog.label} <small>↗</small></a> `;

    if (config.features.events.mode === 'internal') featureLinks += `<a href="/events/index.html">${config.features.events.label}</a> `;
    else if (config.features.events.mode === 'external') featureLinks += `<a href="${config.features.events.external_url}" target="_blank">${config.features.events.label} <small>↗</small></a> `;

    if (config.features.podcast.mode === 'internal') featureLinks += `<a href="/podcast/index.html">${config.features.podcast.label}</a> `;

    // Support Link
    let supportLink = config.support_link ? `<a href="${config.support_link}" class="btn-support">Support Me ❤️</a>` : '';

    // Subscribe Section Logic
    let subscribeSection = '';
    if (config.email_subscribe_form_url) {
        subscribeSection = `
        <section class="card" style="margin-top: 2rem; border: 2px solid var(--md-sys-color-primary);">
            <h3>📬 Join the Mailing List</h3>
            <p>Get updates directly to your inbox.</p>
            <div style="text-align: center;">
                <a href="${config.email_subscribe_form_url}" target="_blank" class="btn-support" style="text-decoration:none;">Subscribe Now</a>
            </div>
        </section>`;
    }

    // SEO & Metadata Construction
    const fullTitle = `${pageTitle} | ${config.site_title}`;
    const description = seo.description || config.site_description;
    const url = seo.path ? `${config.domain}${seo.path}` : config.domain;
    const image = seo.image ? (seo.image.startsWith('http') ? seo.image : `${config.domain}${seo.image}`) : '';
    const type = seo.type || 'website';
    const publishedTime = seo.date ? new Date(seo.date).toISOString() : '';

    let jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "url": url,
        "name": fullTitle,
        "description": description,
        "author": {
            "@type": "Person",
            "name": config.author_name
        }
    };

    if (type === 'article') {
        jsonLd = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "mainEntityOfPage": { "@type": "WebPage", "@id": url },
            "headline": pageTitle,
            "description": description,
            "image": image,
            "author": { "@type": "Person", "name": config.author_name },
            "datePublished": publishedTime,
            "dateModified": publishedTime
        };
    } else if (type === 'event') {
        jsonLd = {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": pageTitle,
            "description": description,
            "startDate": publishedTime,
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "location": {
                "@type": "Place",
                "name": seo.location,
                "address": seo.location 
            },
            "image": [image],
             "organizer": {
                "@type": "Person",
                "name": config.author_name,
                "url": config.domain
            }
        };
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fullTitle}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${url}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    
    <!-- Syntax Highlight CSS -->
    ${config.code_theme ? `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${config.code_theme}.min.css">` : ''}
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${type}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${fullTitle}" />
    <meta property="og:description" content="${description}" />
    ${image ? `<meta property="og:image" content="${image}" />` : ''}

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${url}" />
    <meta property="twitter:title" content="${fullTitle}" />
    <meta property="twitter:description" content="${description}" />
    ${image ? `<meta property="twitter:image" content="${image}" />` : ''}
    ${config.twitter_handle ? `<meta property="twitter:creator" content="${config.twitter_handle}" />` : ''}

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    ${JSON.stringify(jsonLd)}
    </script>

    ${config.custom_head_html || ''}

    <style>
        ${cssContent}
        /* Basic Reset & Layout */
        body { font-family: var(--md-sys-typescale-body-font); background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); margin: 0; padding: 0; }
        header { padding: 2rem; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); display: flex; justify-content: space-between; align-items: center; }
        nav a { margin-left: 1rem; text-decoration: none; color: inherit; font-weight: bold; }
        main { max-width: 800px; margin: 2rem auto; padding: 1rem; }
        footer { text-align: center; padding: 2rem; border-top: 1px solid #ccc; margin-top: 2rem; }
        img { max-width: 100%; height: auto; border-radius: var(--md-sys-shape-corner); }
        h1, h2, h3 { font-family: var(--md-sys-typescale-headline-font); }
        .btn-support { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); padding: 0.5rem 1rem; border-radius: 20px; }
        /* Card Style */
        .card { background: white; padding: 1.5rem; border-radius: var(--md-sys-shape-corner); box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 1rem; }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <h1><a href="/" style="text-decoration:none; color:inherit;">${config.site_title}</a></h1>
        </div>
        <nav>
            ${navLinks}
            ${featureLinks}
            <button onclick="document.getElementById('searchDialog').showModal()" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:inherit;" aria-label="Search">🔍</button>
            ${supportLink}
        </nav>
    </header>
    <main>
        ${bodyContent}
        ${subscribeSection}
    </main>
    <footer>
        <p>&copy; ${new Date().getFullYear()} ${config.author_name}. Powered by SoloPlatform.</p>
        <div class="socials">
            ${Object.entries(config.social_links || {}).map(([k, v]) => `<a href="${v}">${k}</a>`).join(' | ')}
        </div>
    </footer>
    <dialog id="searchDialog" style="width: 90%; max-width: 600px; border-radius: 12px; border: none; padding: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.3); backdrop-filter: blur(5px);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h2 style="margin:0; font-size:1.5rem;">Search</h2>
            <form method="dialog"><button style="background:none; border:none; cursor:pointer; font-size:1.2rem;">✕</button></form>
        </div>
        <input type="text" id="searchInput" placeholder="Type to find posts, events..." style="width:100%; padding: 1rem; font-size: 1.1rem; border: 2px solid var(--md-sys-color-outline); border-radius: 8px; margin-bottom: 1rem; outline:none;">
        <div id="searchResults" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;"></div>
    </dialog>

    <script>
        const searchInput = document.getElementById('searchInput');
        let searchIndex = null;
        
        searchInput.addEventListener('input', async (e) => {
            const q = e.target.value.toLowerCase();
            const resultsDiv = document.getElementById('searchResults');
            
            if (q.length < 2) { 
                resultsDiv.innerHTML = '<p style="color:#888; text-align:center;">Type 2+ characters...</p>'; 
                return; 
            }
            
            if (!searchIndex) {
                 try {
                    searchIndex = await fetch('/search.json').then(r => r.json());
                 } catch (err) {
                    console.error('Failed to load search index');
                    return;
                 }
            }
            
            const results = searchIndex.filter(i => 
                (i.title && i.title.toLowerCase().includes(q)) || 
                (i.description && i.description.toLowerCase().includes(q))
            );
            
            if (results.length === 0) {
                resultsDiv.innerHTML = '<p style="text-align:center;">No results found.</p>';
            } else {
                resultsDiv.innerHTML = results.map(r => \`
                    <div style="padding: 1rem; background: var(--md-sys-color-surface); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                            <span style="font-size:0.8rem; font-weight:bold; color:var(--md-sys-color-primary); text-transform:uppercase;">\${r.type}</span>
                        </div>
                        <a href="\${r.url}" style="font-size: 1.1rem; font-weight: bold; text-decoration: none; color: inherit; display: block; margin-bottom:0.25rem;">\${r.title}</a>
                        <p style="margin:0; font-size: 0.9rem; color: #666;">\${r.description.substring(0, 80)}...</p>
                    </div>
                \`).join('');
            }
        });
    </script>
</body>
</html>
    `;
}

// --- Main Build Function ---
async function build() {
    console.log('🚀 Starting Build...');

    // 1. Prepare Paths
    await fs.ensureDir(DIST_DIR);
    await fs.emptyDir(DIST_DIR);
    
    // 2. Load Configs
    const config = await loadJSON(CONFIG_PATH);
    const theme = await loadJSON(THEME_PATH);
    const css = generateCSS(theme);
    
    // 3. Copy Assets
    if (await fs.pathExists(PUBLIC_DIR)) {
        await fs.copy(PUBLIC_DIR, DIST_DIR);
        console.log('📂 Copied public assets.');
    }
    
    // Generate Favicon if missing
    await generateFavicon(config, theme);
    
    // Global Search Index
    const searchIndex = [];

    // 4. Build Home Page
    const homePath = path.join(CONTENT_DIR, 'home.md');
    let homeHtml = '<h1>Welcome</h1>';
    if (await fs.pathExists(homePath)) {
        const fileContent = await fs.readFile(homePath, 'utf-8');
        const { content, data } = matter(fileContent); // data is frontmatter
        const htmlContent = marked.parse(content);
        
        // Add Hero if exists or generate one if requested
        let heroHtml = '';
        if (data.hero_image) {
            // Check if user provided path exists in public/assets or external
            if (data.hero_image.startsWith('http') || await fs.pathExists(path.join(PUBLIC_DIR, data.hero_image.replace(/^\//, '')))) {
                 heroHtml = `<div class="hero"><img src="${data.hero_image}" alt="Hero Image"></div>`;
            } else {
                 // Generate fallback hero
                 console.log(`⚠️ Hero image not found: ${data.hero_image}. Generating fallback.`);
                 const heroPath = await generateDynamicImage(data.title || "Welcome", "home-hero", theme, "hero");
                 heroHtml = `<div class="hero"><img src="${heroPath}" alt="Hero Image"></div>`;
            }
        }
        
        homeHtml = `${heroHtml} ${htmlContent}`;
    }
    
    const fullHomeHtml = renderLayout(homeHtml, 'Home', config, css, { path: '/' });
    await fs.outputFile(path.join(DIST_DIR, 'index.html'), fullHomeHtml);
    console.log('🏠 Built Home Page.');

    // 5. Build Blog (Internal Mode)
    if (config.features.blog && config.features.blog.mode === 'internal') {
        const blogSrc = path.join(CONTENT_DIR, 'blog');
        const blogDist = path.join(DIST_DIR, 'blog');
        await fs.ensureDir(blogDist);
        
        if (await fs.pathExists(blogSrc)) {
            const files = await getFilesRecursively(blogSrc);
            const posts = [];
            const tagsMap = {}; 
            
            for (const filePath of files) {
                if (!filePath.endsWith('.md')) continue;
                
                // Calculate Slug relative to blogSrc
                const relativePath = path.relative(blogSrc, filePath);
                const slug = relativePath.replace('.md', '').replace(/\\/g, '/'); // Maintain forward slashes

                const raw = await fs.readFile(filePath, 'utf-8');
                const { content, data } = matter(raw);
                const html = marked.parse(content);
                
                // Dynamic Cover Image
                let coverImage = data.cover_image;
                if (!coverImage) {
                    coverImage = await generateDynamicImage(data.title, slug, theme);
                }
                
                // SEO Data
                const seoData = {
                    type: 'article',
                    path: `/blog/${slug}.html`,
                    image: coverImage,
                    description: content.substring(0, 150).replace(/[#*`]/g, '') + '...', // Simple excerpt
                    date: data.date
                };
                
                // Reading Time
                const readingTime = calculateReadingTime(content);

                // Giscus Comments
                let commentsSection = '';
                if (config.giscus && config.giscus.repo) {
                    commentsSection = `
                    <section style="margin-top: 4rem; border-top: 1px solid var(--md-sys-color-outline); padding-top: 2rem;">
                        <h3>💬 Comments</h3>
                        <script src="https://giscus.app/client.js"
                            data-repo="${config.giscus.repo}"
                            data-repo-id="${config.giscus.repo_id}"
                            data-category="${config.giscus.category}"
                            data-category-id="${config.giscus.category_id}"
                            data-mapping="${config.giscus.mapping}"
                            data-strict="${config.giscus.strict}"
                            data-reactions-enabled="${config.giscus.reactions_enabled}"
                            data-emit-metadata="${config.giscus.emit_metadata}"
                            data-input-position="${config.giscus.input_position}"
                            data-theme="${config.giscus.theme}"
                            data-lang="${config.giscus.lang}"
                            data-loading="${config.giscus.loading}"
                            crossorigin="anonymous"
                            async>
                        </script>
                    </section>
                    `;
                }
                
                // Tag Links
                let tagLinks = '';
                if (data.tags && Array.isArray(data.tags)) {
                    tagLinks = ` | ${data.tags.map(t => `<a href="/tags/${t}.html">#${t}</a>`).join(' ')}`;
                    // Collect for Index
                    data.tags.forEach(t => {
                        if (!tagsMap[t]) tagsMap[t] = [];
                        tagsMap[t].push({ ...data, slug, dateObj: new Date(data.date), coverImage, readingTime });
                    });
                }

                // Save Individual Post
                const postHtml = renderLayout(`
                    <article>
                        <h1>${data.title}</h1>
                        <p class="meta"><small>${data.date} | ${readingTime}${tagLinks}</small></p>
                        <img src="${coverImage}" alt="Cover Image" style="margin-bottom: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
                        <div class="content">${html}</div>
                        ${commentsSection}
                    </article>
                `, data.title, config, css, seoData);
                
                await fs.outputFile(path.join(blogDist, `${slug}.html`), postHtml);
                posts.push({ ...data, slug, dateObj: new Date(data.date), coverImage, readingTime });
                searchIndex.push({ title: data.title, type: 'Blog', url: `/blog/${slug}.html`, description: seoData.description });
            }
            
            // Build Blog Index
            posts.sort((a, b) => b.dateObj - a.dateObj);
            const listHtml = posts.map(p => `
                <div class="card">
                    ${p.coverImage ? `<a href="/blog/${p.slug}.html"><img src="${p.coverImage}" style="height: 200px; object-fit: cover; width: 100%; margin: 0 0 1rem 0;" /></a>` : ''}
                    <h2><a href="/blog/${p.slug}.html">${p.title}</a></h2>
                    <p class="meta"><small>${p.date} • ${p.readingTime || ''}</small></p>
                </div>
            `).join('');
            
            const indexHtml = renderLayout(`
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h1>Blog</h1>
                    <div>
                        <a href="/tags/index.html" class="btn-support">Topics 🏷️</a>
                        <a href="/rss.xml" class="btn-support" style="margin-left:0.5rem">RSS 📶</a>
                    </div>
                </div>
                ${listHtml}
            `, 'Blog', config, css, { path: '/blog/index.html', description: 'Latest blog posts' });
            await fs.outputFile(path.join(blogDist, 'index.html'), indexHtml);
            
            console.log(`📝 Built Blog (${posts.length} posts).`);
            
            // Generate RSS & Tag Pages
            await generateBlogRSS(posts, config);
            await generateTagIndicies(tagsMap, config, theme, css);
        }
    }

    // 6. Build Events (Internal Mode)
    if (config.features.events && config.features.events.mode === 'internal') {
        const eventsSrc = path.join(CONTENT_DIR, 'events');
        const eventsDist = path.join(DIST_DIR, 'events');
        await fs.ensureDir(eventsDist);
        
        if (await fs.pathExists(eventsSrc)) {
            const files = await getFilesRecursively(eventsSrc);
            const events = [];
            
            for (const filePath of files) {
                if (!filePath.endsWith('.md')) continue;
                
                 // Calculate Slug
                const relativePath = path.relative(eventsSrc, filePath);
                const slug = relativePath.replace('.md', '').replace(/\\/g, '/');

                const raw = await fs.readFile(filePath, 'utf-8');
                const { content, data } = matter(raw);
                const html = marked.parse(content);
                
                // RSVP Button Logic
                let rsvpBtn = '';
                if (data.rsvp_link) {
                    rsvpBtn = `<a href="${data.rsvp_link}" target="_blank" class="btn-support">RSVP / Register 🎟️</a>`;
                }

                const seoData = {
                    type: 'event',
                    path: `/events/${slug}.html`,
                    date: data.event_date,
                    location: data.location,
                    description: `Event: ${data.title} at ${data.location}`
                };

                // Save Individual Event Page
                const eventHtml = renderLayout(`
                    <article>
                        <h1>${data.title}</h1>
                        <p class="meta"><strong>📅 Date:</strong> ${data.event_date} | <strong>📍 Location:</strong> ${data.location}</p>
                        ${rsvpBtn}
                        <hr>
                        <div class="content">${html}</div>
                    </article>
                `, data.title, config, css, seoData);
                
                await fs.outputFile(path.join(eventsDist, `${slug}.html`), eventHtml);
                events.push({ ...data, slug, dateObj: new Date(data.event_date) });
                searchIndex.push({ title: data.title, type: 'Event', url: `/events/${slug}.html`, description: seoData.description });
            }
            
            // Build Events Index
            events.sort((a, b) => a.dateObj - b.dateObj); // Ascending for upcoming
            const listHtml = events.map(e => `
                <div class="card">
                    <h2><a href="/events/${e.slug}.html">${e.title}</a></h2>
                    <p>📅 ${e.event_date} @ ${e.location}</p>
                    ${e.rsvp_link ? `<a href="${e.rsvp_link}" target="_blank">RSVP ↗</a>` : ''}
                </div>
            `).join('');
            
            const indexHtml = renderLayout(`<h1>Upcoming Events</h1>${listHtml}`, 'Events', config, css, { path: '/events/index.html' });
            await fs.outputFile(path.join(eventsDist, 'index.html'), indexHtml);
            console.log(`📅 Built Events (${events.length} events).`);
        }
    }

    // 7. Build Podcast (Internal Mode)
    if (config.features.podcast && config.features.podcast.mode === 'internal') {
        const podSrc = path.join(CONTENT_DIR, 'podcast');
        const podDist = path.join(DIST_DIR, 'podcast');
        await fs.ensureDir(podDist);
        
        if (await fs.pathExists(podSrc)) {
            const files = await getFilesRecursively(podSrc);
            const episodes = [];
            
            for (const filePath of files) {
                if (!filePath.endsWith('.md')) continue;
                
                  // Calculate Slug
                const relativePath = path.relative(podSrc, filePath);
                const slug = relativePath.replace('.md', '').replace(/\\/g, '/');

                const raw = await fs.readFile(filePath, 'utf-8');
                const { content, data } = matter(raw);
                const html = marked.parse(content);
                
                // Audio Player logic
                let audioPlayer = '';
                if (data.audio_url) {
                    audioPlayer = `<audio controls src="${data.audio_url}" style="width:100%; margin: 1rem 0;"></audio>
                                    <p><a href="${data.audio_url}" download>Download MP3</a></p>`;
                }
                
                const seoData = {
                    path: `/podcast/${slug}.html`,
                    date: data.date,
                    description: `Podcast Episode: ${data.title}`
                };

                // Save Episode Page
                const epHtml = renderLayout(`
                    <article>
                        <h1>${data.title}</h1>
                        <p class="meta">Posted: ${data.date} | Duration: ${data.duration}</p>
                        ${audioPlayer}
                        <div class="content">${html}</div>
                    </article>
                `, data.title, config, css, seoData);
                
                await fs.outputFile(path.join(podDist, `${slug}.html`), epHtml);
                episodes.push({ ...data, slug, html, dateObj: new Date(data.date) });
                searchIndex.push({ title: data.title, type: 'Podcast', url: `/podcast/${slug}.html`, description: seoData.description });
            }
            
            // Build Podcast Index
            episodes.sort((a, b) => b.dateObj - a.dateObj);
            const listHtml = episodes.map(e => `
                <div class="card">
                    <h2><a href="/podcast/${e.slug}.html">${e.title}</a></h2>
                    <p>🎧 ${e.duration}</p>
                    <small>${e.date}</small>
                </div>
            `).join('');
            
            const indexHtml = renderLayout(`<h1>Podcast Episodes</h1>${listHtml}`, 'Podcast', config, css, { path: '/podcast/index.html' });
            await fs.outputFile(path.join(podDist, 'index.html'), indexHtml);
            
            
            // Generate RSS Feed (basic)
            const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
 <title>${config.site_title} Podcast</title>
 <description>${config.site_description}</description>
 <link>${config.domain || 'https://example.com'}</link>
 ${episodes.map(e => `
   <item>
    <title>${e.title}</title>
    <link>${config.domain || 'https://example.com'}/podcast/${e.slug}.html</link>
    <description><![CDATA[${e.html}]]></description>
    <enclosure url="${e.audio_url}" length="${e.length_bytes || 0}" type="audio/mpeg" />
    <pubDate>${e.dateObj.toUTCString()}</pubDate>
   </item>
 `).join('')}
</channel>
</rss>`;
            await fs.outputFile(path.join(DIST_DIR, 'feed.xml'), rssXml);
            console.log(`🎙️ Built Podcast (${episodes.length} episodes) & RSS Feed.`);
        }
    }

    // 8. Build Sitemap & Robots.txt
    const domain = config.domain || 'https://example.com';
    const today = new Date().toISOString();
    
    // Collect specific URLs
    const sitemapUrls = [
        { loc: `${domain}/`, priority: '1.0' },
        { loc: `${domain}/index.html`, priority: '0.8' }
    ];

    // Helper to add Feature Indexes
    if (config.features.blog?.mode === 'internal') sitemapUrls.push({ loc: `${domain}/blog/index.html`, priority: '0.9' });
    if (config.features.events?.mode === 'internal') sitemapUrls.push({ loc: `${domain}/events/index.html`, priority: '0.9' });
    if (config.features.podcast?.mode === 'internal') sitemapUrls.push({ loc: `${domain}/podcast/index.html`, priority: '0.9' });

    // Read generated files to populate sitemap (simple discovery of what we just built)
    // Actually, we can just walk the dist folder or use the lists we already have if we scoped them higher.
    // For simplicity/robustness, let's walk the dist folder for .html files.
    async function getFiles(dir) {
        let results = [];
        const list = await fs.readdir(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            if (stat && stat.isDirectory()) {
                // Recursive call
                const subResults = await getFiles(filePath);
                results = results.concat(subResults);
            } else if (file.endsWith('.html')) {
                results.push(filePath);
            }
        }
        return results;
    }

    const allHtml = await getFiles(DIST_DIR);
    const uniqueUrls = new Set(sitemapUrls.map(u => u.loc));

    const xmlItems = sitemapUrls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('');

    // Add all other HTML files not explicitly added
    const dynamicItems = allHtml.map(p => {
        const relPath = path.relative(DIST_DIR, p).replace(/\\/g, '/');
        const url = `${domain}/${relPath}`;
        if (!uniqueUrls.has(url)) {
            return `
  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <priority>0.6</priority>
  </url>`;
        }
        return '';
    }).join('');

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
${dynamicItems}
</urlset>`;

    await fs.outputFile(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml);
    console.log('🗺️ Built sitemap.xml');

    const robotsTxt = `User-agent: *
Allow: /
Sitemap: ${domain}/sitemap.xml`;
    await fs.outputFile(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
     console.log('🤖 Built robots.txt');

    // 9. Client-Side Search Index
    await fs.outputFile(path.join(DIST_DIR, 'search.json'), JSON.stringify(searchIndex));
    console.log('🔍 Built search.json');

    console.log('✅ Build Complete!');
}

build().catch(err => console.error(err));
