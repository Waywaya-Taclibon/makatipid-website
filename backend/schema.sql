-- Makatipid schema (matches the tables created by the old Spring Boot JPA entities).
-- If you already have makatipid_db from the Java backend, do NOT re-run this.
CREATE DATABASE IF NOT EXISTS makatipid_db;
USE makatipid_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'USER',
  token_version INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lot_name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  price DECIMAL(19,2) NOT NULL,
  lat DECIMAL(11,7) NOT NULL,
  lng DECIMAL(11,7) NOT NULL,
  owner_id INT NOT NULL,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  available_until DATE NULL,
  security_deposit DECIMAL(19,2) NULL,
  internet VARCHAR(20) NULL,
  electricity_included TINYINT(1) NULL,
  water_included TINYINT(1) NULL,
  pets_allowed TINYINT(1) NULL,
  smoking_allowed TINYINT(1) NULL,
  modifications_allowed TINYINT(1) NULL,
  CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS rentallog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  renter_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT fk_rentallog_property FOREIGN KEY (property_id) REFERENCES properties (id),
  CONSTRAINT fk_rentallog_renter FOREIGN KEY (renter_id) REFERENCES users (id)
);

-- Phase 2: payment ledger. One row per PayMongo PaymentIntent.
-- Holds expire after 5 minutes (see HOLD_MINUTES in payments.js); expired
-- PENDING rows are ignored by conflict checks and lazily marked EXPIRED.
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  intent_id VARCHAR(255) NOT NULL UNIQUE,
  property_id INT NOT NULL,
  renter_id INT NOT NULL,
  amount_centavos INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  booking_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_property FOREIGN KEY (property_id) REFERENCES properties (id),
  CONSTRAINT fk_payments_renter FOREIGN KEY (renter_id) REFERENCES users (id),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES rentallog (id),
  INDEX idx_payments_property_status (property_id, status, created_at)
);

-- Property photos: one row per photo; the 3-photo cap is enforced in code.
CREATE TABLE IF NOT EXISTS property_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  image_url VARCHAR(1024) NOT NULL,
  public_id VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_property_images_property FOREIGN KEY (property_id) REFERENCES properties (id),
  INDEX idx_property_images_property (property_id, sort_order)
);
