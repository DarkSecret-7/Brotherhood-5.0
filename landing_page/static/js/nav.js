document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('main-nav');
    const hamburger = document.querySelector('.hamburger');

    window.toggleNav = function () {
        if (nav) nav.classList.toggle('active');
    };

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            window.toggleNav();
        });
    }
});
