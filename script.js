// script.js

// This file is ready for your custom JavaScript.
// You could add features like:
// - A mobile navigation toggle
// - A theme switcher (light/dark mode)
// - Interactive code block features (e.g., a "copy to clipboard" button)

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.innerHTML = `
            <nav class="container">
                <a href="/">Home</a>
            </nav>
        `;
    }
});
