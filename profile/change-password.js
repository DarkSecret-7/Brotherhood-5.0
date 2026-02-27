document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = '/api/v1/auth';
    const form = document.getElementById('change-password-form');
    const saveBtn = document.getElementById('save-btn');
    const notificationArea = document.getElementById('notification-area');
    
    // Auth Check
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    function showNotification(message, type) {
        notificationArea.textContent = message;
        notificationArea.className = `notification show ${type}`;
        
        setTimeout(() => {
            notificationArea.className = 'notification';
        }, 3000);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Reset errors
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        
        let isValid = true;

        if (!oldPassword) {
            document.getElementById('error-oldPassword').textContent = "Current password is required";
            isValid = false;
        }

        if (newPassword.length < 8) {
            document.getElementById('error-newPassword').textContent = "Password must be at least 8 characters";
            isValid = false;
        }

        if (newPassword !== confirmPassword) {
            document.getElementById('error-confirmPassword').textContent = "Passwords do not match";
            isValid = false;
        }

        if (!isValid) return;

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = "Updating...";

            const response = await fetch(`${API_BASE}/me/password`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({
                    old_password: oldPassword,
                    new_password: newPassword
                })
            });

            if (response.ok) {
                showNotification("Password updated successfully! Redirecting...", "success");
                form.reset();
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                const data = await response.json();
                showNotification(data.detail || "Failed to update password", "error");
            }
        } catch (error) {
            console.error(error);
            showNotification("Network error. Please try again.", "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Update Password";
        }
    });
});