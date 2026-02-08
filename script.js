// script.js

// Theme icons - external SVG files
const themeIcons = {
    dawn: '/assets/icons/sunrise.svg',
    noon: '/assets/icons/sun.svg',
    dusk: '/assets/icons/sunset.svg',
    night: '/assets/icons/sun-off.svg'
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

const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://api.fahru.me';

const GUESTBOOK_STORAGE_KEY = 'guestbook_submission';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function getMainDomain() {
    const host = window.location.hostname;
    const parts = host.split('.');
    if (parts.length >= 2) {
        return parts.slice(-2).join('.');
    }
    return host;
}

function getSourceUrl(source) {
    const mainDomain = getMainDomain();
    return `https://${source}.${mainDomain}`;
}

async function loadGuestbookEntries() {
    const container = document.getElementById('guestbook-entries');
    if (!container) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/guestbook`);
        if (!response.ok) throw new Error('Failed to load entries');
        const entries = await response.json();
        
        if (entries.length === 0) {
            container.innerHTML = '<p class="no-entries">No entries yet. Be the first to sign!</p>';
            return;
        }
        
        container.innerHTML = entries.map(entry => `
            <article class="guestbook-entry">
                <div class="entry-header">
                    <span class="entry-name">${escapeHtml(entry.name)}</span>
                    ${entry.website ? `<a href="${escapeHtml(entry.website)}" target="_blank" rel="noopener noreferrer" class="entry-website">🔗</a>` : ''}
                    <span class="entry-date">${formatDate(entry.createdAt)}</span>
                </div>
                <p class="entry-message">${escapeHtml(entry.message)}</p>
                ${entry.source ? `<a href="${getSourceUrl(entry.source)}" target="_blank" rel="noopener noreferrer" class="entry-source">via ${escapeHtml(entry.source)}</a>` : ''}
            </article>
        `).join('');
    } catch (error) {
        container.innerHTML = '<p class="error">Failed to load entries.</p>';
        console.error('Error loading guestbook:', error);
    }
}

function getStoredSubmission() {
    try {
        const stored = localStorage.getItem(GUESTBOOK_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

function saveSubmission(entry) {
    localStorage.setItem(GUESTBOOK_STORAGE_KEY, JSON.stringify(entry));
}

function updateFormWithSubmission(submission) {
    const formContainer = document.querySelector('.dialog-left');
    if (!formContainer || !submission) return;
    
    const statusClass = submission.status === 'approved' ? 'approved' : 'pending';
    const statusText = submission.status === 'approved' 
        ? '✓ Your message is live!' 
        : '⏳ Your message is pending review';
    
    formContainer.innerHTML = `
        <div class="submission-status ${statusClass}">
            <p class="status-label">${statusText}</p>
            <div class="your-submission">
                <p class="submission-name">${escapeHtml(submission.name)}</p>
                <p class="submission-message">${escapeHtml(submission.message)}</p>
                <p class="submission-date">${formatDate(submission.createdAt)}</p>
            </div>
            <div class="submission-actions">
                <button type="button" class="action-btn edit-btn" onclick="editSubmission()">Edit</button>
                <button type="button" class="action-btn delete-btn" onclick="deleteSubmission()">Delete</button>
            </div>
        </div>
    `;
}

function showEditForm(submission) {
    const formContainer = document.querySelector('.dialog-left');
    if (!formContainer || !submission) return;
    
    formContainer.innerHTML = `
        <p class="guestbook-intro">Edit your message</p>
        <form id="guestbook-edit-form" class="guestbook-form" onsubmit="submitEdit(event)">
            <div class="form-group">
                <label for="editName">Name</label>
                <input type="text" id="editName" name="editName" maxlength="100" value="${escapeHtml(submission.name)}" disabled>
            </div>
            <div class="form-group">
                <label for="editMessage">Message <span class="required">*</span></label>
                <textarea id="editMessage" name="editMessage" required rows="3" maxlength="1000">${escapeHtml(submission.message)}</textarea>
            </div>
            <div class="form-group">
                <label for="editWebsite">Website (optional)</label>
                <input type="url" id="editWebsite" name="editWebsite" placeholder="https://..." value="${submission.website ? escapeHtml(submission.website) : ''}">
            </div>
            <div class="form-actions">
                <button type="submit" class="submit-btn">Save</button>
                <button type="button" class="cancel-btn" onclick="cancelEdit()">Cancel</button>
            </div>
            <p id="edit-status" class="form-status"></p>
        </form>
    `;
}

function editSubmission() {
    const submission = getStoredSubmission();
    if (submission) showEditForm(submission);
}

function cancelEdit() {
    const submission = getStoredSubmission();
    if (submission) updateFormWithSubmission(submission);
}

async function submitEdit(e) {
    e.preventDefault();
    const form = e.target;
    const status = document.getElementById('edit-status');
    const submitBtn = form.querySelector('.submit-btn');
    const submission = getStoredSubmission();
    
    if (!submission) return;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    status.textContent = '';
    status.className = 'form-status';

    const data = {
        message: form.editMessage.value.trim(),
        website: form.editWebsite.value.trim() || null
    };

    try {
        const response = await fetch(`${API_BASE}/api/guestbook/${submission.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Failed to update');
        const result = await response.json();
        
        saveSubmission(result);
        updateFormWithSubmission(result);
        loadGuestbookEntries();
    } catch (error) {
        status.textContent = 'Failed to update. Please try again.';
        status.className = 'form-status error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save';
    }
}

async function deleteSubmission() {
    const submission = getStoredSubmission();
    if (!submission) return;
    
    if (!confirm('Delete your guestbook entry?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/guestbook/${submission.id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete');
        
        localStorage.removeItem(GUESTBOOK_STORAGE_KEY);
        restoreGuestbookForm();
        loadGuestbookEntries();
    } catch (error) {
        alert('Failed to delete. Please try again.');
    }
}

function restoreGuestbookForm() {
    const formContainer = document.querySelector('.dialog-left');
    if (!formContainer) return;
    
    formContainer.innerHTML = `
        <p class="guestbook-intro">Leave a message! I'd love to hear from you.</p>
        <form id="guestbook-form" class="guestbook-form" onsubmit="submitGuestbook(event)">
            <div class="form-group">
                <label for="guestName">Name <span class="required">*</span></label>
                <input type="text" id="guestName" name="guestName" required maxlength="100">
            </div>
            <div class="form-group">
                <label for="guestMessage">Message <span class="required">*</span></label>
                <textarea id="guestMessage" name="guestMessage" required rows="3" maxlength="1000"></textarea>
            </div>
            <div class="form-group">
                <label for="guestWebsite">Website (optional)</label>
                <input type="url" id="guestWebsite" name="guestWebsite" placeholder="https://...">
            </div>
            <button type="submit" class="submit-btn">Sign Guestbook</button>
            <p id="guestbook-status" class="form-status"></p>
        </form>
    `;
}

function openGuestbook() {
    const dialog = document.getElementById('guestbook-dialog');
    if (dialog) {
        dialog.showModal();
        loadGuestbookEntries();
        
        const submission = getStoredSubmission();
        if (submission) {
            updateFormWithSubmission(submission);
        }
    }
}

function closeGuestbook() {
    const dialog = document.getElementById('guestbook-dialog');
    if (dialog) dialog.close();
}

async function submitGuestbook(e) {
    e.preventDefault();
    const form = e.target;
    const status = document.getElementById('guestbook-status');
    const submitBtn = form.querySelector('.submit-btn');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    status.textContent = '';
    status.className = 'form-status';

    const data = {
        name: form.guestName.value.trim(),
        message: form.guestMessage.value.trim(),
        website: form.guestWebsite.value.trim() || null,
        source: 'blog'
    };

    try {
        const response = await fetch(`${API_BASE}/api/guestbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Failed to submit');
        const result = await response.json();
        
        saveSubmission(result);
        updateFormWithSubmission(result);
        loadGuestbookEntries();
    } catch (error) {
        status.textContent = 'Failed to submit. Please try again.';
        status.className = 'form-status error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Guestbook';
    }
}

function injectGuestbookDialog() {
    if (document.getElementById('guestbook-dialog')) return;
    
    const dialog = document.createElement('dialog');
    dialog.id = 'guestbook-dialog';
    dialog.className = 'guestbook-dialog';
    dialog.innerHTML = `
        <div class="dialog-header">
            <h2>Guestbook</h2>
            <button type="button" class="close-btn" onclick="closeGuestbook()" aria-label="Close">&times;</button>
        </div>
        <div class="dialog-body">
            <div class="dialog-left">
                <p class="guestbook-intro">Leave a message! I'd love to hear from you.</p>
                <form id="guestbook-form" class="guestbook-form" onsubmit="submitGuestbook(event)">
                    <div class="form-group">
                        <label for="guestName">Name <span class="required">*</span></label>
                        <input type="text" id="guestName" name="guestName" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="guestMessage">Message <span class="required">*</span></label>
                        <textarea id="guestMessage" name="guestMessage" required rows="3" maxlength="1000"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="guestWebsite">Website (optional)</label>
                        <input type="url" id="guestWebsite" name="guestWebsite" placeholder="https://...">
                    </div>
                    <button type="submit" class="submit-btn">Sign Guestbook</button>
                    <p id="guestbook-status" class="form-status"></p>
                </form>
            </div>
            <div class="dialog-right">
                <div class="guestbook-entries-section">
                    <h3>Messages</h3>
                    <div id="guestbook-entries">
                        <p class="loading">Loading...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closeGuestbook();
    });
}

function shouldShowGuestbook() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.endsWith('.fahru.me') || host === 'fahru.me') return true;
    if (host.endsWith('.fakhrusy.com') || host === 'fakhrusy.com') return true;
    return false;
}

