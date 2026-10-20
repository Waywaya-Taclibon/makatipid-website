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
  token_version INT NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  phone VARCHAR(32) NULL,
  facebook VARCHAR(255) NULL,
  instagram VARCHAR(255) NULL
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
  client_request_id VARCHAR(64) NULL,
  CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES users (id),
  UNIQUE KEY uq_properties_owner_client_request (owner_id, client_request_id)
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

-- Temporary in-app messaging, scoped to one renter + one listing.
-- The whole chat (and its messages, via ON DELETE CASCADE) is deleted 24 hours
-- after the last message so storage and traffic stay bounded. Sending a new
-- message pushes the expiry out by another 24 hours.
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  owner_id INT NOT NULL,
  renter_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  CONSTRAINT fk_conversations_property FOREIGN KEY (property_id) REFERENCES properties (id),
  CONSTRAINT fk_conversations_owner FOREIGN KEY (owner_id) REFERENCES users (id),
  CONSTRAINT fk_conversations_renter FOREIGN KEY (renter_id) REFERENCES users (id),
  UNIQUE KEY uq_conversations_property_renter (property_id, renter_id),
  INDEX idx_conversations_owner (owner_id, last_message_at),
  INDEX idx_conversations_renter (renter_id, last_message_at),
  INDEX idx_conversations_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id),
  INDEX idx_messages_conversation (conversation_id, id)
);

-- Append-only trail of admin actions. No FK on admin_id on purpose: the log
-- must survive even if the account row is ever removed by hand.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NULL,
  target_id VARCHAR(64) NULL,
  details TEXT NULL,
  ip VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_audit_created (created_at),
  INDEX idx_admin_audit_admin (admin_id)
);
