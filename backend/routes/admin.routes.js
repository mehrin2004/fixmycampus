const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(verifyToken, requireAdmin);

router.get('/stats', adminController.getDashboardStats);
router.get('/complaints', adminController.getAllComplaints);
router.put('/complaints/:id', upload.single('resolutionPhoto'), adminController.updateComplaint);

module.exports = router;
