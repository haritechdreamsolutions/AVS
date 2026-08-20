-- ====================================================================
-- AVS DISTRIBUTION MANAGEMENT POS - COMPLETE MYSQL DATABASE SCRIPT
-- Database: avs_distribution_db
-- Features: Full Tables DDL, Foreign Keys, Stored Procedures & Full Seeds Data
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `avs_distribution_db` 
DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `avs_distribution_db`;

-- --------------------------------------------------------------------
-- 1. DROP EXISTING TABLES & PROCEDURES (SAFE RESET ORDER)
-- --------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_UpdateProductPrice`;
DROP PROCEDURE IF EXISTS `sp_CollectShopDue`;
DROP PROCEDURE IF EXISTS `sp_CreateSaleInvoice`;
DROP PROCEDURE IF EXISTS `sp_AssignFreezerAsset`;

DROP TABLE IF EXISTS `recent_activities`;
DROP TABLE IF EXISTS `settlements`;
DROP TABLE IF EXISTS `expenses`;
DROP TABLE IF EXISTS `damages`;
DROP TABLE IF EXISTS `sale_items`;
DROP TABLE IF EXISTS `sales`;
DROP TABLE IF EXISTS `employee_stock`;
DROP TABLE IF EXISTS `freezer_allocations`;
DROP TABLE IF EXISTS `shops`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `routes`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `company_info`;

-- --------------------------------------------------------------------
-- 2. CREATE SCHEMAS & TABLES DDL
-- --------------------------------------------------------------------

-- Company Info Table
CREATE TABLE `company_info` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `subtitle` VARCHAR(255) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Roles Table
CREATE TABLE `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_name` VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users / Employees Table
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

-- Routes Master Table
CREATE TABLE `routes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `shops_count` INT DEFAULT 0,
  `completed_count` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products Master Table (Price & Ratio Engine)
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

-- Retail Shops Master Table
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

-- Employee Loaded Vehicle Stock Table
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

-- Sales Headers Table
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

-- Sales Items Breakdown Table
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

-- Damages & Returns Table
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

-- Expenses Table
CREATE TABLE `expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT DEFAULT NULL,
  `title` VARCHAR(150) NOT NULL,
  `category` VARCHAR(50) DEFAULT 'General',
  `amount` DECIMAL(10,2) NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- End of Day Cash Settlements Table
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

-- Recent System Audit Log / Activities Table
CREATE TABLE `recent_activities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `time` VARCHAR(30) NOT NULL,
  `type` VARCHAR(30) DEFAULT 'general',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- --------------------------------------------------------------------
-- 3. STORED PROCEDURES (PROCEDURES MASTER)
-- --------------------------------------------------------------------

DELIMITER //

-- Procedure 1: Update Product Price & 72 Pcs Ratio
CREATE PROCEDURE `sp_UpdateProductPrice`(
  IN `p_product_id` INT,
  IN `p_unit_selling_price` DECIMAL(10,2),
  IN `p_piece_selling_price` DECIMAL(10,2),
  IN `p_purchase_price` DECIMAL(10,2),
  IN `p_pieces_per_unit` INT
)
BEGIN
  UPDATE `products`
  SET 
    `unit_selling_price` = p_unit_selling_price,
    `piece_selling_price` = p_piece_selling_price,
    `purchase_price` = p_purchase_price,
    `pieces_per_unit` = p_pieces_per_unit
  WHERE `id` = p_product_id;

  INSERT INTO `recent_activities` (`title`, `time`, `type`)
  VALUES (
    CONCAT('Rate updated for product #', p_product_id, ': ₹', p_unit_selling_price, '/Tray'),
    DATE_FORMAT(NOW(), '%h:%i %p'),
    'price'
  );
END //

-- Procedure 2: Collect Retailer Market Due
CREATE PROCEDURE `sp_CollectShopDue`(
  IN `p_shop_id` INT,
  IN `p_amount` DECIMAL(10,2),
  IN `p_mode` VARCHAR(20)
)
BEGIN
  DECLARE v_current_due DECIMAL(10,2);
  DECLARE v_shop_name VARCHAR(150);
  DECLARE v_new_due DECIMAL(10,2);

  SELECT `current_due`, `name` INTO v_current_due, v_shop_name
  FROM `shops` WHERE `id` = p_shop_id;

  SET v_new_due = GREATEST(0.00, v_current_due - p_amount);

  UPDATE `shops` 
  SET `current_due` = v_new_due 
  WHERE `id` = p_shop_id;

  INSERT INTO `recent_activities` (`title`, `time`, `type`)
  VALUES (
    CONCAT('Collected ₹', p_amount, ' due from ', v_shop_name, ' (Mode: ', p_mode, ')'),
    DATE_FORMAT(NOW(), '%h:%i %p'),
    'payment'
  );
END //

