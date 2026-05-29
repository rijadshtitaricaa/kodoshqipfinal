// Backend: Railway në prod, localhost kur hapni faqen lokalisht
const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const BACKEND_URL = isLocal
    ? 'http://localhost:5000'
    : 'https://kodoshqipfinal-production.up.railway.app';

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BACKEND_URL;
} else {
    window.BACKEND_URL = BACKEND_URL;
}
