const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const POSTS_DIR = './posts';
const DRAFTS_DIR = './drafts';
const OUT_DIR = './dist';

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
                <h2>${title}</h2>
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
const staticFiles = ['index.html', 'style.css', 'script.js', 'airfoil-simulation.html'];
staticFiles.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(OUT_DIR, file));
    }
});

// Copy assets folder
if (fs.existsSync('./assets')) {
    fs.cpSync('./assets', path.join(OUT_DIR, 'assets'), { recursive: true });
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

const allPosts = [...postsData, ...draftsData];

// Generate HTML pages for each post.
// Each post is written to its own directory (e.g., dist/ssh-tunnel/index.html)
// so the URL can be /ssh-tunnel instead of /ssh-tunnel.html
allPosts.forEach(({ meta, html, slug, isDraft }) => {
    const output = template(meta.title || 'Untitled', meta.date || '', html, isDraft);
    const postDir = path.join(OUT_DIR, slug);
    if (!fs.existsSync(postDir)) {
        fs.mkdirSync(postDir, { recursive: true });
    }
    fs.writeFileSync(path.join(postDir, 'index.html'), output);
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