-- Procedure 3: Assign Deep Freezer Asset to Retail Store
CREATE PROCEDURE `sp_AssignFreezerAsset`(
  IN `p_shop_id` INT,
  IN `p_model` VARCHAR(150),
  IN `p_serial` VARCHAR(100)
)
BEGIN
  DECLARE v_shop_name VARCHAR(150);

  SELECT `name` INTO v_shop_name FROM `shops` WHERE `id` = p_shop_id;

  UPDATE `shops`
  SET 
    `has_freezer` = 1,
    `freezer_model` = p_model,
    `freezer_serial` = p_serial,
    `freezer_date` = DATE_FORMAT(NOW(), '%Y-%m-%d'),
    `freezer_status` = 'Active'
  WHERE `id` = p_shop_id;

  INSERT INTO `recent_activities` (`title`, `time`, `type`)
  VALUES (
    CONCAT('Freezer asset allocated to ', v_shop_name),
    DATE_FORMAT(NOW(), '%h:%i %p'),
    'freezer'
  );
END //

DELIMITER ;


-- --------------------------------------------------------------------
-- 4. SEEDS DATA (POPULATE DATABASE INSERTS)
-- --------------------------------------------------------------------

-- Company Info
INSERT INTO `company_info` (`id`, `name`, `subtitle`, `address`, `phone`) VALUES
(1, 'AVS DISTRIBUTORS', 'Milk & Beverage Distribution Management System', 'Main Road, Salem, Tamil Nadu', '+91 98765 43210');

-- Roles
INSERT INTO `roles` (`id`, `role_name`) VALUES
(1, 'OWNER'),
(2, 'STORE_KEEPER'),
(3, 'EMPLOYEE');

-- Users
INSERT INTO `users` (`id`, `name`, `phone`, `pin`, `role`, `vehicle_no`, `status`, `progress`) VALUES
(1, 'Tharun', '9876543210', '1111', 'EMPLOYEE', 'TN 32 XX 2222', 'On Route', 42),
(2, 'Kumar', '9876543211', '2222', 'EMPLOYEE', 'TN 32 AB 1234', 'On Route', 60),
(3, 'Suresh', '9876543212', '3333', 'EMPLOYEE', 'TN 32 CD 5678', 'Returned', 100),
(4, 'Mani', '9876543213', '4444', 'EMPLOYEE', 'TN 32 BF 9012', 'On Route', 20),
(5, 'Prakash', '9876543214', '5555', 'EMPLOYEE', 'TN 32 GH 3456', 'Not Started', 0),
(6, 'Store Keeper', '9876543200', '1234', 'STORE_KEEPER', NULL, 'Active', 100),
(7, 'Owner Admin', '9999999999', '9999', 'OWNER', NULL, 'Active', 100);

-- Routes
INSERT INTO `routes` (`id`, `name`, `shops_count`, `completed_count`) VALUES
(1, 'Route A (Salem Main)', 30, 12);

-- Products Master (All 15 Variants + 72 Pcs Tray Ratios)
INSERT INTO `products` (`id`, `name`, `display_name`, `category`, `base_unit`, `selling_unit`, `pieces_per_unit`, `purchase_price`, `unit_selling_price`, `piece_selling_price`, `warehouse_stock_units`, `icon`, `image_path`) VALUES
(1, 'Amirtha Milk 200ml', 'Amirtha Milk - 200ml', 'Dairy', 'Piece', 'Tray', 20, 720.00, 880.00, 44.00, 88, '🥛', '/images/amirthaa_milk_200ml.png'),
(5, 'Amirtha Milk 500ml', 'Amirtha Milk - 500ml', 'Dairy', 'Piece', 'Tray', 12, 780.00, 960.00, 80.00, 110, '🥛', '/images/amirthaa_milk_500ml.png'),
(6, 'Amirtha Milk 1L', 'Amirtha Milk - 1L', 'Dairy', 'Piece', 'Tray', 10, 850.00, 1050.00, 105.00, 65, '🥛', '/images/amirthaa_milk_1l.jpg'),
(7, 'Amirtha Curd 200ml', 'Amirtha Curd - 200ml', 'Curd', 'Piece', 'Tray', 20, 520.00, 660.00, 33.00, 75, '🥣', '/images/amirthaa_curd_200ml.jpg'),
(8, 'Amirtha Curd 500ml', 'Amirtha Curd - 500ml', 'Curd', 'Piece', 'Tray', 12, 620.00, 780.00, 65.00, 90, '🥣', '/images/amirthaa_curd_500ml.jpg'),
(9, 'Amirtha Curd 1L', 'Amirtha Curd - 1L', 'Curd', 'Piece', 'Tray', 10, 760.00, 950.00, 95.00, 40, '🥣', '/images/amirthaa_curd_1l.jpg'),
(10, 'Coccola 200ml', 'Coccola - 200ml', 'Beverage', 'Piece', 'Box', 24, 480.00, 600.00, 25.00, 140, '🥤', '/images/coccola_200ml.png'),
(3, 'Coccola 500ml', 'Coccola - 500ml', 'Beverage', 'Piece', 'Box', 12, 540.00, 720.00, 60.00, 120, '🥤', '/images/coccola_500ml.png'),
(11, 'Coccola 1L', 'Coccola - 1L', 'Beverage', 'Piece', 'Box', 6, 420.00, 570.00, 95.00, 80, '🥤', '/images/coccola_1l.png'),
(12, 'Juice Pack 200ml', 'Juice Pack - 200ml', 'Juice', 'Piece', 'Box', 24, 400.00, 520.00, 22.00, 95, '🧃', '/images/juice_hero.jpg'),
(15, 'Tata Drink 200ml', 'Tata Drink - 200ml', 'Juice', 'Piece', 'Box', 24, 380.00, 480.00, 20.00, 110, '🧃', '/images/tata_hero.jpg'),
(18, 'Aquafresh Water 200ml', 'Aquafresh Water - 200ml', 'Water', 'Piece', 'Box', 48, 200.00, 280.00, 6.00, 210, '💧', '/images/aquafresh_water_200ml.png'),
(19, 'Aquafresh Water 500ml', 'Aquafresh Water - 500ml', 'Water', 'Piece', 'Box', 24, 240.00, 340.00, 14.00, 180, '💧', '/images/aquafresh_water_500ml.png'),
(2, 'Aquafresh Water 1L', 'Aquafresh Water - 1L', 'Water', 'Piece', 'Box', 12, 280.00, 380.00, 32.00, 250, '💧', '/images/aquafresh_water_1l.png'),
(20, 'Aquafresh Water 2L', 'Aquafresh Water - 2L', 'Water', 'Piece', 'Box', 6, 220.00, 300.00, 50.00, 90, '💧', '/images/aquafresh_water_2l.png');

