// -----------------------------

// SCROLL ANIMATIONS

// -----------------------------

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





// -----------------------------

// MOBILE MENU

// -----------------------------

document.addEventListener('DOMContentLoaded', () => {

    const toggle = document.querySelector('.menu-toggle');

    const navLinks = document.querySelector('.nav-links');



    if (!toggle || !navLinks) return;



    toggle.addEventListener('click', () => {

        navLinks.classList.toggle('active');

        toggle.setAttribute('aria-expanded', navLinks.classList.contains('active'));

    });



    document.addEventListener('click', (e) => {

        if (!navLinks.classList.contains('active')) return;

        if (!e.target.closest('.navbar')) {

            navLinks.classList.remove('active');

            toggle.setAttribute('aria-expanded', 'false');

        }

    });

});





// -----------------------------

// ADD USER

// -----------------------------

function addUser() {

    const name = document.getElementById("nameInput").value;



    fetch(`${window.BACKEND_URL || ''}/addUser`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ name })

    })

    .then(res => res.text())

    .then(() => {

        loadUsers();

    })

    .catch(() => {

        alert("Gabim i lidhjes me serverin");

    });

}





// -----------------------------

// AUTH + PROFILE SYSTEM

// -----------------------------

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

                img.src = `${window.BACKEND_URL || ''}/uploads/${user.profile_image}`;

                img.style.display = 'block';

            }

            if (initial) initial.style.display = 'none';

        } else {

            if (img) img.style.display = 'none';

            if (initial) {

                initial.textContent = (user.name || user.email).charAt(0).toUpperCase();

                initial.style.display = 'flex';

            }

        }

    }



    async function openProfileModal() {

        const stored = localStorage.getItem('loggedInUser');

        if (!stored) {

            alert('Ju duhet të jeni të kyçur');

            return;

        }



        const user = JSON.parse(stored);

        const modal = document.getElementById('profileModal');

        const nameInput = document.getElementById('profileNameInput');



        if (nameInput) nameInput.value = user.name || '';



        try {

            const res = await fetch(`${window.BACKEND_URL || ''}/profile/${encodeURIComponent(user.email)}`);

            if (res.ok) {

                const latest = await res.json();

                if (nameInput) nameInput.value = latest.name || '';

            }

        } catch (err) {

            console.error(err);

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



        const formData = new FormData();

        formData.append('email', user.email);

        if (nameInput?.value) formData.append('name', nameInput.value);

        if (imgInput?.files[0]) formData.append('profile', imgInput.files[0]);



        try {

            const res = await fetch(`${window.BACKEND_URL || ''}/update-profile`, {

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

                }



                setTimeout(() => {

                    document.getElementById('profileModal')?.classList.remove('active');

                }, 1500);



            } else {

                if (msg) {

                    msg.textContent = data.message || 'Gabim në përditësim';

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



    document.addEventListener('DOMContentLoaded', () => {

        checkLoginStatus();

        initProfileDropdown();

        initLogout();

    });



})();