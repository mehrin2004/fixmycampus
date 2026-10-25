-- FixMyCampus Database Schema
-- Run this in MySQL before starting the backend:
--   mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS fixmycampus;
USE fixmycampus;

-- ============================
-- USERS TABLE (students & admins)
-- ============================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  department VARCHAR(100),
  year VARCHAR(50),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  avatar_url VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- COMPLAINTS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255),
  photo_url VARCHAR(255) DEFAULT NULL,
  resolution_photo_url VARCHAR(255) DEFAULT NULL,
  status ENUM('Pending', 'In Progress', 'Completed') NOT NULL DEFAULT 'Pending',
  assigned_staff VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================
-- NOTIFICATIONS TABLE (student & admin alerts)
-- ============================
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  role ENUM('student', 'admin') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  complaint_id INT DEFAULT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- SEED: one admin account
-- Default login -> email: admin@fixmycampus.com  password: admin123
-- (password_hash below is bcrypt for "admin123")
-- ============================
INSERT INTO users (full_name, email, phone, department, year, password_hash, role)
VALUES (
  'Admin',
  'admin@fixmycampus.com',
  '0000000000',
  'Administration',
  NULL,
  '$2b$10$hWIVq/N8h72W5ewWQybR.esmTzWF8s7OA2K3GJthKXL2V4bNEk7Ka',
  'admin'
) ON DUPLICATE KEY UPDATE email = email;

