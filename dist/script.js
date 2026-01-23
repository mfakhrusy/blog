// script.js

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
