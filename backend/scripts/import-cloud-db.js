/**
 * FixMyCampus - Cloud Database Schema Importer
 * 
 * Automatically connects to your MySQL database (local or cloud like Aiven / Railway)
 * and imports all required tables (users, complaints, notifications) and the default admin.
 * 
 * Usage:
 *   node scripts/import-cloud-db.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function importSchema() {
  console.log('\n======================================================');
  console.log('🚀 FixMyCampus - Cloud Database Importer');
  console.log('======================================================\n');

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT, 10) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'defaultdb';
  const isCloud = host.includes('aivencloud.com') || host.includes('railway.app') || process.env.DB_SSL === 'true';

  console.log(`Connecting to MySQL database:`);
  console.log(`  Host:     ${host}`);
  console.log(`  Port:     ${port}`);
  console.log(`  User:     ${user}`);
  console.log(`  Database: ${database}`);
  console.log(`  SSL:      ${isCloud ? 'Enabled (Required for Aiven/Cloud)' : 'Disabled'}\n`);

  const connectionConfig = {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  };

  if (isCloud) {
    connectionConfig.ssl = { rejectUnauthorized: false };
  }

  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);
    console.log('✅ Successfully connected to MySQL database!\n');
  } catch (err) {
    console.error('❌ Failed to connect to MySQL database.');
    console.error(`Error details: ${err.message}\n`);
    console.log('👉 Please check:');
    console.log('  1. Are your DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME correct in backend/.env?');
    console.log('  2. For Aiven, make sure the service status is "RUNNING" (not "REBUILDING").\n');
    process.exit(1);
  }

  try {
    // Read schema.sql
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    let schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Clean up CREATE DATABASE & USE if already connected to target database
    schemaSql = schemaSql
      .replace(/CREATE DATABASE IF NOT EXISTS [^;]+;/gi, '')
      .replace(/USE [^;]+;/gi, '');

    console.log('📄 Executing database schema migration...');
    await connection.query(schemaSql);
    console.log('✅ Tables created successfully (users, complaints, notifications)!');

    // Verify Admin account
    const [adminRows] = await connection.query(
      'SELECT id, full_name, email, role FROM users WHERE role = ?',
      ['admin']
    );

    console.log('\n======================================================');
    console.log('🎉 Database Schema Import Complete!');
    console.log('======================================================');
    if (adminRows.length > 0) {
      console.log(`Default Admin Account is active:`);
      console.log(`  Email:    ${adminRows[0].email}`);
      console.log(`  Password: admin123`);
    }
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Error executing schema:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

importSchema();
