const express = require('express');
const mysql = require('mysql2');
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

// 👇 Simple Railway MySQL connection
const connection = mysql.createConnection(process.env.DATABASE_URL);

console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing');

// 👇 Session store with simple connection
const sessionStore = new MySQLStore({
    host: connection.config.host,
    user: connection.config.user,
    password: connection.config.password,
    database: connection.config.database,
    createDatabaseTable: true,
    schema: {
        tableName: 'user_sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
});

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

// 👇 Database setup
connection.connect((err) => {
    if (err) {
        console.log("❌ Database connection failed:", err.message);
        return;
    }
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
    connection.query(createUsersTableQuery, (err) => {
        if (err) console.log("❌ Users table error:", err.message);
        else console.log("✅ Users table ready!");
    });

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
    connection.query(createProgressTableQuery, (err) => {
        if (err) console.log("❌ Progress table error:", err.message);
        else console.log("✅ Progress table ready!");
    });

    // Create default admin account if not exists
    connection.query(
        "SELECT id FROM users WHERE email = ?",
        ["admin@kodoshqip.com"],
        (err, results) => {
            if (err) {
                console.log("❌ Admin check error:", err.message);
                return;
            }
            
            if (results.length === 0) {
                connection.query(
                    "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
                    ["admin@kodoshqip.com", "admin123", "Admin"],
                    (err) => {
                        if (err) console.log("❌ Admin creation error:", err.message);
                        else {
                            console.log("✅ Default admin account created!");
                            console.log("   Email: admin@kodoshqip.com");
                            console.log("   Password: admin123");
                        }
                    }
                );
            } else {
                console.log("✅ Admin account already exists");
            }
        }
    );
});

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

// 👇 Simple test endpoint (no database)
app.get('/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server is working!',
        timestamp: new Date().toISOString(),
        env: {
            DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing'
        }
    });
});

// 👇 Health check
app.get('/health', (req, res) => {
    connection.query('SELECT 1', (err) => {
        if (err) {
            res.status(500).json({ status: 'error', database: 'disconnected', message: err.message });
        } else {
            res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
        }
    });
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