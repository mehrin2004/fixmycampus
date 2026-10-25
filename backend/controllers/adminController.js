const pool = require('../config/db');
const { createNotification } = require('./notificationController');

// GET /api/admin/stats  (Admin Dashboard screen: totals + recent complaints)
exports.getDashboardStats = async (req, res) => {
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM complaints`);
    const [[{ pending }]] = await pool.query(`SELECT COUNT(*) AS pending FROM complaints WHERE status = 'Pending'`);
    const [[{ inProgress }]] = await pool.query(`SELECT COUNT(*) AS inProgress FROM complaints WHERE status = 'In Progress'`);
    const [[{ completed }]] = await pool.query(`SELECT COUNT(*) AS completed FROM complaints WHERE status = 'Completed'`);

    const [recent] = await pool.query(
      `SELECT c.id, c.category, c.location, c.status, c.created_at, u.full_name AS student_name
       FROM complaints c JOIN users u ON c.student_id = u.id
       ORDER BY c.created_at DESC LIMIT 5`
    );

    res.json({
      totalComplaints: total,
      pending,
      inProgress,
      completed,
      recentComplaints: recent
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching dashboard stats.' });
  }
};

// GET /api/admin/complaints  (All Complaints screen, optional ?status=&category= filters)
exports.getAllComplaints = async (req, res) => {
  try {
    const { status, category } = req.query;
    let query = `SELECT c.*, u.full_name AS student_name FROM complaints c
                 JOIN users u ON c.student_id = u.id WHERE 1=1`;
    const params = [];

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (category) {
      query += ' AND c.category = ?';
      params.push(category);
    }
    query += ' ORDER BY c.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching complaints.' });
  }
};

// PUT /api/admin/complaints/:id  (Complaint Management screen: update status / assign staff / resolution photo)
exports.updateComplaint = async (req, res) => {
  try {
    const { status, assignedStaff } = req.body;
    const resolutionPhotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const validStatuses = ['Pending', 'In Progress', 'Completed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const [existing] = await pool.query('SELECT * FROM complaints WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Complaint not found.' });

    const complaint = existing[0];

    await pool.query(
      `UPDATE complaints SET 
         status = COALESCE(?, status), 
         assigned_staff = COALESCE(?, assigned_staff),
         resolution_photo_url = COALESCE(?, resolution_photo_url) 
       WHERE id = ?`,
      [status || null, assignedStaff || null, resolutionPhotoUrl, req.params.id]
    );

    // Trigger Student Notification if status updated or resolved
    const newStatus = status || complaint.status;
    const statusIcon = newStatus === 'Completed' ? '✅' : (newStatus === 'In Progress' ? '🔄' : '⏳');
    
    await createNotification({
      userId: complaint.student_id,
      role: 'student',
      title: `${statusIcon} Complaint Status Updated`,
      message: `Your ${complaint.category} complaint #${complaint.id} status is now '${newStatus}'.`,
      complaintId: complaint.id
    });

    res.json({ message: 'Complaint updated successfully.', resolution_photo_url: resolutionPhotoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating complaint.' });
  }
};

