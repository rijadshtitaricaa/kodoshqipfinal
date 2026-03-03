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
    origin: ['https://kodoshqipfinal-production-5988.up.railway.app', 'https://kodoshqipfinal-production.up.railway.app', true],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname)));

// Simple Railway MySQL connection
const connection = mysql.createConnection(process.env.DATABASE_URL);

console.log('DATABASE_URL:', process.env.DATABASE_URL ? ' Set' : ' Missing');

// Session store setup - use DATABASE_URL directly
const sessionStore = new MySQLStore({
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

// Session middleware setup (outside connection callback)
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

// Database setup
connection.connect((err) => {
    if (err) {
        console.log("Database connection failed:", err.message);
        return;
    }
    console.log("Connected to MySQL!");

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
        if (err) console.log("Users table error:", err.message);
        else console.log("Users table ready!");
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
        if (err) console.log("Progress table error:", err.message);
        else console.log("Progress table ready!");
    });

    // Create default admin account if not exists
    connection.query(
        "SELECT id FROM users WHERE email = ?",
        ["admin@kodoshqip.com"],
        (err, results) => {
            if (err) {
                console.log("Admin check error:", err.message);
                return;
            }
            
            if (results.length === 0) {
                connection.query(
                    "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
                    ["admin@kodoshqip.com", "admin123", "Admin"],
                    (err) => {
                        if (err) console.log("Admin creation error:", err.message);
                        else {
                            console.log("Default admin account created!");
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

// Multer setup për uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware për auth
const requireAuth = (req, res, next) => {
    if (req.session.user) next();
    else res.status(401).json({ message: "Ju nuk jeni i loguar" });
};

// API endpoints for KodoShqip

// Root endpoint - health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        message: 'KodoShqip API is running!'
    });
});

// Register endpoint
app.post('/register', (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    
    connection.query(
        'SELECT id FROM users WHERE email = ?',
        [email],
        (err, results) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            
            if (results.length > 0) {
                return res.status(400).json({ message: 'User already exists' });
            }
            
            connection.query(
                'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
                [email, password, name || ''],
                (err, result) => {
                    if (err) return res.status(500).json({ message: 'Registration failed' });
                    
                    res.status(201).json({ 
                        message: 'User registered successfully',
                        user: { id: result.insertId, email, name: name || '' }
                    });
                }
            );
        }
    );
});

// Login endpoint
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    
    connection.query(
        'SELECT * FROM users WHERE email = ? AND password = ?',
        [email, password],
        (err, results) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            
            if (results.length === 0) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            
            const user = results[0];
            req.session.user = user;
            
            res.json({
                message: 'Login successful',
                user: { id: user.id, email: user.email, name: user.name, profile_image: user.profile_image }
            });
        }
    );
});

// Logout endpoint
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: 'Logout failed' });
        res.json({ message: 'Logout successful' });
    });
});

// Get user profile
app.get('/profile/:email', (req, res) => {
    const { email } = req.params;
    
    connection.query(
        'SELECT id, email, name, profile_image FROM users WHERE email = ?',
        [email],
        (err, results) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            if (results.length === 0) return res.status(404).json({ message: 'User not found' });
            res.json(results[0]);
        }
    );
});

// Update profile
app.post('/update-profile', upload.single('profile'), (req, res) => {
    const { email } = req.body;
    const profileImage = req.file ? req.file.filename : null;
    
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    
    let updateQuery = 'UPDATE users SET name = ?';
    let updateValues = [req.body.name || ''];
    
    if (profileImage) {
        updateQuery += ', profile_image = ?';
        updateValues.push(profileImage);
    }
    
    updateQuery += ' WHERE email = ?';
    updateValues.push(email);
    
    connection.query(updateQuery, updateValues, (err, result) => {
        if (err) return res.status(500).json({ message: 'Update failed' });
        
        res.json({
            message: 'Profile updated successfully',
            profile_image: profileImage
        });
    });
});

// Save progress
app.post('/save-progress', (req, res) => {
    const { email, course_name, completed_lessons, total_lessons, points } = req.body;
    
    if (!email || !course_name) {
        return res.status(400).json({ message: 'Email and course name are required' });
    }
    
    const completion_percentage = total_lessons > 0 ? Math.round((completed_lessons / total_lessons) * 100) : 0;
    
    connection.query(
        'SELECT id FROM users WHERE email = ?',
        [email],
        (err, userResults) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            if (userResults.length === 0) return res.status(404).json({ message: 'User not found' });
            
            const userId = userResults[0].id;
            
            connection.query(
                `INSERT INTO progress (user_id, course_name, completed_lessons, total_lessons, completion_percentage, points)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 completed_lessons = VALUES(completed_lessons),
                 total_lessons = VALUES(total_lessons),
                 completion_percentage = VALUES(completion_percentage),
                 points = VALUES(points),
                 last_accessed = CURRENT_TIMESTAMP`,
                [userId, course_name, completed_lessons, total_lessons, completion_percentage, points],
                (err, result) => {
                    if (err) return res.status(500).json({ message: 'Failed to save progress' });
                    res.json({ message: 'Progress saved successfully' });
                }
            );
        }
    );
});

// Get user progress
app.get('/progress/:email/:course_name', (req, res) => {
    const { email, course_name } = req.params;
    
    connection.query(
        'SELECT id FROM users WHERE email = ?',
        [email],
        (err, userResults) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            if (userResults.length === 0) return res.status(404).json({ message: 'User not found' });
            
            const userId = userResults[0].id;
            
            connection.query(
                'SELECT * FROM progress WHERE user_id = ? AND course_name = ?',
                [userId, course_name],
                (err, results) => {
                    if (err) return res.status(500).json({ message: 'Database error' });
                    res.json(results);
                }
            );
        }
    );
});

// Get all user progress
app.get('/user-progress/:email', (req, res) => {
    const { email } = req.params;
    
    connection.query(
        'SELECT id FROM users WHERE email = ?',
        [email],
        (err, userResults) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            if (userResults.length === 0) return res.status(404).json({ message: 'User not found' });
            
            const userId = userResults[0].id;
            
            connection.query(
                'SELECT * FROM progress WHERE user_id = ?',
                [userId],
                (err, results) => {
                    if (err) return res.status(500).json({ message: 'Database error' });
                    res.json(results);
                }
            );
        }
    );
});

// Get all users (admin)
app.get('/users', (req, res) => {
    connection.query(
        'SELECT id, email, name, profile_image FROM users',
        (err, results) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.json(results);
        }
    );
});

// Add user endpoint
app.post('/addUser', (req, res) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ message: 'Name is required' });
    }
    
    connection.query(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [`user_${Date.now()}@example.com`, 'password123', name],
        (err, result) => {
            if (err) return res.status(500).json({ message: 'Failed to add user' });
            res.json({ message: 'User added successfully', id: result.insertId });
        }
    );
});

// Simple test endpoint (no database)
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