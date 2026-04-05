/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project
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
    console.log('toggleNav called');
    const nav = document.getElementById('main-nav');
    console.log('nav element:', nav);
    if (nav) {
        nav.classList.toggle('active');
        console.log('active class toggled, now:', nav.classList.contains('active'));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const statusEl = document.getElementById('contact-status');
    const submitBtn = document.getElementById('contact-submit');

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