-- Shops Master (6 Stores Including Green Park Bakery #107)
INSERT INTO `shops` (`id`, `code`, `name`, `owner_name`, `phone`, `distance`, `route_id`, `current_due`, `completed`, `has_freezer`, `freezer_model`, `freezer_serial`, `freezer_date`, `freezer_status`) VALUES
(102, '#102', 'Mani Store', 'Manikandan', '9123456789', '2.3 km', 1, 1200.00, 0, 1, 'Blue Star 300L Deep Freezer', 'FRZ-MS-102', '2026-01-10', 'Active'),
(103, '#103', 'Kumar Store', 'Kumar', '9123456788', '2.8 km', 1, 800.00, 0, 0, NULL, NULL, NULL, NULL),
(104, '#104', 'Raja Store', 'Rajesh', '9123456787', '3.1 km', 1, 0.00, 0, 1, 'Voltas 400L Double Door Cooler', 'FRZ-RS-104', '2026-02-20', 'Active'),
(105, '#105', 'Siva Store', 'Sivakumar', '9123456786', '3.4 km', 1, 450.00, 0, 0, NULL, NULL, NULL, NULL),
(106, '#106', 'New Super Store', 'Periasamy', '9123456785', '4.0 km', 1, 0.00, 0, 1, 'Haier 320L Visicooler', 'FRZ-NSS-106', '2026-03-05', 'Active'),
(107, '#107', 'Green Park Bakery', 'Karthik', '9123456784', '4.5 km', 1, 0.00, 0, 0, NULL, NULL, NULL, NULL);

-- Employee Stock Allocations
INSERT INTO `employee_stock` (`employee_id`, `product_id`, `qty_units`, `unit`) VALUES
(1, 1, 8, 'Tray'),
(1, 2, 5, 'Tray'),
(1, 3, 5, 'Box'),
(1, 4, 15, 'Pack');

-- Initial Sales History
INSERT INTO `sales` (`id`, `bill_no`, `employee_id`, `employee_name`, `shop_id`, `shop_name`, `date`, `time`, `total_amount`, `payment_mode`) VALUES
(1, 'INV-10921', 1, 'Tharun (Driver)', 102, 'Mani Store', CURDATE(), '09:30 AM', 1800.00, 'CASH'),
(2, 'INV-10922', 1, 'Tharun (Driver)', 103, 'Kumar Store', CURDATE(), '10:15 AM', 950.00, 'GPAY'),
(3, 'INV-10923', 2, 'Kumar (Driver)', 104, 'Raja Store', CURDATE(), '11:00 AM', 2400.00, 'CREDIT'),
(4, 'INV-10924', 6, 'Store Keeper', 105, 'Siva Store', CURDATE(), '01:45 PM', 1250.00, 'SPLIT');

-- Sale Items Breakdown
INSERT INTO `sale_items` (`sale_id`, `product_id`, `product_name`, `qty`, `unit_type`, `rate`, `amount`) VALUES
(1, 1, 'Amirtha Milk 200ml', 2.00, 'Tray', 880.00, 1760.00),
(2, 5, 'Amirtha Milk 500ml', 1.00, 'Tray', 960.00, 960.00),
(3, 3, 'Coccola 500ml', 4.00, 'Box', 720.00, 2880.00);

-- Initial Audit Log Activities
INSERT INTO `recent_activities` (`id`, `title`, `time`, `type`) VALUES
(1, 'Database schema and seeds setup completed', '10:00 AM', 'system'),
(2, 'Price master rates updated by Owner Admin', '10:15 AM', 'price'),
(3, 'Freezer assigned to Mani Store (#102)', '10:30 AM', 'freezer');

COMMIT;

-- ====================================================================
-- END OF MYSQL DATABASE SETUP SCRIPT
-- ====================================================================
