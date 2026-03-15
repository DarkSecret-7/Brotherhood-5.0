# Standalone User Profile Module

This module provides a completely independent, responsive, and secure user profile page implementation using vanilla HTML, CSS, and JavaScript.

## Features

- **Full Profile Editing**: Edit personal information, bio, location, and social links.
- **Profile Picture Upload**: Client-side image preview and validation.
- **Real-time Validation**: Instant feedback on form fields (email, phone, URL formats).
- **Data Persistence**: Uses `localStorage` to save profile data between sessions.
- **Responsive Design**: Optimized for mobile, tablet, and desktop views.
- **Security Measures**:
    - Input sanitization (XSS protection).
    - CSRF token simulation.
    - Secure file handling (client-side constraints).
- **Accessibility**: ARIA labels and keyboard navigation support.

## File Structure

- `index.html`: The main structure of the profile page.
- `styles.css`: All styling rules, including responsive layouts and themes.
- `script.js`: Core logic for state management, validation, and interactions.

## Setup & Usage

1. **Deployment**: Simply upload the contents of this folder to any web server or open `index.html` directly in a modern web browser.
2. **Local Testing**:
    - You can serve this directory using a local server like Python's `http.server`:
      ```bash
      python -m http.server 8000
      ```
    - Navigate to `http://localhost:8000` in your browser.

## Technical Details

- **No Dependencies**: Built entirely with standard web technologies.
- **State Management**: Uses a dirty-checking mechanism to track unsaved changes and warn users before navigating away.
- **Performance**: Lightweight assets ensuring fast load times.

## Test Cases

1. **Editing Fields**: Modify any field; the "Save Changes" button should become enabled.
2. **Validation**: Enter an invalid email or URL; an error message should appear immediately.
3. **Saving**: Click "Save Changes". Reload the page. The changes should persist.
4. **Image Upload**: Click the camera icon, select an image. The preview should update instantly.
5. **Unsaved Changes**: Modify a field and try to close the tab or reload. A browser confirmation dialog should appear.
6. **Responsiveness**: Resize the browser window to mobile width. The layout should stack vertically.

## License

MIT License.
