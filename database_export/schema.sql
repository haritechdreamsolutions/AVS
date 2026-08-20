-- ====================================================================
-- AVS DISTRIBUTION MANAGEMENT POS - MYSQL DDL SCHEMA SCRIPT
-- Database: avs_distribution_db
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `avs_distribution_db` 
DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `avs_distribution_db`;

DROP PROCEDURE IF EXISTS `sp_UpdateProductPrice`;
DROP PROCEDURE IF EXISTS `sp_CollectShopDue`;
DROP PROCEDURE IF EXISTS `sp_AssignFreezerAsset`;

DROP TABLE IF EXISTS `recent_activities`;
DROP TABLE IF EXISTS `settlements`;
DROP TABLE IF EXISTS `expenses`;
DROP TABLE IF EXISTS `damages`;
DROP TABLE IF EXISTS `sale_items`;
DROP TABLE IF EXISTS `sales`;
DROP TABLE IF EXISTS `employee_stock`;
DROP TABLE IF EXISTS `shops`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `routes`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `company_info`;

CREATE TABLE `company_info` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `subtitle` VARCHAR(255) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_name` VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `pin` VARCHAR(10) NOT NULL,
  `role` VARCHAR(30) NOT NULL,
  `vehicle_no` VARCHAR(30) DEFAULT NULL,
  `status` VARCHAR(30) DEFAULT 'Active',
  `progress` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `routes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `shops_count` INT DEFAULT 0,
  `completed_count` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `display_name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `base_unit` VARCHAR(20) DEFAULT 'Piece',
  `selling_unit` VARCHAR(20) DEFAULT 'Tray',
  `pieces_per_unit` INT NOT NULL DEFAULT 20,
  `purchase_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `unit_selling_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `piece_selling_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `warehouse_stock_units` INT NOT NULL DEFAULT 0,
  `icon` VARCHAR(10) DEFAULT '🥛',
  `image_path` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `shops` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `owner_name` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `distance` VARCHAR(20) DEFAULT '3.0 km',
  `route_id` INT DEFAULT 1,
  `current_due` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `completed` TINYINT(1) DEFAULT 0,
  `has_freezer` TINYINT(1) DEFAULT 0,
  `freezer_model` VARCHAR(150) DEFAULT NULL,
  `freezer_serial` VARCHAR(100) DEFAULT NULL,
  `freezer_date` VARCHAR(30) DEFAULT NULL,
  `freezer_status` VARCHAR(30) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `employee_stock` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `qty_units` INT NOT NULL DEFAULT 0,
  `unit` VARCHAR(20) DEFAULT 'Tray',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bill_no` VARCHAR(50) NOT NULL UNIQUE,
  `employee_id` INT DEFAULT NULL,
  `employee_name` VARCHAR(100) DEFAULT NULL,
  `shop_id` INT DEFAULT NULL,
  `shop_name` VARCHAR(150) DEFAULT NULL,
  `date` DATE NOT NULL,
  `time` VARCHAR(30) NOT NULL,
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payment_mode` VARCHAR(20) NOT NULL DEFAULT 'CASH',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `sale_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `product_name` VARCHAR(150) NOT NULL,
  `qty` DECIMAL(10,2) NOT NULL,
  `unit_type` VARCHAR(20) DEFAULT 'Tray',
  `rate` DECIMAL(10,2) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `damages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT DEFAULT NULL,
  `employee_name` VARCHAR(100) DEFAULT NULL,
  `product_id` INT DEFAULT NULL,
  `product_name` VARCHAR(150) DEFAULT NULL,
  `qty_units` INT NOT NULL DEFAULT 0,
  `reason` VARCHAR(255) DEFAULT NULL,
  `amount` DECIMAL(10,2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT DEFAULT NULL,
  `title` VARCHAR(150) NOT NULL,
  `category` VARCHAR(50) DEFAULT 'General',
  `amount` DECIMAL(10,2) NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `settlements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `employee_name` VARCHAR(100) NOT NULL,
  `date` DATE NOT NULL,
  `expected_amount` DECIMAL(10,2) NOT NULL,
  `collected_amount` DECIMAL(10,2) NOT NULL,
  `difference` DECIMAL(10,2) NOT NULL,
  `reason` VARCHAR(255) DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `status` VARCHAR(30) DEFAULT 'BALANCED',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `recent_activities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `time` VARCHAR(30) NOT NULL,
  `type` VARCHAR(30) DEFAULT 'general',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
