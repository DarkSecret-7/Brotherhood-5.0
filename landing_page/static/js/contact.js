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