function positionInlineTooltip(trigger) {
    const tooltip = trigger.querySelector('.tooltip-bubble');
    if (!tooltip) return;

    tooltip.style.setProperty('--tooltip-shift', '0px');

    const tooltipWidth = tooltip.offsetWidth;
    if (!tooltipWidth) return;

    const triggerRect = trigger.getBoundingClientRect();
    const padding = 8;
    const left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
    const right = left + tooltipWidth;
    let shift = 0;

    if (left < padding) {
        shift = padding - left;
    } else if (right > window.innerWidth - padding) {
        shift = (window.innerWidth - padding) - right;
    }

    if (shift !== 0) {
        tooltip.style.setProperty('--tooltip-shift', `${shift}px`);
    }
}

function bindTooltipPositioning() {
    const tooltipTriggers = document.querySelectorAll('.inline-tooltip');

    tooltipTriggers.forEach((trigger) => {
        const schedulePositioning = () => requestAnimationFrame(() => positionInlineTooltip(trigger));
        trigger.addEventListener('mouseenter', schedulePositioning);
        trigger.addEventListener('focusin', schedulePositioning);
    });

    window.addEventListener('resize', () => {
        tooltipTriggers.forEach((trigger) => positionInlineTooltip(trigger));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const showGuestbook = shouldShowGuestbook();
    
    if (navbar) {
        navbar.innerHTML = `
            <nav class="container">
                <a href="/">Home</a>
                ${showGuestbook ? '<a href="#" onclick="openGuestbook(); return false;">Guestbook</a>' : ''}
            </nav>
        `;
    }
    
    if (showGuestbook) {
        injectGuestbookDialog();
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

    bindTooltipPositioning();
});
