const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const POSTS_DIR = './posts';
const DRAFTS_DIR = './drafts';
const OUT_DIR = './dist';
const DEV_SERVER_PORT = 8001;
const DEV_HOSTS = new Set(['localhost', '127.0.0.1']);
const scriptSrcPattern = /(<script\s+[^>]*src=")script\.js("[^>]*><\/script>)/gi;

function injectLiveReload(html) {
    const script = `\n<script>\n    (function() {\n        try {\n            var source = new EventSource('/__livereload');\n            source.addEventListener('reload', function() {\n                window.location.reload();\n            });\n        } catch (err) {\n            console.warn('Live reload unavailable', err);\n        }\n    })();\n</script>\n`;

    if (html.includes('/__livereload')) {
        return html;
    }

    const closingBodyIndex = html.lastIndexOf('</body>');
    if (closingBodyIndex === -1) {
        return html + script;
    }

    return html.slice(0, closingBodyIndex) + script + html.slice(closingBodyIndex);
}

function fixScriptSrc(html) {
    return html.replace(scriptSrcPattern, '$1../script.js$2');
}

function adjustHtmlOutput(html) {
    const fixed = fixScriptSrc(html);
    const host = process.env.HOST || 'localhost';
    const port = Number(process.env.PORT) || DEV_SERVER_PORT;
    if (DEV_HOSTS.has(host) && port === DEV_SERVER_PORT) {
        return injectLiveReload(fixed);
    }
    return fixed;
}

const template = (title, date, content, isDraft = false) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Fahru's Finite Space</title>
    <script>
        (function() {
            const theme = localStorage.getItem('theme') || 'noon';
            document.documentElement.setAttribute('data-theme', theme);
        })();
    </script>
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Source+Code+Pro&display=swap" rel="stylesheet">
</head>
<body>
    <header class="container post-page-header">
        <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme"></button>
    </header>
    <div id="navbar"></div>

    <main class="container container-post">
        <article class="post-full">
            <header class="post-header">
                <h1>${title}</h1>
                <p class="post-meta">Published on ${date} by yours truly</p>
            </header>

            <div class="post-content">
${content}
            </div>
        </article>
    </main>

    <footer class="container">
        <p>&#8508; Hi, there &#8508; · <a href="https://fahru.me">Main Site</a> · <a href="/rss.xml">RSS</a></p>
    </footer>

    <script src="/script.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>
        hljs.highlightAll();
        document.querySelectorAll('pre code').forEach((block) => {
            // Store original text for copy functionality
            block.dataset.rawCode = block.textContent;
            
            // Add language label
            const lang = block.className.match(/language-(\\w+)/)?.[1];
            if (lang) {
                const label = document.createElement('span');
                label.className = 'code-lang';
                label.textContent = lang;
                block.parentElement.insertBefore(label, block);
            }
            
            // Add copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-copy-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(block.dataset.rawCode);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => copyBtn.textContent = 'Copy', 2000);
                } catch (err) {
                    copyBtn.textContent = 'Failed';
                    setTimeout(() => copyBtn.textContent = 'Copy', 2000);
                }
            });
            block.parentElement.insertBefore(copyBtn, block);
            
            // Add line numbers (outside code element to avoid hljs re-processing)
            const lines = block.innerHTML.split('\\n');
            const lineNumbers = document.createElement('span');
            lineNumbers.className = 'line-numbers';
            lineNumbers.setAttribute('aria-hidden', 'true');
            lineNumbers.innerHTML = Array.from({length: lines.length}, (_, i) => 
                \`<span class="line-number">\${i + 1}</span>\`
            ).join('\\n');
            block.parentElement.insertBefore(lineNumbers, block);
        });
    </script>

</body>
</html>
`;

function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: content };
    
    const meta = {};
    match[1].split('\n').forEach(line => {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) {
            meta[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
        }
    });
    return { meta, body: match[2] };
}

// Create dist directory
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Copy static files
const staticFiles = ['index.html', 'style.css', 'script.js', 'airfoil-simulation.html', '_headers'];
staticFiles.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(OUT_DIR, file));
    }
});

// Copy assets folder
if (fs.existsSync('./assets')) {
    fs.cpSync('./assets', path.join(OUT_DIR, 'assets'), { recursive: true });
}

