// -- Admin Table
// CREATE DATABASE car_service_db;

// USE car_service_db;


// CREATE TABLE IF NOT EXISTS Admin (
//   id VARCHAR(16) PRIMARY KEY,
//   phone_number VARCHAR(20) NOT NULL UNIQUE,
//   name VARCHAR(255) NOT NULL,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

// -- Customer Table
// CREATE TABLE IF NOT EXISTS Customer (
//   id VARCHAR(16) PRIMARY KEY,
//   phone_number BIGINT NOT NULL UNIQUE,
//   name VARCHAR(255) NOT NULL,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

// -- Car Table
// CREATE TABLE IF NOT EXISTS Car (
//   id VARCHAR(16) PRIMARY KEY,
//   customer_id VARCHAR(16) NOT NULL,
//   registration_number VARCHAR(50) NOT NULL UNIQUE,
//   brand VARCHAR(100) NOT NULL,
//   model VARCHAR(100) NOT NULL,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (customer_id) REFERENCES Customer(id)
// );

// -- Service Table
// CREATE TABLE IF NOT EXISTS Service (
//   id VARCHAR(16) PRIMARY KEY,
//   category VARCHAR(100) NOT NULL,
//   name VARCHAR(100) NOT NULL,
//   price DECIMAL(10,2) NOT NULL,
//   status ENUM('Available', 'Unavailable') NOT NULL DEFAULT 'Available',
//   features TEXT,
//   details TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

// -- Workshop Table
// CREATE TABLE IF NOT EXISTS Workshop (
//   id VARCHAR(16) PRIMARY KEY,
//   name VARCHAR(255) NOT NULL,
//   phone_number BIGINT NOT NULL,
//   longitude DOUBLE NOT NULL,
//   latitude DOUBLE NOT NULL,
//   status ENUM('Acquired', 'In-Progress', 'Rejected') NOT NULL DEFAULT 'Acquired',
//   is_active BOOLEAN NOT NULL DEFAULT TRUE,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

// -- Booking Table
// CREATE TABLE IF NOT EXISTS Booking (
//   id VARCHAR(16) PRIMARY KEY,
//   customer_id VARCHAR(16) NOT NULL,
//   car_id VARCHAR(16) NOT NULL,
//   workshop_id VARCHAR(16),
//   service_id VARCHAR(16) NOT NULL,
//   status ENUM('Pending', 'In-Progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
//   booking_date DATETIME NOT NULL,
//   pickup_address VARCHAR(255) NOT NULL,
//   pickup_timing VARCHAR(100) NOT NULL,
//   longitude DOUBLE NOT NULL,
//   latitude DOUBLE NOT NULL,
//   total_amount DECIMAL(10,2) NOT NULL,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (customer_id) REFERENCES Customer(id),
//   FOREIGN KEY (car_id) REFERENCES Car(id),
//   FOREIGN KEY (workshop_id) REFERENCES Workshop(id),
//   FOREIGN KEY (service_id) REFERENCES Service(id)
// );

// -- Review Table
// CREATE TABLE IF NOT EXISTS Review (
//   id VARCHAR(16) PRIMARY KEY,
//   booking_id VARCHAR(16) NOT NULL,
//   rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
//   review TEXT NOT NULL,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (booking_id) REFERENCES Booking(id)
// );
