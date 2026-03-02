// Backend Configuration
// Zëvendësojeni këtë URL me URL-në tuaj live të Railway backend
const BACKEND_URL = "https://kodoshqipfinal-production.up.railway.app";

// Për development lokal, mund të përdorni localhost
// const BACKEND_URL = "http://localhost:3000";

// Export për përdorim në të gjitha skedarët
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BACKEND_URL;
} else {
    window.BACKEND_URL = BACKEND_URL;
}
