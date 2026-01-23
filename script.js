// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Inject navbar
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.innerHTML = `
            <nav class="container">
                <a href="/">Home</a>
            </nav>
        `;
    }

    // Parse markdown content
    const mdScript = document.getElementById('md-content');
    const postContent = document.querySelector('.post-content');
    if (mdScript && postContent && window.marked) {
        postContent.innerHTML = marked.parse(mdScript.textContent);
    }
});
