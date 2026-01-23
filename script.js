// script.js

// Theme icons - external SVG files
const themeIcons = {
    dawn: 'assets/icons/sunrise.svg',
    noon: 'assets/icons/sun.svg',
    dusk: 'assets/icons/sunset.svg',
    night: 'assets/icons/sun-off.svg'
};

const themes = ['dawn', 'noon', 'dusk', 'night'];

function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'noon';
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateToggleIcon(theme);
}

function updateToggleIcon(theme) {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.innerHTML = `<img src="${themeIcons[theme]}" alt="${theme}" />`;
        toggle.setAttribute('aria-label', `Current theme: ${theme}. Click to change.`);
    }
}

function cycleTheme() {
    const current = getCurrentTheme();
    const currentIndex = themes.indexOf(current);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
}

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.innerHTML = `
            <nav class="container">
                <a href="/">Home</a>
            </nav>
        `;
    }

    // Initialize theme toggle
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        updateToggleIcon(getCurrentTheme());
        toggle.addEventListener('click', cycleTheme);
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
