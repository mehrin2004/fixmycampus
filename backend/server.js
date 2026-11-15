const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth.routes');
const complaintRoutes = require('./routes/complaint.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded complaint photos
app.use('/uploads', express.static(uploadsDir));

// Determine frontend directory (works both in root repo and inside backend if copied)
const frontendDir = fs.existsSync(path.join(__dirname, '..', 'frontend'))
  ? path.join(__dirname, '..', 'frontend')
  : path.join(__dirname, 'frontend');

// Serve the frontend (so the whole app can run from one server)
app.use(express.static(frontendDir));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'FixMyCampus API' }));

// Fallback: any non-API route serves the frontend's welcome page
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('FixMyCampus frontend index.html not found');
  }
});

// Global error handler (catches multer errors etc.)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 FixMyCampus Server is Live on port ${PORT}!`);
  console.log(`  Local Access:   http://localhost:${PORT}`);
  console.log(`  Network Access: http://<YOUR_IP_ADDRESS>:${PORT}`);
  console.log(`==================================================\n`);
});
