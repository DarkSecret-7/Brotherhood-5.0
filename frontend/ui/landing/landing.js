/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project Developers
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

window.toggleNav = function () {
    const nav = document.getElementsByClassName('nav-links')[0];
    if (nav) {
        nav.classList.toggle('active');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const statusEl = document.getElementById('contact-status');
    const submitBtn = document.getElementById('contact-submit');
    
    // Initialize the privacy and cookie banner
    initCookieBanner();

    if (!form || !statusEl || !submitBtn) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const actionUrl = form.action;
        if (!actionUrl) {
            statusEl.textContent = 'Contact endpoint is not configured.';
            return;
        }

        statusEl.textContent = '';
        submitBtn.disabled = true;
        const oldLabel = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';

        const payload = {
            name: document.getElementById('contact-name')?.value || '',
            email: document.getElementById('contact-email')?.value || '',
            message: document.getElementById('contact-reason')?.value || ''
        };

        try {
            const res = await fetch(actionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                statusEl.textContent = data.detail || 'Failed to send message.';
                return;
            }

            form.reset();
            statusEl.textContent = 'Message sent. We will get back to you soon.';
        } catch (err) {
            statusEl.textContent = 'Network error. Please try again.';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = oldLabel;
        }
    });
});

function initCookieBanner() {
    // 1. Create cookie banner HTML
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner-container';
    banner.innerHTML = `
        <div class="cookie-banner-content">
            <p class="cookie-banner-text">
                We respect your privacy. We do not collect personal information from visitors to our public pages, nor do we use visitor information for profiling or advertising. Please note that essential third-party services (such as hosting and infrastructure) may automatically process limited server logs and technical data for security and operational purposes. Read our <a href="/docs/Privacy%20Policy.pdf" target="_blank" class="cookie-banner-link">Privacy Policy</a> for more details.
            </p>
            <button id="cookie-banner-dismiss" class="cookie-banner-btn">Got it</button>
        </div>
    `;

    // 2. Create hanging recall button (using shield SVG)
    const recallBtn = document.createElement('button');
    recallBtn.id = 'privacy-recall-btn';
    recallBtn.className = 'privacy-recall-btn';
    recallBtn.title = 'Review Privacy Policy';
    recallBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;

    document.body.appendChild(banner);
    document.body.appendChild(recallBtn);

    const dismissBtn = document.getElementById('cookie-banner-dismiss');
    
    // Check local storage state
    const isDismissed = localStorage.getItem('cookie-banner-dismissed') === 'true';

    if (isDismissed) {
        // Show recall button on load if banner was already dismissed
        setTimeout(() => {
            recallBtn.classList.add('show');
        }, 100);
    } else {
        // Show banner on load
        setTimeout(() => {
            banner.classList.add('show');
        }, 100);
    }

    // Set action listeners
    dismissBtn.addEventListener('click', () => {
        banner.classList.remove('show');
        localStorage.setItem('cookie-banner-dismissed', 'true');
        // Wait for slide down transition then show recall button
        setTimeout(() => {
            recallBtn.classList.add('show');
        }, 400);
    });

    recallBtn.addEventListener('click', () => {
        recallBtn.classList.remove('show');
        // Wait for fade out transition then show banner
        setTimeout(() => {
            banner.classList.add('show');
        }, 300);
    });
}