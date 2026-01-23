const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const POSTS_DIR = './posts';
const OUT_DIR = './dist';

const template = (title, date, content) => `<!DOCTYPE html>
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
    <link rel="stylesheet" href="style.css">
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
        <p>&#8508; Hi, there.</p>
    </footer>

    <script src="script.js"></script>
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
const posts = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
posts.forEach(file => {
    const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { meta, body } = parseFrontmatter(content);
    const html = marked(body);
    const output = template(meta.title || 'Untitled', meta.date || '', html);
    const outFile = (meta.slug || file.replace('.md', '')) + '.html';
    fs.writeFileSync(path.join(OUT_DIR, outFile), output);
    console.log(`Built: ${outFile}`);
});

console.log('Build complete!');
