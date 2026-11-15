/**
 * FixMyCampus - Database Status & Data Checker
 * Run with: npm run check-db (from the backend folder)
 */

const pool = require('../config/db');

async function checkDatabase() {
  console.log('\n======================================================');
  console.log('🔍 FixMyCampus - Database Health & Table Inspection');
  console.log('======================================================\n');

  try {
    // 1. Connection check
    const [ping] = await pool.query('SELECT 1 + 1 AS connected');
    if (ping && ping[0].connected === 2) {
      console.log('✅ Connection Status: CONNECTED');
      console.log(`📡 Host:     ${process.env.DB_HOST || 'localhost'}`);
      console.log(`🔌 Port:     ${process.env.DB_PORT || 3306}`);
      console.log(`📂 Database: ${process.env.DB_NAME || 'defaultdb'}\n`);
    }

    // 2. Tables Overview
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log(`📋 Found ${tableNames.length} tables: ${tableNames.join(', ')}\n`);

    // 3. Users Inspection
    if (tableNames.includes('users')) {
      const [userCount] = await pool.query('SELECT COUNT(*) AS total FROM users');
      const [users] = await pool.query('SELECT id, full_name, email, role, department, created_at FROM users ORDER BY id ASC');
      console.log('------------------------------------------------------');
      console.log(`👥 USERS (${userCount[0].total} total):`);
      console.log('------------------------------------------------------');
      console.table(users.map(u => ({
        ID: u.id,
        Name: u.full_name,
        Email: u.email,
        Role: u.role,
        Dept: u.department || 'N/A'
      })));
    }

    // 4. Complaints Inspection
    if (tableNames.includes('complaints')) {
      const [complaintStats] = await pool.query(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
        FROM complaints
      `);

      const [complaints] = await pool.query(`
        SELECT c.id, c.category, c.status, c.location, u.full_name AS student_name, c.created_at
        FROM complaints c
        LEFT JOIN users u ON c.student_id = u.id
        ORDER BY c.id DESC
        LIMIT 10
      `);

      const stats = complaintStats[0];
      console.log('------------------------------------------------------');
      console.log(`📢 COMPLAINTS (${stats.total || 0} total: ⏳ ${stats.pending || 0} Pending, ⚙️ ${stats.in_progress || 0} In Progress, ✅ ${stats.completed || 0} Completed):`);
      console.log('------------------------------------------------------');
      if (complaints.length > 0) {
        console.table(complaints.map(c => ({
          ID: c.id,
          Category: c.category,
          Status: c.status,
          Location: c.location || 'N/A',
          Student: c.student_name || 'N/A'
        })));
      } else {
        console.log('No complaints found yet.\n');
      }
    }

    // 5. Notifications Inspection
    if (tableNames.includes('notifications')) {
      const [notifCount] = await pool.query('SELECT COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread FROM notifications');
      const count = notifCount[0];
      console.log('------------------------------------------------------');
      console.log(`🔔 NOTIFICATIONS (${count.total || 0} total, ${count.unread || 0} unread)`);
      console.log('------------------------------------------------------\n');
    }

    console.log('======================================================');
    console.log('✨ Database check complete!');
    console.log('======================================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Database Connection / Query Error:');
    console.error(err.message);
    console.error('\nPlease verify your backend/.env settings.\n');
    process.exit(1);
  }
}

checkDatabase();