// Copy draft images referenced by markdown (e.g., ../image.png from dist/slug/index.html)
const draftImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);
if (fs.existsSync(DRAFTS_DIR)) {
    const assetsOutDir = path.join(OUT_DIR, 'assets');
    if (!fs.existsSync(assetsOutDir)) {
        fs.mkdirSync(assetsOutDir, { recursive: true });
    }
    fs.readdirSync(DRAFTS_DIR).forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (!draftImageExtensions.has(ext)) {
            return;
        }
        const sourcePath = path.join(DRAFTS_DIR, file);
        const destPath = path.join(OUT_DIR, file);
        fs.copyFileSync(sourcePath, destPath);
        fs.copyFileSync(sourcePath, path.join(assetsOutDir, file));
    });
}

// Build markdown posts
const postFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
const postsData = postFiles.map(file => {
    const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { meta, body } = parseFrontmatter(content);
    const html = marked(body);
    const slug = meta.slug || file.replace('.md', '');
    return { meta, html, slug, file, isDraft: false };
});

// Parse HTML frontmatter from HTML comment block
function parseHtmlFrontmatter(content) {
    const match = content.match(/^<!--\s*\n---\n([\s\S]*?)\n---\s*\n-->/);
    if (!match) return { meta: {} };
    
    const meta = {};
    match[1].split('\n').forEach(line => {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) {
            meta[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
        }
    });
    return { meta };
}

// Copy and process HTML files from drafts
const draftHtmlData = [];
if (fs.existsSync(DRAFTS_DIR)) {
    const draftHtmlFiles = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.html'));
    draftHtmlFiles.forEach(file => {
        const content = fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf-8');
        const { meta } = parseHtmlFrontmatter(content);
        const slug = meta.slug || file.replace('.html', '');
        
        const htmlDir = path.join(OUT_DIR, slug);
        if (!fs.existsSync(htmlDir)) {
            fs.mkdirSync(htmlDir, { recursive: true });
        }
        const outputPath = path.join(htmlDir, 'index.html');
        fs.copyFileSync(path.join(DRAFTS_DIR, file), outputPath);
        const rawHtml = fs.readFileSync(outputPath, 'utf-8');
        fs.writeFileSync(outputPath, adjustHtmlOutput(rawHtml));
        console.log(`Copied draft HTML: ${slug}/index.html`);
        
        if (meta.title) {
            draftHtmlData.push({ meta, slug, file, isDraft: true, isHtml: true });
        }
    });
}

// Build drafts
const draftFiles = fs.existsSync(DRAFTS_DIR) 
    ? fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md'))
    : [];
const draftsData = draftFiles.map(file => {
    const content = fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf-8');
    const { meta, body } = parseFrontmatter(content);
    const html = marked(body);
    const slug = meta.slug || file.replace('.md', '');
    return { meta, html, slug, file, isDraft: true };
});

const allPosts = [...postsData, ...draftsData, ...draftHtmlData];

// Generate HTML pages for each post.
// Each post is written to its own directory (e.g., dist/ssh-tunnel/index.html)
// so the URL can be /ssh-tunnel instead of /ssh-tunnel.html
// Skip HTML drafts as they're already copied directly
allPosts.filter(p => !p.isHtml).forEach(({ meta, html, slug, isDraft }) => {
    const output = template(meta.title || 'Untitled', meta.date || '', html, isDraft);
    const postDir = path.join(OUT_DIR, slug);
    if (!fs.existsSync(postDir)) {
        fs.mkdirSync(postDir, { recursive: true });
    }
    fs.writeFileSync(path.join(postDir, 'index.html'), adjustHtmlOutput(output));
    console.log(`Built: ${slug}/index.html${isDraft ? ' (draft)' : ''}`);
});

// Generate posts.json for dynamic listing on homepage
const postsJson = allPosts
    .filter(p => p.meta.date)
    .sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date))
    .map(({ meta, slug, isDraft }) => ({
        title: meta.title || 'Untitled',
        date: meta.date,
        slug,
        description: meta.description || '',
        isDraft
    }));
fs.writeFileSync(path.join(OUT_DIR, 'posts.json'), JSON.stringify(postsJson, null, 2));
console.log('Built: posts.json');

// Generate RSS feed
const SITE_URL = 'https://blog.fahru.me';
const rssItems = postsData
    .filter(p => p.meta.date)
    .sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date))
    .map(({ meta, html, slug }) => {
        const pubDate = new Date(meta.date).toUTCString();
        return `    <item>
      <title><![CDATA[${meta.title || 'Untitled'}]]></title>
      <link>${SITE_URL}/${slug}</link>
      <guid>${SITE_URL}/${slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${html}]]></description>
    </item>`;
    })
    .join('\n');

const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Fahru's Finite Space</title>
    <link>${SITE_URL}</link>
    <description>A blog by Fahru</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

fs.writeFileSync(path.join(OUT_DIR, 'rss.xml'), rssFeed);
console.log('Built: rss.xml');

console.log('Build complete!');
