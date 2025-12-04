// Pjesa e Rijadit


function applyScrollAnimations() {
    const elements = document.querySelectorAll(
        '.mission-section, .courses-section, .full-courses-section, .contact-section, .course-card, .course-card-full, .mission-text h2, .mission-text p, .mission-image, .courses-section h2, .courses-section > p, .full-courses-section h2, .contact-form-container, .contact-info'
    );

    const windowHeight = window.innerHeight;

    elements.forEach(el => {
        const elementTop = el.getBoundingClientRect().top;
        if (elementTop < windowHeight * 0.85) {
            el.classList.add('visible');
            el.classList.remove('hidden');
        }
    });
}

window.addEventListener('scroll', applyScrollAnimations);
window.addEventListener('load', applyScrollAnimations);
applyScrollAnimations();


document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const expanded = navLinks.classList.contains('active');
        toggle.setAttribute('aria-expanded', expanded);
    });

    document.addEventListener('click', (e) => {
        if (!navLinks.classList.contains('active')) return;
        if (!e.target.closest('.navbar')) {
            navLinks.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
        }
    });
});


function addUser() {
    const name = document.getElementById("nameInput").value;

    fetch("http://localhost:5000/addUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    })
        .then(res => res.text())
        .then(() => {
            loadUsers();
        });
}


(function () {
    'use strict';

    const ADMIN_EMAILS = (window.ADMIN_EMAILS || ['admin@kodoshqip.com']).map(e => e.toLowerCase());
    window.ADMIN_EMAILS = ADMIN_EMAILS;

    const isAdminUser = (user) => {
        return user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
    };

    function checkLoginStatus() {
        const userData = localStorage.getItem('loggedInUser');
        const loginNavItem = document.getElementById('loginNavItem');
        const profileNavItem = document.getElementById('profileNavItem');
        const adminNavItem = document.getElementById('adminNavItem');

        if (userData) {
            try {
                const user = JSON.parse(userData);
                if (loginNavItem) loginNavItem.style.display = 'none';
                if (profileNavItem) {
                    profileNavItem.style.display = 'block';
                    updateProfileDisplay(user);
                }
                if (adminNavItem) {
                    adminNavItem.style.display = isAdminUser(user) ? 'block' : 'none';
                }
            } catch {
                localStorage.removeItem('loggedInUser');
                if (adminNavItem) adminNavItem.style.display = 'none';
            }
        } else {
            if (loginNavItem) loginNavItem.style.display = 'block';
            if (profileNavItem) profileNavItem.style.display = 'none';
            if (adminNavItem) adminNavItem.style.display = 'none';
        }
    }

    function updateProfileDisplay(user) {
        const img = document.getElementById('profileNavImage');
        const initial = document.getElementById('profileNavInitial');
        const nameEl = document.getElementById('profileNavName');

        if (nameEl) {
            nameEl.textContent = user.name || user.email.split('@')[0];
        }

        if (user.profile_image) {
            if (img) {
                img.src = `http://localhost:5000/uploads/${user.profile_image}`;
                img.style.display = 'block';
            }
            if (initial) initial.style.display = 'none';
        } else {
            if (img) img.style.display = 'none';
            if (initial) {
                const letter = (user.name || user.email).charAt(0).toUpperCase();
                initial.textContent = letter;
                initial.style.display = 'flex';
            }
        }
    }

    function initProfileDropdown() {
        const trigger = document.getElementById('profileTrigger');
        const dropdown = document.querySelector('.profile-dropdown');

        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            });
        }
    }

    function initProfileModal() {
        const editBtn = document.getElementById('editProfileBtn');
        const closeBtn = document.getElementById('closeProfileModal');
        const cancelBtn = document.getElementById('cancelProfileBtn');
        const modal = document.getElementById('profileModal');
        const form = document.getElementById('profileForm');
        const imgInput = document.getElementById('profileImageInput');

        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openProfileModal();
            });
        }

        const closeModal = () => {
            if (modal) modal.classList.remove('active');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        if (imgInput) {
            imgInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const preview = document.getElementById('profileImagePreview');
                    const placeholder = document.getElementById('profileImagePlaceholder');

                    if (preview) {
                        preview.src = event.target.result;
                        preview.style.display = 'block';
                    }
                    if (placeholder) placeholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveProfile();
            });
        }
    }

    async function openProfileModal() {
        const stored = localStorage.getItem('loggedInUser');
        if (!stored) {
            alert('Ju duhet të jeni të kyçur për të përditësuar profilin');
            return;
        }

        const user = JSON.parse(stored);
        const modal = document.getElementById('profileModal');
        const nameInput = document.getElementById('profileNameInput');
        const emailInput = document.getElementById('profileEmailInput');
        const preview = document.getElementById('profileImagePreview');
        const placeholder = document.getElementById('profileImagePlaceholder');
        const initialPreview = document.getElementById('profileInitialPreview');

        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';

        if (user.profile_image) {
            if (preview) {
                preview.src = `http://localhost:5000/uploads/${user.profile_image}`;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        } else {
            if (preview) preview.style.display = 'none';
            if (placeholder && initialPreview) {
                initialPreview.textContent = (user.name || user.email).charAt(0).toUpperCase();
                placeholder.style.display = 'flex';
            }
        }

        try {
            const res = await fetch(`http://localhost:5000/profile/${encodeURIComponent(user.email)}`);
            if (res.ok) {
                const latest = await res.json();
                if (nameInput) nameInput.value = latest.name || '';

                if (latest.profile_image && preview) {
                    preview.src = `http://localhost:5000/uploads/${latest.profile_image}`;
                    preview.style.display = 'block';
                    if (placeholder) placeholder.style.display = 'none';
                }
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }

        if (modal) modal.classList.add('active');
    }

    async function saveProfile() {
        const stored = localStorage.getItem('loggedInUser');
        if (!stored) return;

        const user = JSON.parse(stored);
        const nameInput = document.getElementById('profileNameInput');
        const imgInput = document.getElementById('profileImageInput');
        const msg = document.getElementById('profileMessage');
        const form = document.getElementById('profileForm');

        const formData = new FormData();
        formData.append('email', user.email);
        if (nameInput?.value) formData.append('name', nameInput.value);
        if (imgInput?.files[0]) formData.append('profile', imgInput.files[0]);

        try {
            const res = await fetch('http://localhost:5000/update-profile', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                const updated = {
                    ...user,
                    name: nameInput?.value || user.name,
                    profile_image: data.profile_image || user.profile_image
                };

                localStorage.setItem('loggedInUser', JSON.stringify(updated));
                updateProfileDisplay(updated);

                if (msg) {
                    msg.textContent = 'Profili u përditësua me sukses!';
                    msg.className = 'profile-message success';

                    setTimeout(() => {
                        msg.className = 'profile-message';
                        msg.textContent = '';
                    }, 3000);
                }

                setTimeout(() => {
                    const modal = document.getElementById('profileModal');
                    if (modal) modal.classList.remove('active');
                    if (form) form.reset();
                }, 1500);
            } else {
                if (msg) {
                    msg.textContent = data.message || 'Gabim në përditësimin e profilit';
                    msg.className = 'profile-message error';
                }
            }
        } catch {
            if (msg) {
                msg.textContent = 'Gabim i lidhjes me serverin';
                msg.className = 'profile-message error';
            }
        }
    }

    function initLogout() {
        const btn = document.getElementById('logoutBtn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('loggedInUser');
                window.location.href = 'index.html';
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        checkLoginStatus();
        initProfileDropdown();
        initProfileModal();
        initLogout();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkLoginStatus);
    } else {
        checkLoginStatus();
    }
})();
