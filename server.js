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

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "rijad",
    database: "kodo_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

const sessionStore = new MySQLStore({
    host: "localhost",
    user: "root",
    password: "rijad",
    database: "kodo_db",
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
    secret: 'kodo-secret-key-2024',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false
    }
}));

(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("✅ Connected to MySQL!");

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255) DEFAULT '',
                profile_image VARCHAR(255) DEFAULT ''
            )
        `;

        await connection.query(createTableQuery);
        console.log("✅ Users table ready!");

        try {
            await connection.query("DROP TABLE IF EXISTS progress");
        } catch (err) {}

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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: "Ju nuk jeni i loguar" });
    }
};

app.post('/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email dhe fjalëkalimi janë të nevojshëm" });
    }

    try {
        const [results] = await pool.query(
            "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
            [email, password, name || email.split('@')[0]]
        );
        res.json({ message: "REGISTER_SUCCESS", userId: results.insertId });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ message: "Email tashmë ekziston" });
        }
        return res.status(500).json({ message: "Gabim në bazën e të dhënave: " + err.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email dhe fjalëkalimi janë të nevojshëm" });
    }

    try {
        const [results] = await pool.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );
        
        if (results.length === 0) {
            return res.status(400).json({ message: "Email nuk u gjet" });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.status(400).json({ message: "Fjalëkalimi i gabuar" });
        }

        req.session.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            profile_image: user.profile_image
        };

        res.json({
            message: "LOGIN_SUCCESS",
            user: req.session.user
        });
    } catch (err) {
        return res.status(500).json({ message: "Gabim në bazën e të dhënave" });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: "Gabim gjatë logout" });
        }
        res.clearCookie('user_sid');
        res.json({ message: "LOGOUT_SUCCESS" });
    });
});

app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

app.post('/update-profile', requireAuth, upload.single('profile'), async (req, res) => {
    const { email, name } = req.body;
    const profile_image = req.file ? req.file.filename : null;

    if (!email) {
        return res.status(400).json({ message: "Email është i nevojshëm" });
    }

    let sql = "UPDATE users SET ";
    const params = [];
    const updates = [];

    if (name) {
        updates.push("name = ?");
        params.push(name);
    }

    if (profile_image) {
        updates.push("profile_image = ?");
        params.push(profile_image);
    }

    if (updates.length === 0) {
        return res.status(400).json({ message: "Nuk ka asgjë për të përditësuar" });
    }

    sql += updates.join(", ") + " WHERE email = ?";
    params.push(email);

    try {
        const [results] = await pool.query(sql, params);
        
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Përdoruesi nuk u gjet" });
        }

        if (req.session.user.email === email) {
            req.session.user.name = name || req.session.user.name;
            req.session.user.profile_image = profile_image || req.session.user.profile_image;
        }
        
        res.json({ message: "Profile updated!", profile_image });
    } catch (err) {
        return res.status(500).json({ message: "Gabim në bazën e të dhënave: " + err.message });
    }
});

app.get('/profile/:email', requireAuth, async (req, res) => {
    const email = req.params.email;

    try {
        const [results] = await pool.query(
            "SELECT id, email, name, profile_image FROM users WHERE email = ?",
            [email]
        );
        
        if (results.length === 0) {
            return res.status(404).json({ message: "Përdoruesi nuk u gjet" });
        }
        res.json(results[0]);
    } catch (err) {
        return res.status(500).json({ message: "Gabim në bazën e të dhënave" });
    }
});

app.get('/admin/users', requireAuth, async (req, res) => {
    try {
        const [results] = await pool.query(
            "SELECT id, email, name, profile_image FROM users ORDER BY id DESC"
        );
        res.json(results);
    } catch (err) {
        return res.status(500).json({ 
            message: "Gabim në bazën e të dhënave",
            error: err.message 
        });
    }
});

app.get('/admin/dashboard', requireAuth, async (req, res) => {
    try {
        const [results] = await pool.query(
            "SELECT id, email, name, profile_image FROM users ORDER BY id DESC"
        );

        let html = `
            <html>
            <head>
                <title>Admin Dashboard</title>
                <style>
                    body { font-family: Arial; padding: 20px; background: #f4f4f4; }
                    table { width: 100%; border-collapse: collapse; background: white; }
                    th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
                    th { background: #222; color: white; }
                    img { width: 50px; height: 50px; object-fit: cover; border-radius: 6px; }
                    h1 { margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <h1>Admin Dashboard - All Users</h1>
                <table>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Profile Image</th>
                    </tr>
        `;

        results.forEach(user => {
            const safeEmail = String(user.email || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeName = String(user.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            html += `
                <tr>
                    <td>${user.id}</td>
                    <td>${safeEmail}</td>
                    <td>${safeName}</td>
                    <td>${user.profile_image ? `<img src="/uploads/${user.profile_image}" />` : "No Image"}</td>
                </tr>
            `;
        });

        html += `
                </table>
            </body>
            </html>
        `;

        res.send(html);
    } catch (err) {
        return res.send("Database Error");
    }
});

app.post('/save-progress', requireAuth, async (req, res) => {
    const { email, course_name, completed_lessons, total_lessons, points } = req.body;

    if (!email || !course_name) {
        return res.status(400).json({ message: "Email dhe emri i kursit janë të nevojshëm" });
    }

    try {
        const [users] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: "Përdoruesi nuk u gjet" });
        }

        const user_id = users[0].id;
        const completion_percentage = total_lessons > 0 
            ? Math.round((completed_lessons / total_lessons) * 100) 
            : 0;

        const [result] = await pool.query(
            `INSERT INTO progress (user_id, course_name, completed_lessons, total_lessons, completion_percentage, points)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             completed_lessons = VALUES(completed_lessons),
             total_lessons = VALUES(total_lessons),
             completion_percentage = VALUES(completion_percentage),
             points = GREATEST(points, VALUES(points)),
             last_accessed = CURRENT_TIMESTAMP`,
            [user_id, course_name, completed_lessons, total_lessons, completion_percentage, points || 0]
        );

        res.json({ 
            message: "Përparimi u ruajt me sukses",
            completion_percentage 
        });
    } catch (err) {
        return res.status(500).json({ message: "Gabim në bazën e të dhënave: " + err.message });
    }
});

app.get('/progress/:email/:course_name', requireAuth, async (req, res) => {
    const { email, course_name } = req.params;

    try {
        const [users] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: "Përdoruesi nuk u gjet" });
        }

        const user_id = users[0].id;
        const [progress] = await pool.query(
            "SELECT * FROM progress WHERE user_id = ? AND course_name = ?",
            [user_id, course_name]
        );

        if (progress.length === 0) {
            return res.json({ 
                completed_lessons: 0, 
                total_lessons: 0, 
                completion_percentage: 0,
                points: 0
            });
        }

        res.json(progress[0]);
    } catch (err) {
        return res.status(500).json({ message: "Gabim në bazën e të dhënave" });
    }
});

app.get('/user-progress/:email', requireAuth, async (req, res) => {
    const { email } = req.params;

    try {
        const [users] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: "Përdoruesi nuk u gjet" });
        }

        const user_id = users[0].id;
        
        const [progress] = await pool.query(
            "SELECT course_name, completed_lessons, total_lessons, completion_percentage, points, last_accessed FROM progress WHERE user_id = ? ORDER BY last_accessed DESC",
            [user_id]
        );

        res.json(progress);
    } catch (err) {
        return res.status(500).json({ message: "Gabim në bazën e të dhënave: " + err.message });
    }
});

app.get('/health', async (req, res) => {
    try {
        const [result] = await pool.query('SELECT 1');
        res.json({ 
            status: 'ok', 
            database: 'connected',
            timestamp: new Date().toISOString() 
        });
    } catch (err) {
        return res.status(500).json({ 
            status: 'error', 
            database: 'disconnected',
            message: err.message 
        });
    }
});

app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});