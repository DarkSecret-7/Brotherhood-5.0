// --- Configuration & State ---
const form = document.getElementById('profile-form');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const editModeBtn = document.getElementById('edit-mode-btn');
const logoutBtn = document.getElementById('logout-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const inputs = form.querySelectorAll('input, textarea');
const notificationArea = document.getElementById('notification-area');
const profileImage = document.getElementById('profile-image');

// Default Avatar (SVG Data URI)
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
// Handle image load errors
profileImage.onerror = function() {
    if (this.src !== DEFAULT_AVATAR) {
        this.src = DEFAULT_AVATAR;
    }
};
const imageUpload = document.getElementById('avatar-upload');
const avatarOverlay = document.querySelector('.avatar-overlay');
const displayName = document.getElementById('display-name');
const displayBio = document.getElementById('display-bio');
const bioInput = document.getElementById('bio');
const bioCount = document.getElementById('bio-count');
const formActions = document.querySelector('.form-actions');
// Modals
const confirmModal = document.getElementById('confirm-modal');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

const deleteModal = document.getElementById('delete-modal');
const deleteModalCancel = document.getElementById('delete-modal-cancel');
const deleteModalConfirm = document.getElementById('delete-modal-confirm');
let isDirty = false;
let isEditMode = false;
let initialData = {};

// --- Validation Logic ---
const validators = {
    email: (value) => {
        if (!value) return null; // Optional
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return "Please enter a valid email address.";
        return null;
    },
    phone: (value) => {
        if (!value) return null; // Optional
        const phoneRegex = /^[\d+\-\s()]*$/;
        if (!phoneRegex.test(value)) return "Invalid phone number format.";
        return null;
    },
    dob: (value) => {
        if (!value) return null; // Optional
        const date = new Date(value);
        if (isNaN(date.getTime())) return "Invalid date.";
        if (date > new Date()) return "Date cannot be in the future.";
        return null;
    },
    bio: (value) => {
        if (value && value.length > 500) return "Bio exceeds 500 characters.";
        return null;
    },
    location: (value) => null, // Optional
    socialGithub: (value) => {
        if (!value) return null;
        try { new URL(value); } catch (_) { return "Invalid URL."; }
        if (!value.includes('github.com')) return "Must be a GitHub URL.";
        return null;
    },
    socialLinkedin: (value) => {
        if (!value) return null;
        try { new URL(value); } catch (_) { return "Invalid URL."; }
        if (!value.includes('linkedin.com')) return "Must be a LinkedIn URL.";
        return null;
    }
};
function validateField(input) {
    const fieldName = input.name;
    // Try finding error span by ID or name
    let errorSpan = document.getElementById(`error-${input.id}`);
    if (!errorSpan) {
        errorSpan = document.getElementById(`error-${fieldName}`);
    }
    
    if (!errorSpan) {
        // If no error span exists, just return true (valid)
        return true;
    }
    const validator = validators[fieldName];
    
    if (validator) {
        const error = validator(input.value);
        if (error) {
            errorSpan.textContent = error;
            input.classList.add('error');
            return false;
        } else {
            errorSpan.textContent = '';
            input.classList.remove('error');
            return true;
        }
    }
    return true;
}
function validateForm() {
    let isValid = true;
    inputs.forEach(input => {
        if (input.type !== 'hidden' && input.type !== 'file' && !input.disabled && !input.readOnly) {
            if (!validateField(input)) isValid = false;
        }
    });
    return isValid;
}
// --- Mode Management ---
function toggleEditMode(enable) {
    isEditMode = enable;
    
    // Toggle inputs
    inputs.forEach(input => {
        if (input.type !== 'hidden') {
            input.readOnly = !enable;
            // Specifically for date inputs which might need disabled instead of readOnly in some browsers
            if (input.type === 'date') {
               // input.disabled = !enable; // readOnly works for modern browsers
            }
        }
    });
    // Toggle UI elements
    form.classList.toggle('readonly-mode', !enable);
    formActions.hidden = !enable;
    editModeBtn.hidden = enable;
    avatarOverlay.hidden = !enable;
    if (enable) {
        saveBtn.disabled = true; // Disabled until change
        cancelBtn.disabled = false;
    }
}

// --- Data Management ---
async function loadData() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/me`, {
            headers: getHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load profile');
        }
        
        const data = await response.json();
        
        // Map API data to form fields
        // Note: API returns snake_case, form uses camelCase or id matching
        const mapping = {
            'email': data.email,
            'phone': data.phone,
            'dob': data.dob,
            'bio': data.bio,
            'location': data.location,
            'socialGithub': data.social_github,
            'socialLinkedin': data.social_linkedin
        };
        Object.keys(mapping).forEach(key => {
            const input = form.elements[key];
            if (input) input.value = mapping[key] || '';
        });
        
        // Update Header
        displayName.textContent = data.username || "User";
        displayBio.textContent = data.bio || "No bio provided.";
        
        if (data.profile_image) {
            profileImage.src = data.profile_image;
        } else {
            profileImage.src = DEFAULT_AVATAR;
        }
        
        initialData = mapping;
        initialData.profileImage = data.profile_image;
        updateCharCount();
        setDirty(false);
        toggleEditMode(false);
    } catch (e) {
        console.error(e);
        showNotification("Error loading profile. Please try refreshing.", "error");
    }
}
async function saveData() {
    if (!validateForm()) {
        showNotification("Please fix errors before saving.", "error");
        return;
    }
    const formData = new FormData(form);
    const payload = {
        email: formData.get('email'),
        phone: formData.get('phone'),
        dob: formData.get('dob'),
        bio: formData.get('bio'),
        location: formData.get('location'),
        social_github: formData.get('socialGithub'),
        social_linkedin: formData.get('socialLinkedin')
    };
    // Add image if changed
    if (profileImage.src && profileImage.src.startsWith('data:')) {
        payload.profile_image = profileImage.src;
    }
    try {
        saveBtn.textContent = "Saving...";
        saveBtn.disabled = true;
        const response = await fetch(`${API_BASE}/me`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to update');
        }
        const data = await response.json();
        
        // Update initial data reference
        initialData = { ...initialData, ...payload };
        if (payload.profile_image) initialData.profileImage = payload.profile_image;
        // Update UI
        displayBio.textContent = data.bio || "No bio provided.";
        showNotification("Profile updated successfully!", "success");
        toggleEditMode(false);
        setDirty(false);
    } catch (e) {
        console.error(e);
        showNotification("Failed to save changes.", "error");
    } finally {
        saveBtn.textContent = "Save Changes";
    }
}
// --- Auth Actions ---
async function handleDeleteAccount() {
    try {
        const response = await fetch(`${API_BASE}/me`, { 
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            localStorage.removeItem('access_token');
            window.location.href = '/signup';
        } else {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            showNotification("Failed to delete account.", "error");
        }
    } catch (e) {
        showNotification("Error connecting to server.", "error");
    }
}
// --- UI Helpers ---
function setDirty(state) {
    isDirty = state;
    saveBtn.disabled = !state;
    if (state) {
        window.onbeforeunload = () => "You have unsaved changes.";
    } else {
        window.onbeforeunload = null;
    }
}
function showNotification(message, type) {
    notificationArea.textContent = message;
    notificationArea.className = `notification show ${type}`;
    
    setTimeout(() => {
        notificationArea.className = 'notification';
    }, 3000);
}
function updateCharCount() {
    const count = bioInput.value.length;
    bioCount.textContent = count;
    if (count > 500) {
        bioCount.style.color = 'var(--error-color)';
    } else {
        bioCount.style.color = '#95a5a6';
    }
}
// --- Event Listeners ---
// Edit Toggle
editModeBtn.addEventListener('click', () => toggleEditMode(true));
// Cancel Edit
cancelBtn.addEventListener('click', () => {
    if (isDirty) {
        confirmModal.hidden = false;
    } else {
        loadData(); // Revert any unsaved UI changes
        toggleEditMode(false);
    }
});
// Modal Actions
modalCancel.addEventListener('click', () => confirmModal.hidden = true);
modalConfirm.addEventListener('click', () => {
    confirmModal.hidden = true;
    loadData(); // Revert
    toggleEditMode(false);
});
// Delete Account Flow
deleteAccountBtn.addEventListener('click', () => deleteModal.hidden = false);
deleteModalCancel.addEventListener('click', () => deleteModal.hidden = true);
deleteModalConfirm.addEventListener('click', () => {
    deleteModal.hidden = true;
    handleDeleteAccount();
});
// Logout
logoutBtn.addEventListener('click', logout);
// Input changes
inputs.forEach(input => {
    input.addEventListener('input', () => {
        if (!isEditMode) return;
        validateField(input);
        setDirty(true);
        if (input === bioInput) updateCharCount();
    });
});
// Image Upload
imageUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showNotification("Please upload an image file.", "error");
        return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        showNotification("Image size must be less than 2MB.", "error");
        return;
    }
    const reader = new FileReader();
    reader.onload = function(event) {
        profileImage.src = event.target.result;
        setDirty(true);
    };
    reader.readAsDataURL(file);
});
// Form Submit
form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveData();
});

// Initialize
loadData();