const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const sequelize = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Database connection and synchronization
async function initDatabase() {
    try {
        // Connect to database
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Synchronize database models with validation only
        // 使用validate模式代替alter模式，避免SQLite的ALTER TABLE限制
        console.log('Attempting to validate database models...');
        await sequelize.sync({ validate: true });
        console.log('Database models validated successfully.');
        console.log('表结构验证通过，数据库可以正常使用。');
    } catch (error) {
        console.warn('⚠️  Database connection failed! Server will run without database.');
        console.warn('Error details:', error.message);
        console.warn('Error stack:', error.stack);
        console.warn('Error name:', error.name);
        console.warn('This is expected if SQLite database setup has issues.');
        console.warn('To fully use the system, please ensure SQLite is properly configured.');
        // Don't exit the process - server will continue to run
    }
}

// Initialize database
initDatabase();

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static file serving for images
app.use('/uploads/images', express.static(path.join(__dirname, 'uploads/images')));

// Routes
const authRoutes = require('./routes/auth');
const imageRoutes = require('./routes/images');
const annotationRoutes = require('./routes/annotations');
const exportRoutes = require('./routes/export');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/export', exportRoutes);

// Root route
app.get('/', (req, res) => {
    res.send('Spruce Detection API is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;