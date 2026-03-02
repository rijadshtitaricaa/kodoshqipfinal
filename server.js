const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname)));

// 👇 Pool me environment variables për MySQL
const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// 👇 Session store me envir    onment variables
const sessionStore = new MySQLStore({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    createDatabaseTable: true,
    schema: {
        tableName: 'user_sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
}, pool);

app.use(session({
    key: 'user_sid',
    secret: 'kodo-secret-key-2026',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false
    }
}));

// 👇 Pool connection setup
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("✅ Connected to MySQL!");

        const createUsersTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255) DEFAULT '',
                profile_image VARCHAR(255) DEFAULT ''
            )
        `;
        await connection.query(createUsersTableQuery);
        console.log("✅ Users table ready!");

        const createProgressTableQuery = `
            CREATE TABLE IF NOT EXISTS progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_name VARCHAR(255) NOT NULL,
                completed_lessons INT DEFAULT 0,
                total_lessons INT DEFAULT 0,
                completion_percentage INT DEFAULT 0,
                points INT DEFAULT 0,
                last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_course (user_id, course_name),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `;
        await connection.query(createProgressTableQuery);
        console.log("✅ Progress table ready!");

        // Create default admin account if not exists
        const [adminCheck] = await connection.query(
            "SELECT id FROM users WHERE email = ?",
            ["admin@kodoshqip.com"]
        );

        if (adminCheck.length === 0) {
            await connection.query(
                "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
                ["admin@kodoshqip.com", "admin123", "Admin"]
            );
            console.log("✅ Default admin account created!");
            console.log("   Email: admin@kodoshqip.com");
            console.log("   Password: admin123");
        } else {
            console.log("✅ Admin account already exists");
        }

        connection.release();
    } catch (err) {
        console.log("❌ Database connection failed:", err.message);
    }
})();

// 👇 Multer setup për uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// 👇 Middleware për auth
const requireAuth = (req, res, next) => {
    if (req.session.user) next();
    else res.status(401).json({ message: "Ju nuk jeni i loguar" });
};

// 👇 API endpoints (register, login, logout, profile, progress, admin, etc.)
// ... ruaj kodin ekzistues si më lart për të gjitha endpoints ...

// 👇 Health check
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ status: 'error', database: 'disconnected', message: err.message });
    }
});

// 👇 404 handler
app.use((req, res) => res.status(404).json({ message: 'Endpoint not found' }));

// 👇 Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

// 👇 Vetëm një deklarim i PORT
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`🔍 Health check: /health`);
});