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

    // Water ripple effect on click (respects prefers-reduced-motion via CSS)
    const isInteractive = (el) => {
        if (!el) return false;
        const tag = el.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (el.getAttribute('role') === 'button' || el.hasAttribute('onclick') || el.tabIndex >= 0) return true;
        return el.closest('a, button, [role="button"]') !== null;
    };

    document.addEventListener('click', (e) => {
        if (isInteractive(e.target)) return;

        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        const size = 120;
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - size / 2}px`;
        ripple.style.top = `${e.clientY - size / 2}px`;
        document.body.appendChild(ripple);

        ripple.addEventListener('animationend', () => ripple.remove());
    });
});
